use std::io::{BufReader, Read};
use std::process::Stdio;
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::winget::process::{decode_command_bytes, CREATE_NO_WINDOW};
use crate::winget::types::{CommandOutput, ProgressPayload};

/// Extracts operation progress percentage from a streamed terminal line using a 3-tier heuristic.
///
/// # Technical Nuance: Three-Tier Progress Detection Heuristics
/// The `winget` CLI does not emit structured progress data (such as JSON-RPC or ndjson).
/// Instead, it writes human-oriented terminal progress animations to standard output.
/// This function analyzes streamed line fragments using three descending heuristic tiers:
///
/// 1. **Percentage Pattern**: Looks for a `%` symbol and reads backwards to extract an integer or decimal
///    number (e.g., `"45%"`, `"99.5%"`). Validates `0.0 <= pct <= 100.0`.
/// 2. **Block Character Counting**: Terminal progress bars often render using Unicode block elements
///    (`█` U+2588 filled and `▒` U+2592 empty). The ratio of filled blocks to total blocks determines
///    the download progress percentage.
/// 3. **Lifecycle Phase Keywords**: Once download completes, winget transitions to package extraction
///    and installer execution ("安装", "Installing", "uninstall", "卸载"). When these keywords appear,
///    progress is transitioned to 100.0% to complete the download progress phase.
pub fn extract_progress_from_line(line: &str) -> Option<f64> {
    // Tier 1: Percentage extraction (e.g. "45%", "99.5%")
    if let Some(pct_pos) = line.find('%') {
        let before = &line[..pct_pos];
        let num_str: String = before
            .chars()
            .rev()
            .take_while(|c| c.is_ascii_digit() || *c == '.')
            .collect::<String>()
            .chars()
            .rev()
            .collect();
        if let Ok(pct) = num_str.parse::<f64>() {
            if (0.0..=100.0).contains(&pct) {
                return Some(pct);
            }
        }
    }

    // Tier 2: Block character bar counting ('█' and '▒')
    let blocks = line.chars().filter(|&ch| ch == '█' || ch == '▒').count();
    if blocks > 0 {
        let filled = line.chars().filter(|&ch| ch == '█').count();
        let progress = (filled as f64 / blocks as f64) * 100.0;
        return Some(progress);
    }

    // Tier 3: Phase keyword detection
    if line.contains("安装")
        || line.contains("Installing")
        || line.contains("uninstall")
        || line.contains("卸载")
    {
        return Some(100.0);
    }

    None
}

/// Executes a winget command asynchronously while streaming stdout byte-by-byte to emit
/// real-time progress events over the `"download-progress"` Tauri event channel.
///
/// # Technical Nuance: In-Place Terminal Progress Updates via Carriage Return (`\r`)
/// Monospace CLI utilities animate progress by printing a carriage return (`\r`, ASCII `0x0D`)
/// without a newline (`\n`, ASCII `0x0A`), returning the cursor to column 0 to overwrite the line.
/// Standard line-buffered readers (`BufRead::lines()`) block until a newline is encountered,
/// completely missing animated intermediate frames until the child process terminates.
///
/// By reading raw bytes and flushing line buffers on *either* `\r` or `\n`, this function captures
/// each in-place overwrite frame and emits timely progress events.
///
/// # Technical Nuance: Stderr Pipe Deadlock Prevention via Concurrent Thread
/// When spawning child processes with piped `stdout` and `stderr`, OS pipe buffers have a finite
/// capacity (typically 4 KB to 64 KB on Windows). If the main thread synchronously consumes `stdout`
/// byte-by-byte while `winget` produces verbose diagnostic error messages to `stderr` that fill
/// the OS buffer, the child process blocks on `write(stderr)` while the parent blocks on `read(stdout)`,
/// creating an unrecoverable deadlock.
///
/// Spawning an isolated OS thread (`stderr_reader`) to continuously drain `stderr` to EOF in the
/// background ensures the OS pipe buffer never fills up, preventing process deadlock.
pub async fn run_winget_with_progress(
    args: &[&str],
    app: &tauri::AppHandle,
    id: &str,
) -> Result<CommandOutput, String> {
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let app_handle = app.clone();
    let pkg_id = id.to_string();

    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("winget");
        cmd.args(&args_owned)
            .args(["--accept-source-agreements", "--disable-interactivity"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let mut stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        // Drain stderr concurrently to prevent OS pipe buffer exhaustion and deadlocks
        let stderr_reader = std::thread::spawn(move || {
            let mut stderr_buf = Vec::new();
            let _ = stderr.read_to_end(&mut stderr_buf);
            stderr_buf
        });

        let mut reader = BufReader::new(stdout);
        let mut output_str = String::new();
        let mut line_buf = Vec::new();
        let mut buffer = [0u8; 1];

        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let b = buffer[0];
            line_buf.push(b);

            // Flush on carriage return (in-place animation) or newline
            if b == b'\r' || b == b'\n' {
                let decoded = decode_command_bytes(&line_buf);
                output_str.push_str(&decoded);

                if let Some(progress) = extract_progress_from_line(&decoded) {
                    let _ = app_handle.emit(
                        "download-progress",
                        ProgressPayload {
                            id: pkg_id.clone(),
                            progress,
                        },
                    );
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
