use std::io::{BufReader, Read};
use std::process::Stdio;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::winget::process::{decode_command_bytes, CREATE_NO_WINDOW};
use crate::winget::types::{CommandOutput, ProgressPayload};

fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                while let Some(ch) = chars.next() {
                    if ch.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

fn parse_percentage(line: &str) -> Option<f64> {
    let pct_pos = line.find('%')?;
    let before = &line[..pct_pos];
    let num_str: String = before
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit() || *c == '.')
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    let pct: f64 = num_str.parse().ok()?;
    (0.0..=100.0).contains(&pct).then_some(pct)
}

fn unit_multiplier(unit: &str) -> Option<f64> {
    let cleaned: String = unit
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .collect::<String>()
        .to_ascii_uppercase();
    match cleaned.as_str() {
        "B" => Some(1.0),
        "KB" | "KIB" => Some(1024.0),
        "MB" | "MIB" => Some(1024.0 * 1024.0),
        "GB" | "GIB" => Some(1024.0 * 1024.0 * 1024.0),
        _ => None,
    }
}

fn parse_compact_size(token: &str) -> Option<f64> {
    let split = token.find(|c: char| c.is_ascii_alphabetic())?;
    if split == 0 {
        return None;
    }
    let n: f64 = token[..split].parse().ok()?;
    Some(n * unit_multiplier(&token[split..])?)
}

fn take_size_from_end(text: &str) -> Option<f64> {
    let cleaned: String = text
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || c.is_whitespace())
        .collect();
    let tokens: Vec<&str> = cleaned.split_whitespace().collect();
    if tokens.len() >= 2 {
        if let (Ok(n), Some(m)) = (
            tokens[tokens.len() - 2].parse::<f64>(),
            unit_multiplier(tokens[tokens.len() - 1]),
        ) {
            return Some(n * m);
        }
    }
    parse_compact_size(*tokens.last()?)
}

/// Parses `12.3 MB / 45.6 MB` style winget download counters.
pub fn parse_size_fraction(line: &str) -> Option<f64> {
    let slash = line.find('/')?;
    let left = take_size_from_end(&line[..slash])?;
    let right = take_size_from_end(&line[slash + 1..])?;
    if right <= 0.0 {
        return None;
    }
    let pct = (left / right) * 100.0;
    (0.0..=100.0).contains(&pct).then_some(pct)
}

fn is_filled_block(ch: char) -> bool {
    matches!(ch, '█' | '▓' | '■' | '◼')
}

fn is_empty_block(ch: char) -> bool {
    matches!(ch, '▒' | '░' | '□' | '◻')
}

fn parse_block_bar(line: &str) -> Option<f64> {
    let chars: Vec<char> = line.chars().collect();
    let mut start = None;
    let mut end = 0;
    for (i, &ch) in chars.iter().enumerate() {
        if is_filled_block(ch) || is_empty_block(ch) {
            if start.is_none() {
                start = Some(i);
            }
            end = i;
        }
    }
    let start = start?;
    let slice = &chars[start..=end];
    if slice.len() < 4 {
        return None;
    }
    let filled = slice.iter().filter(|&&ch| is_filled_block(ch)).count();
    let empty = slice.iter().filter(|&&ch| is_empty_block(ch)).count();
    let total = filled + empty;
    if total < 4 {
        return None;
    }
    Some((filled as f64 / total as f64) * 100.0)
}

fn parse_phase_progress(line: &str) -> Option<f64> {
    let lower = line.to_ascii_lowercase();
    if lower.contains("successfully installed")
        || lower.contains("successfully upgraded")
        || line.contains("已成功安装")
        || line.contains("成功安装")
        || line.contains("成功升级")
        || line.contains("已成功卸载")
        || lower.contains("successfully uninstalled")
    {
        return Some(100.0);
    }
    if line.contains("正在安装")
        || line.contains("Starting package install")
        || lower.contains("installing ")
        || line.contains("正在卸载")
        || lower.contains("starting uninstall")
        || lower.contains("uninstalling ")
    {
        return Some(92.0);
    }
    None
}

