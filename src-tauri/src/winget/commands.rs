use crate::winget::parser::{
    extract_field, is_legacy_arp_entry, map_optional_value, map_value, parse_table_as_map,
    parse_version_list,
};
use crate::winget::process::{run_winget, run_winget_output, CREATE_NO_WINDOW};
use crate::winget::progress::run_winget_with_progress;
use crate::winget::types::{OperationResult, Package, PackageDetail, WingetSettings};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Searches for packages matching a query string in configured winget sources.
///
/// Combines the search query with user-defined settings (e.g. source filter, result count, exact matching).
pub async fn search_packages(query: &str, settings: WingetSettings) -> Result<Vec<Package>, String> {
    let mut base_args: Vec<String> =
        vec!["search".to_string(), "--query".to_string(), query.to_string()];
    base_args.extend(settings.search_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let output = run_winget(&args_refs).await?;
    let rows = parse_table_as_map(&output);

    let packages = rows
        .into_iter()
        .map(|m| Package {
            name: map_value(&m, &["Name", "名称"]),
            id: map_value(&m, &["ID", "Id"]),
            version: map_value(&m, &["Version", "版本"]),
            matched: map_optional_value(&m, &["Matched", "匹配"]),
            source: map_optional_value(&m, &["Source", "源"]),
            available: None,
        })
        .filter(|p| !p.id.is_empty())
        .collect();

    Ok(packages)
}

/// Enumerates all installed applications on the Windows host.
///
/// # Technical Nuance: Legacy ARP Registry Filtering
/// Windows `winget list` reports packages from both official package manifests and legacy
/// Add/Remove Programs (ARP) registry entries. Unmanaged legacy entries that have no source
/// repository (`source.is_empty()` or `source == "-"`) and whose synthetic identifier is identical
/// to their display name (`id == name`) are filtered out to avoid unmanageable rows.
pub async fn list_installed() -> Result<Vec<Package>, String> {
    let output = run_winget(&["list"]).await?;
    let rows = parse_table_as_map(&output);

    let packages = rows
        .into_iter()
        .map(|m| Package {
            name: map_value(&m, &["Name", "名称"]),
            id: map_value(&m, &["ID", "Id"]),
            version: map_value(&m, &["Version", "版本"]),
            available: map_optional_value(&m, &["Available", "可用"]),
            source: map_optional_value(&m, &["Source", "源"]),
            matched: None,
        })
        .filter(|p| {
            if p.id.is_empty() {
                return false;
            }
            !is_legacy_arp_entry(&p.id, &p.name, p.source.as_deref())
        })
        .collect();

    Ok(packages)
}

/// Queries available updates for all installed packages.
pub async fn check_upgrades() -> Result<Vec<Package>, String> {
    let output = run_winget(&["upgrade", "--accept-source-agreements"]).await?;
    let rows = parse_table_as_map(&output);

    let packages = rows
        .into_iter()
        .map(|m| Package {
            name: map_value(&m, &["Name", "名称"]),
            id: map_value(&m, &["ID", "Id"]),
            version: map_value(&m, &["Version", "版本"]),
            available: map_optional_value(&m, &["Available", "可用"]),
            source: map_optional_value(&m, &["Source", "源"]),
            matched: None,
        })
        .filter(|p| !p.id.is_empty())
        .collect();

    Ok(packages)
}

/// Retrieves comprehensive metadata details for a specific package.
///
/// Extracts localized labels for both English and Chinese system configurations
/// (e.g. "Publisher" vs "发布者" / "发行商").
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
        if let Some(val) = extract_field(line, &["名称:", "Name:"]) {
            detail.name = val;
        } else if let Some(val) = extract_field(line, &["版本:", "Version:"]) {
            detail.version = val;
        } else if let Some(val) = extract_field(line, &["发布者:", "Publisher:", "发行商:"]) {
            detail.publisher = val;
        } else if let Some(val) = extract_field(line, &["描述:", "Description:"]) {
            detail.description = val;
        } else if let Some(val) =
            extract_field(line, &["主页:", "Homepage:", "发行商 URL:", "Publisher Url:"])
        {
            if detail.homepage.is_empty() {
                detail.homepage = val;
            }
        } else if let Some(val) = extract_field(line, &["许可证:", "License:", "协议:"]) {
            detail.license = val;
        }
    }

    Ok(detail)
}

/// Retrieves the list of available versions for a package.
pub async fn get_package_versions(id: &str) -> Result<Vec<String>, String> {
    let output = run_winget(&["show", id, "--versions"]).await?;
    Ok(parse_version_list(&output))
}

/// Installs a specified package with optional version constraints and execution preferences.
///
/// Streams real-time progress events to the frontend over `"download-progress"`.
pub async fn install_package(
    id: &str,
    version: Option<String>,
    settings: WingetSettings,
    app: tauri::AppHandle,
) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec![
        "install".to_string(),
        "--id".to_string(),
        id.to_string(),
        "--accept-package-agreements".to_string(),
        "--accept-source-agreements".to_string(),
    ];
    base_args.extend(settings.install_args());
    if let Some(ref v) = version {
        base_args.push("--version".to_string());
        base_args.push(v.clone());
    }
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let command_output = run_winget_with_progress(&args_refs, &app, id).await?;
    let output = command_output.combined_output();
    let success = command_output.success;

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

