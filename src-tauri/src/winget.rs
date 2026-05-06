use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::io::{BufRead, BufReader};
use tauri::Emitter;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    pub id: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageDetail {
    pub name: String,
    pub id: String,
    pub version: String,
    pub publisher: String,
    pub description: String,
    pub homepage: String,
    pub license: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationResult {
    pub success: bool,
    pub message: String,
    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub id: String,
    pub progress: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WingetSettings {
    pub install_mode: String,
    pub install_scope: String,
    pub install_architecture: String,
    pub install_location: String,
    pub install_force: bool,
    pub upgrade_mode: String,
    pub upgrade_include_unknown: bool,
    pub upgrade_force: bool,
    pub uninstall_mode: String,
    pub uninstall_purge: bool,
    pub search_count: u32,
    pub search_exact: bool,
    pub search_source: String,
}

impl WingetSettings {
    fn mode_args(&self, mode: &str) -> Vec<String> {
        match mode {
            "silent" => vec!["--silent".to_string()],
            "interactive" => vec!["--interactive".to_string()],
            _ => vec![],
        }
    }

    pub fn install_args(&self) -> Vec<String> {
        let mut args = self.mode_args(&self.install_mode);
        if self.install_scope != "default" {
            args.push("--scope".to_string());
            args.push(self.install_scope.clone());
        }
        if self.install_architecture != "default" {
            args.push("--architecture".to_string());
            args.push(self.install_architecture.clone());
        }
        if !self.install_location.is_empty() {
            args.push("--location".to_string());
            args.push(self.install_location.clone());
        }
        if self.install_force {
            args.push("--force".to_string());
        }
        args
    }

    pub fn upgrade_args(&self) -> Vec<String> {
        let mut args = self.mode_args(&self.upgrade_mode);
        if self.upgrade_include_unknown {
            args.push("--include-unknown".to_string());
        }
        if self.upgrade_force {
            args.push("--force".to_string());
        }
        args
    }

    pub fn uninstall_args(&self) -> Vec<String> {
        let mut args = self.mode_args(&self.uninstall_mode);
        if self.uninstall_purge {
            args.push("--purge".to_string());
        }
        args
    }

    pub fn search_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        if self.search_count > 0 {
            args.push("--count".to_string());
            args.push(self.search_count.to_string());
        }
        if self.search_exact {
            args.push("--exact".to_string());
        }
        if self.search_source != "default" {
            args.push("--source".to_string());
            args.push(self.search_source.clone());
        }
        args
    }
}

/// Run a winget command and capture the output as a string.
/// Handles both UTF-8 and GBK encoding (common on Chinese Windows).
async fn run_winget(args: &[&str]) -> Result<String, String> {
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("winget");
        cmd.args(&args_owned)
            .args(&["--accept-source-agreements", "--disable-interactivity"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd.output().map_err(|e| format!("Failed to run winget: {}", e))?;

        // Try UTF-8 first, fallback to GBK
        let stdout = String::from_utf8(output.stdout.clone()).unwrap_or_else(|_| {
            let (cow, _, _) = encoding_rs::GBK.decode(&output.stdout);
            cow.into_owned()
        });

        Ok(stdout)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

use std::collections::HashMap;

/// Parse the fixed-width tabular output from winget.
/// Returns a list of maps where keys are header names (e.g., "ID", "Source").
fn parse_table_as_map(output: &str) -> Vec<HashMap<String, String>> {
    let lines: Vec<&str> = output.lines().map(|l| {
        match l.rfind('\r') {
            Some(idx) => &l[idx + 1..],
            None => l,
        }
    }).collect();

    // Find the separator line (all dashes)
    let sep_idx = lines.iter().position(|l| {
        let trimmed = l.trim();
        !trimmed.is_empty() && trimmed.chars().all(|c| c == '-')
    });

    let sep_idx = match sep_idx {
        Some(idx) => idx,
        None => return vec![],
    };

    if sep_idx == 0 {
        return vec![];
    }

    let header_line = lines[sep_idx - 1];
    let col_starts = find_column_starts(header_line);
    let headers = extract_columns(header_line, &col_starts);

    // Parse data lines
    let mut rows = Vec::new();
    for line in &lines[sep_idx + 1..] {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('<') || trimmed.ends_with("可用。") || trimmed.ends_with("available.") {
            continue;
        }

        let vals = extract_columns(line, &col_starts);
        let mut map = HashMap::new();
        for (i, header) in headers.iter().enumerate() {
            if let Some(val) = vals.get(i) {
                map.insert(header.clone(), val.clone());
            }
        }
        if !map.is_empty() {
            rows.push(map);
        }
    }

    rows
}

/// Get approximate visual width of a character
fn char_width(c: char) -> usize {
    if c as u32 > 0x2E80 { 2 } else { 1 }
}

/// Find column start visual positions by looking at where header words begin
fn find_column_starts(header: &str) -> Vec<usize> {
    let mut starts = Vec::new();
    let chars: Vec<char> = header.chars().collect();
    let mut i = 0;
    let mut visual_pos = 0;

    while i < chars.len() {
        if !chars[i].is_whitespace() {
            starts.push(visual_pos);
            // Skip to end of this column header
            while i < chars.len() && !chars[i].is_whitespace() {
                visual_pos += char_width(chars[i]);
                i += 1;
            }
            // Skip whitespace between columns (need at least 2 spaces to be a separator)
            let ws_start = i;
            let ws_visual_start = visual_pos;
            while i < chars.len() && chars[i].is_whitespace() {
                visual_pos += 1; // space is width 1
                i += 1;
            }
            // If only 1 space, it's part of the same column name
            if visual_pos - ws_visual_start == 1 && i < chars.len() {
                continue;
            }
        } else {
            visual_pos += 1;
            i += 1;
        }
    }

    starts
}

/// Extract column values from a data line using visual column positions
fn extract_columns(line: &str, col_starts: &[usize]) -> Vec<String> {
    let chars: Vec<char> = line.chars().collect();
    let mut cols = Vec::new();
    
    // Map visual positions to char indices for this line
    let mut visual_to_char = Vec::with_capacity(line.len() * 2);
    let mut current_visual = 0;
    for (idx, &c) in chars.iter().enumerate() {
        let w = char_width(c);
        for _ in 0..w {
            visual_to_char.push(idx);
        }
        current_visual += w;
    }
    // Add a terminator index
    visual_to_char.push(chars.len());

    for (i, &start_visual) in col_starts.iter().enumerate() {
        let end_visual = if i + 1 < col_starts.len() {
            col_starts[i + 1]
        } else {
            visual_to_char.len() - 1
        };

        if start_visual >= visual_to_char.len() - 1 {
            cols.push(String::new());
        } else {
            let start_char = visual_to_char[start_visual];
            let actual_end_visual = end_visual.min(visual_to_char.len() - 1);
            let end_char = visual_to_char[actual_end_visual];
            
            let val: String = chars[start_char..end_char].iter().collect();
            cols.push(val.trim().to_string());
        }
    }

    cols
}

/// Search for packages
pub async fn search_packages(query: &str, settings: WingetSettings) -> Result<Vec<Package>, String> {
    let mut base_args: Vec<String> = vec!["search".to_string(), "--query".to_string(), query.to_string()];
    base_args.extend(settings.search_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let output = run_winget(&args_refs).await?;
    let rows = parse_table_as_map(&output);

    let packages = rows
        .into_iter()
        .map(|m| {
            Package {
                name: m.get("名称").or(m.get("Name")).cloned().unwrap_or_default(),
                id: m.get("ID").cloned().unwrap_or_default(),
                version: m.get("版本").or(m.get("Version")).cloned().unwrap_or_default(),
                matched: m.get("匹配").or(m.get("Matched")).cloned().filter(|s| !s.is_empty()),
                source: m.get("源").or(m.get("Source")).cloned().filter(|s| !s.is_empty()),
                available: None,
            }
        })
        .filter(|p| !p.id.is_empty())
        .collect();

    Ok(packages)
}

/// List installed packages
pub async fn list_installed() -> Result<Vec<Package>, String> {
    let output = run_winget(&["list"]).await?;
    let rows = parse_table_as_map(&output);

    let packages = rows
        .into_iter()
        .map(|m| {
            Package {
                name: m.get("名称").or(m.get("Name")).cloned().unwrap_or_default(),
                id: m.get("ID").cloned().unwrap_or_default(),
                version: m.get("版本").or(m.get("Version")).cloned().unwrap_or_default(),
                available: m.get("可用").or(m.get("Available")).cloned().filter(|s| !s.is_empty()),
                source: m.get("源").or(m.get("Source")).cloned().filter(|s| !s.is_empty()),
                matched: None,
            }
        })
        .filter(|p| {
            // Keep it if it has a valid ID
            if p.id.is_empty() { return false; }
            // If it's not from a recognized source, it might be a legacy app
            // The user wants to hide these if they aren't "from winget"
            // But some users might see '-' as source for apps that ARE manageable.
            // Let's be less strict: only hide if source is completely missing AND it looks like a legacy ID
            let src = p.source.as_deref().unwrap_or("");
            if src == "" || src == "-" {
                // If ID is same as name, it's likely a legacy registry entry
                if p.id == p.name { return false; }
            }
            true
        })
        .collect();

    Ok(packages)
}

/// Check for available upgrades
pub async fn check_upgrades() -> Result<Vec<Package>, String> {
    let output = run_winget(&["upgrade", "--accept-source-agreements"]).await?;
    let rows = parse_table_as_map(&output);

    let packages = rows
        .into_iter()
        .map(|m| {
            Package {
                name: m.get("名称").or(m.get("Name")).cloned().unwrap_or_default(),
                id: m.get("ID").cloned().unwrap_or_default(),
                version: m.get("版本").or(m.get("Version")).cloned().unwrap_or_default(),
                available: m.get("可用").or(m.get("Available")).cloned().filter(|s| !s.is_empty()),
                source: m.get("源").or(m.get("Source")).cloned().filter(|s| !s.is_empty()),
                matched: None,
            }
        })
        .filter(|p| !p.id.is_empty())
        .collect();

    Ok(packages)
}

/// Get package details
pub async fn show_package(id: &str) -> Result<PackageDetail, String> {
    let output = run_winget(&["show", "--id", id]).await?;

    let mut detail = PackageDetail {
        name: String::new(),
        id: id.to_string(),
        version: String::new(),
        publisher: String::new(),
        description: String::new(),
        homepage: String::new(),
        license: String::new(),
    };

    for line in output.lines() {
        let line = line.trim();
        // Handle both English and Chinese field names
        if let Some(val) = extract_field(line, &["名称:", "Name:"]) {
            detail.name = val;
        } else if let Some(val) = extract_field(line, &["版本:", "Version:"]) {
            detail.version = val;
        } else if let Some(val) = extract_field(line, &["发布者:", "Publisher:", "发行商:"]) {
            detail.publisher = val;
        } else if let Some(val) = extract_field(line, &["描述:", "Description:"]) {
            detail.description = val;
        } else if let Some(val) = extract_field(line, &["主页:", "Homepage:", "发行商 URL:", "Publisher Url:"]) {
            if detail.homepage.is_empty() {
                detail.homepage = val;
            }
        } else if let Some(val) = extract_field(line, &["许可证:", "License:", "协议:"]) {
            detail.license = val;
        }
    }

    Ok(detail)
}

fn extract_field(line: &str, prefixes: &[&str]) -> Option<String> {
    for prefix in prefixes {
        if line.starts_with(prefix) {
            return Some(line[prefix.len()..].trim().to_string());
        }
    }
    None
}

/// Run a winget command, stream stdout, and emit progress events.
async fn run_winget_with_progress(args: &[&str], app: &tauri::AppHandle, id: &str) -> Result<String, String> {
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let app_handle = app.clone();
    let pkg_id = id.to_string();

    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("winget");
        cmd.args(&args_owned)
            .args(&["--accept-source-agreements", "--disable-interactivity"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn winget: {}", e))?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let mut reader = BufReader::new(stdout);
        let mut output_str = String::new();
        
        let mut line_buf = Vec::new();
        use std::io::Read;
        let mut buffer = [0u8; 1];
        
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 { break; }
            let b = buffer[0];
            line_buf.push(b);
            
            if b == b'\r' || b == b'\n' {
                // Try UTF-8 first, fallback to GBK
                let decoded = String::from_utf8(line_buf.clone()).unwrap_or_else(|_| {
                    let (cow, _, _) = encoding_rs::GBK.decode(&line_buf);
                    cow.into_owned()
                });
                
                output_str.push_str(&decoded);
                
                let blocks = decoded.chars().filter(|&ch| ch == '█' || ch == '▒').count();
                if blocks > 0 {
                    let filled = decoded.chars().filter(|&ch| ch == '█').count();
                    let progress = (filled as f64 / blocks as f64) * 100.0;
                    let _ = app_handle.emit("download-progress", ProgressPayload {
                        id: pkg_id.clone(),
                        progress,
                    });
                } else if decoded.contains("安装") || decoded.contains("Installing") || decoded.contains("uninstall") || decoded.contains("卸载") {
                    // When installation/uninstallation starts, set progress to 100%
                    let _ = app_handle.emit("download-progress", ProgressPayload {
                        id: pkg_id.clone(),
                        progress: 100.0,
                    });
                }
                
                line_buf.clear();
            }
        }

        let _ = child.wait();
        Ok(output_str)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Install a package
pub async fn install_package(id: &str, version: Option<String>, settings: WingetSettings, app: tauri::AppHandle) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec!["install".to_string(), "--id".to_string(), id.to_string(), "--accept-package-agreements".to_string(), "--accept-source-agreements".to_string()];
    base_args.extend(settings.install_args());
    if let Some(ref v) = version {
        base_args.push("--version".to_string());
        base_args.push(v.clone());
    }
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let output = run_winget_with_progress(&args_refs, &app, id).await?;

    let success = output.contains("成功") || output.contains("Successfully") || output.contains("successfully");

    Ok(OperationResult {
        success,
        message: if success {
            format!("Successfully installed {}", id)
        } else {
            format!("Failed to install {}", id)
        },
        output,
    })
}

/// Get available versions for a package
pub async fn get_package_versions(id: &str) -> Result<Vec<String>, String> {
    let output = run_winget(&["show", id, "--versions"]).await?;
    
    let lines: Vec<&str> = output.lines().map(|l| {
        match l.rfind('\r') {
            Some(idx) => &l[idx + 1..],
            None => l,
        }
    }).collect();
    
    let sep_idx = lines.iter().position(|l| {
        let trimmed = l.trim();
        !trimmed.is_empty() && trimmed.chars().all(|c| c == '-')
    });
    
    if let Some(idx) = sep_idx {
        let versions: Vec<String> = lines.iter()
            .skip(idx + 1)
            .map(|l| l.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        Ok(versions)
    } else {
        Ok(Vec::new())
    }
}

/// Uninstall a package
pub async fn uninstall_package(id: &str, settings: WingetSettings, app: tauri::AppHandle) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec!["uninstall".to_string(), "--id".to_string(), id.to_string()];
    base_args.extend(settings.uninstall_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let mut output = run_winget_with_progress(&args_refs, &app, id).await?;

    // If winget couldn't find it by ID (common for some legacy registry apps), fallback to exact name matching
    if output.contains("找不到") || output.contains("No installed package") || output.contains("No packages found") {
        let mut fallback_args: Vec<String> = vec!["uninstall".to_string(), "--exact".to_string(), "--name".to_string(), id.to_string()];
        fallback_args.extend(settings.uninstall_args());
        let fallback_refs: Vec<&str> = fallback_args.iter().map(|s| s.as_str()).collect();
        let fallback_output = run_winget_with_progress(&fallback_refs, &app, id).await?;
        output = format!("{}\n[Fallback to Name Match]\n{}", output, fallback_output);
        
        // If exact name matching also fails, fallback to fuzzy matching
        if fallback_output.contains("找不到") || fallback_output.contains("No installed package") || fallback_output.contains("No packages found") {
            let mut fuzzy_args: Vec<String> = vec!["uninstall".to_string(), id.to_string()];
            fuzzy_args.extend(settings.uninstall_args());
            let fuzzy_refs: Vec<&str> = fuzzy_args.iter().map(|s| s.as_str()).collect();
            let fuzzy_output = run_winget_with_progress(&fuzzy_refs, &app, id).await?;
            output = format!("{}\n[Fallback to Fuzzy Match]\n{}", output, fuzzy_output);
        }
    }

    let success = output.contains("成功") || output.contains("Successfully") || output.contains("successfully");

    Ok(OperationResult {
        success,
        message: if success {
            format!("Successfully uninstalled {}", id)
        } else {
            format!("Failed to uninstall {}", id)
        },
        output,
    })
}

/// Upgrade a package
pub async fn upgrade_package(id: &str, settings: WingetSettings, app: tauri::AppHandle) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec!["upgrade".to_string(), "--id".to_string(), id.to_string(), "--accept-package-agreements".to_string(), "--accept-source-agreements".to_string()];
    base_args.extend(settings.upgrade_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let output = run_winget_with_progress(&args_refs, &app, id).await?;

    let success = output.contains("成功") || output.contains("Successfully") || output.contains("successfully");

    Ok(OperationResult {
        success,
        message: if success {
            format!("Successfully upgraded {}", id)
        } else {
            format!("Failed to upgrade {}", id)
        },
        output,
    })
}

/// Upgrade all packages
pub async fn upgrade_all(settings: WingetSettings) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec!["upgrade".to_string(), "--all".to_string(), "--accept-package-agreements".to_string(), "--accept-source-agreements".to_string()];
    base_args.extend(settings.upgrade_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let output = run_winget(&args_refs).await?;

    let success = output.contains("成功") || output.contains("Successfully") || output.contains("successfully");

    Ok(OperationResult {
        success,
        message: if success {
            "All packages upgraded successfully".to_string()
        } else {
            "Some packages may have failed to upgrade".to_string()
        },
        output,
    })
}

/// Get winget version
pub async fn get_winget_version() -> Result<String, String> {
    let output = run_winget(&["--version"]).await?;
    Ok(output.trim().to_string())
}

/// Install winget environment
pub async fn install_winget_env() -> Result<OperationResult, String> {
    let script = r#"
        $ErrorActionPreference = 'Stop';
        $ProgressPreference = 'SilentlyContinue';
        $tempPath = Join-Path $env:TEMP "winget.msixbundle";
        Invoke-WebRequest -Uri "https://github.com/microsoft/winget-cli/releases/latest/download/Microsoft.DesktopAppInstaller_8wekyb3d8bbwe.msixbundle" -OutFile $tempPath;
        Add-AppxPackage -Path $tempPath;
    "#;

    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("powershell");
        cmd.args(&["-NoProfile", "-NonInteractive", "-Command", script])
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());
           
        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        
        let output = cmd.output().map_err(|e| format!("Failed to run powershell: {}", e))?;
        
        if output.status.success() {
            Ok(OperationResult {
                success: true,
                message: "Winget installed successfully".to_string(),
                output: String::from_utf8_lossy(&output.stdout).into_owned(),
            })
        } else {
            let err = String::from_utf8_lossy(&output.stderr).into_owned();
            Err(format!("Install failed: {}", err))
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