/// Extracts a winget package id from a `Found Name [Publisher.Id] Version` status line.
pub fn extract_found_package_id(line: &str) -> Option<String> {
    let hay = strip_ansi(line);
    let looks_like_switch = hay.contains("Found ")
        || hay.contains("找到")
        || hay.contains("正在升级")
        || hay.contains("Upgrading ");
    if !looks_like_switch {
        return None;
    }
    let start = hay.find('[')?;
    let rest = &hay[start + 1..];
    let end = rest.find(']')?;
    let id = rest[..end].trim();
    if id.is_empty() || id.chars().any(|c| c.is_whitespace()) {
        return None;
    }
    Some(id.to_string())
}

/// Extracts operation progress percentage from a streamed terminal line.
///
/// 1. Explicit `45%` / `99.5%`
/// 2. Byte counters `12.3 MB / 45.6 MB` (the format winget actually prints)
/// 3. Block bars (`█`/`▒`/`░`/`▓`)
/// 4. Lifecycle keywords — installer start is ~92%, success is 100%
pub fn extract_progress_from_line(line: &str) -> Option<f64> {
    let line = strip_ansi(line);
    if let Some(pct) = parse_percentage(&line) {
        return Some(pct);
    }
    if let Some(pct) = parse_size_fraction(&line) {
        return Some(pct);
    }
    if let Some(pct) = parse_block_bar(&line) {
        return Some(pct);
    }
    parse_phase_progress(&line)
}

fn emit_progress(app: &tauri::AppHandle, id: &str, progress: f64) {
    let _ = app.emit(
        "download-progress",
        ProgressPayload {
            id: id.to_string(),
            progress,
        },
    );
}

/// Executes a winget command asynchronously while streaming stdout byte-by-byte to emit
/// real-time progress events over the `"download-progress"` Tauri event channel.
pub async fn run_winget_with_progress(
    args: &[&str],
    app: &tauri::AppHandle,
    id: &str,
) -> Result<CommandOutput, String> {
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let app_handle = app.clone();
    let initial_id = id.to_string();

    tokio::task::spawn_blocking(move || {
        let mut cmd = crate::winget::process::get_winget_cmd();
        let sanitized = crate::winget::process::sanitize_winget_args(&args_owned);
        cmd.args(&sanitized)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let mut stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        let stderr_reader = std::thread::spawn(move || {
            let mut stderr_buf = Vec::new();
            let _ = stderr.read_to_end(&mut stderr_buf);
            stderr_buf
        });

        let mut reader = BufReader::new(stdout);
        let mut output_str = String::new();
        let mut line_buf = Vec::new();
        let mut buffer = [0u8; 1];
        let mut current_id = initial_id.clone();
        let mut last_progress: f64 = -1.0;

        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let b = buffer[0];
            line_buf.push(b);

            if b == b'\r' || b == b'\n' {
                let decoded = decode_command_bytes(&line_buf);
                output_str.push_str(&decoded);

                if let Some(found_id) = extract_found_package_id(&decoded) {
                    if found_id != current_id {
                        if last_progress >= 0.0 && last_progress < 100.0 {
                            emit_progress(&app_handle, &current_id, 100.0);
                        }
                        current_id = found_id;
                        last_progress = -1.0;
                    }
                }

                if let Some(progress) = extract_progress_from_line(&decoded) {
                    let rounded = (progress * 10.0).round() / 10.0;
                    if last_progress < 0.0 || (rounded - last_progress).abs() >= 0.3 {
                        last_progress = rounded;
                        emit_progress(&app_handle, &current_id, rounded);
                    }
                }

                line_buf.clear();
            }
        }

        if !line_buf.is_empty() {
            output_str.push_str(&decode_command_bytes(&line_buf));
        }

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for winget: {}", e))?;
        let stderr_buf = stderr_reader
            .join()
            .map_err(|_| "Failed to read winget stderr".to_string())?;

        Ok(CommandOutput {
            stdout: output_str,
            stderr: decode_command_bytes(&stderr_buf),
            success: status.success(),
            status_code: status.code(),
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