/// Uninstalls a package using a resilient 3-tier fallback strategy.
///
/// # Technical Nuance: Three-Tier Uninstall Fallback Heuristics
/// Packages registered in the Windows Add/Remove Programs (ARP) registry by legacy installers
/// (such as Inno Setup, InstallShield, NSIS, or MSI) frequently cannot be uninstalled using
/// their synthetic winget ID (`--id <id>`).
///
/// To provide maximum resilience in the graphical user interface, this function implements
/// a cascading 3-tier fallback sequence:
///
/// 1. **Tier 1 (Exact ID)**: Attempts standard uninstallation via `winget uninstall --id <id>`.
/// 2. **Tier 2 (Exact Name)**: If Tier 1 fails or indicates package not found ("No installed package" /
///    "No packages found"), attempts `winget uninstall --exact --name <id>`.
/// 3. **Tier 3 (Fuzzy Match)**: If Tier 2 also fails, falls back to fuzzy string matching via
///    `winget uninstall <id>`.
///
/// The aggregated output records each fallback attempt, giving complete diagnostic visibility.
pub async fn uninstall_package(
    id: &str,
    settings: WingetSettings,
    app: tauri::AppHandle,
) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> =
        vec!["uninstall".to_string(), "--id".to_string(), id.to_string()];
    base_args.extend(settings.uninstall_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let command_output = run_winget_with_progress(&args_refs, &app, id).await?;
    let mut output = command_output.combined_output();
    let mut success = command_output.success;

    // Some legacy registry apps are only removable by name or fuzzy matching.
    if !success || output.contains("No installed package") || output.contains("No packages found") {
        let mut fallback_args: Vec<String> = vec![
            "uninstall".to_string(),
            "--exact".to_string(),
            "--name".to_string(),
            id.to_string(),
        ];
        fallback_args.extend(settings.uninstall_args());
        let fallback_refs: Vec<&str> = fallback_args.iter().map(|s| s.as_str()).collect();
        let fallback_command_output = run_winget_with_progress(&fallback_refs, &app, id).await?;
        let fallback_output = fallback_command_output.combined_output();
        success = fallback_command_output.success;
        output = format!("{}\n[Fallback to Name Match]\n{}", output, fallback_output);

        if !success
            || fallback_output.contains("No installed package")
            || fallback_output.contains("No packages found")
        {
            let mut fuzzy_args: Vec<String> = vec!["uninstall".to_string(), id.to_string()];
            fuzzy_args.extend(settings.uninstall_args());
            let fuzzy_refs: Vec<&str> = fuzzy_args.iter().map(|s| s.as_str()).collect();
            let fuzzy_command_output = run_winget_with_progress(&fuzzy_refs, &app, id).await?;
            let fuzzy_output = fuzzy_command_output.combined_output();
            success = fuzzy_command_output.success;
            output = format!("{}\n[Fallback to Fuzzy Match]\n{}", output, fuzzy_output);
        }
    }

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

/// Upgrades a single package to its latest available version.
pub async fn upgrade_package(
    id: &str,
    settings: WingetSettings,
    app: tauri::AppHandle,
) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec![
        "upgrade".to_string(),
        "--id".to_string(),
        id.to_string(),
        "--accept-package-agreements".to_string(),
        "--accept-source-agreements".to_string(),
    ];
    base_args.extend(settings.upgrade_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let command_output = run_winget_with_progress(&args_refs, &app, id).await?;
    let output = command_output.combined_output();
    let success = command_output.success;

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

/// Upgrades all upgradable packages on the local system.
pub async fn upgrade_all(settings: WingetSettings) -> Result<OperationResult, String> {
    let mut base_args: Vec<String> = vec![
        "upgrade".to_string(),
        "--all".to_string(),
        "--accept-package-agreements".to_string(),
        "--accept-source-agreements".to_string(),
    ];
    base_args.extend(settings.upgrade_args());
    let args_refs: Vec<&str> = base_args.iter().map(|s| s.as_str()).collect();
    let command_output = run_winget_output(&args_refs).await?;
    let output = command_output.combined_output();
    let success = command_output.success;

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

/// Retrieves the installed version string of the `winget` CLI binary.
pub async fn get_winget_version() -> Result<String, String> {
    let output = run_winget(&["--version"]).await?;
    Ok(output.trim().to_string())
}

/// Bootstraps and installs the official Windows Package Manager environment.
///
/// # Technical Nuance: Headless PowerShell Bootstrap for `DesktopAppInstaller`
/// On Windows systems where `winget` is missing, uninstalled, or corrupted, this command downloads
/// Microsoft's official `Microsoft.DesktopAppInstaller` `.msixbundle` directly from the official
/// GitHub releases repository and registers it using PowerShell's `Add-AppxPackage` cmdlet.
///
/// To execute reliably without user prompts or flashing terminal windows:
/// - Executes PowerShell with `-NoProfile` and `-NonInteractive` flags.
/// - Sets `$ErrorActionPreference = 'Stop'` to immediately abort and bubble errors on network failure.
/// - Sets `$ProgressPreference = 'SilentlyContinue'` to prevent PowerShell download stream corruption.
/// - Suppresses window creation with Win32 flag `CREATE_NO_WINDOW` (`0x08000000`).
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
        cmd.args(["-NoProfile", "-NonInteractive", "-Command", script])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to run powershell: {}", e))?;

        if output.status.success() {
            Ok(OperationResult {
                success: true,
                message: "Winget installed successfully".to_string(),
                output: String::from_utf8_lossy(&output.stdout).into_owned(),
            })
        } else {
            let err = String::from_utf8_lossy(&output.stderr).into_owned();
            Ok(OperationResult {
                success: false,
                message: format!("Install failed: {}", err),
                output: String::from_utf8_lossy(&output.stdout).into_owned(),
            })
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
