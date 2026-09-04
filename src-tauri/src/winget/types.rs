use serde::{Deserialize, Serialize};

/// Represents a package returned by winget search, list, or upgrade queries.
///
/// This struct maps directly to the TypeScript interface `Package` defined in `src/types/package.ts`.
/// Optional fields use `skip_serializing_if = "Option::is_none"` to match frontend expectations
/// where absent fields evaluate to `undefined` rather than `null`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Package {
    /// Human-readable display name of the software package.
    pub name: String,

    /// Unique package identifier in the winget repository or Windows registry (e.g. "Microsoft.VisualStudioCode").
    pub id: String,

    /// Currently installed version, or repository latest version in search results.
    pub version: String,

    /// Available upgrade version if an update is detected, or `None` if up-to-date or in search.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available: Option<String>,

    /// Source repository where the package originates (e.g., "winget", "msstore"), or `None`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    /// Matched search term or alias when the package was retrieved via search query.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub matched: Option<String>,
}

/// Detailed metadata for a specific package, retrieved via `winget show --id <id>`.
///
/// Maps directly to the TypeScript interface `PackageDetail` in `src/types/package.ts`.
/// When a metadata field is omitted in the upstream winget manifest, it defaults to an empty string.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageDetail {
    /// Human-readable display name of the software package.
    pub name: String,

    /// Unique package identifier (e.g. "Git.Git").
    pub id: String,

    /// Package version string.
    pub version: String,

    /// Publisher or vendor organization name.
    pub publisher: String,

    /// Summary description of the package and its functionality.
    pub description: String,

    /// Official homepage or product website URL.
    pub homepage: String,

    /// Software licensing terms (e.g. "GPL-2.0", "MIT", "Proprietary").
    pub license: String,
}

/// Standardized operation result returned by mutating winget operations.
///
/// Returned by `install_package`, `uninstall_package`, `upgrade_package`,
/// `upgrade_all`, and `install_winget_env`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OperationResult {
    /// Whether the winget CLI operation succeeded (exit code 0 or successful fallback).
    pub success: bool,

    /// User-friendly summary message indicating operation status.
    pub message: String,

    /// Raw combined terminal output (stdout and stderr) for debugging or display.
    pub output: String,
}

/// Asynchronous download and installation progress payload emitted to the frontend.
///
/// Sent over the `"download-progress"` Tauri event channel during package mutations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProgressPayload {
    /// Unique package identifier being installed or updated.
    pub id: String,

    /// Operation progress percentage, ranging from 0.0 to 100.0.
    pub progress: f64,
}

/// Application error type representing domain errors in winget operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppError {
    /// Human-readable error description.
    pub message: String,

    /// Optional process exit code or OS error number.
    pub code: Option<i32>,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AppError {}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self { message, code: None }
    }
}

impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        Self {
            message: message.to_string(),
            code: None,
        }
    }
}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.message
    }
}

/// User-configurable winget execution preferences and CLI flag generators.
///
/// # Serialization Contract
/// All 13 fields MUST strictly maintain `snake_case` serialization.
/// Both frontend (`src/settings.ts`) and backend (`src-tauri/src/winget/types.rs`)
/// exchange these settings over Tauri IPC in `snake_case`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WingetSettings {
    /// Installation interactivity mode: "silent", "interactive", or "default".
    pub install_mode: String,

    /// Target installation scope: "user", "machine", or "default".
    pub install_scope: String,

    /// Preferred CPU architecture: "x64", "x86", "arm64", or "default".
    pub install_architecture: String,

    /// Custom target installation directory path, or empty for default.
    pub install_location: String,

    /// Whether to pass `--force` flag during installation.
    pub install_force: bool,

    /// Upgrade interactivity mode: "silent", "interactive", or "default".
    pub upgrade_mode: String,

    /// Whether to pass `--include-unknown` during package upgrades.
    pub upgrade_include_unknown: bool,

    /// Whether to pass `--force` flag during package upgrades.
    pub upgrade_force: bool,

    /// Uninstallation interactivity mode: "silent", "interactive", or "default".
    pub uninstall_mode: String,

    /// Whether to pass `--purge` flag during uninstallation to remove all data.
    pub uninstall_purge: bool,

    /// Maximum number of search results to retrieve (0 disables limit).
    pub search_count: u32,

    /// Whether to enforce exact matching (`--exact`) in search queries.
    pub search_exact: bool,

    /// Source repository filter for search ("winget", "msstore", or "default").
    pub search_source: String,
}

impl WingetSettings {
    /// Converts an interactivity mode string into CLI flags.
    fn mode_args(&self, mode: &str) -> Vec<String> {
        match mode {
            "silent" => vec!["--silent".to_string()],
            "interactive" => vec!["--interactive".to_string()],
            _ => vec![],
        }
    }

    /// Generates CLI arguments for `winget install`.
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

    /// Generates CLI arguments for `winget upgrade`.
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

    /// Generates CLI arguments for `winget uninstall`.
    pub fn uninstall_args(&self) -> Vec<String> {
        let mut args = self.mode_args(&self.uninstall_mode);
        if self.uninstall_purge {
            args.push("--purge".to_string());
        }
        args
    }

    /// Generates CLI arguments for `winget search`.
    pub fn search_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        if self.search_count > 0 {
            args.push("--count".to_string());
            args.push(self.search_count.to_string());
        }
        if self.search_exact {
            args.push("--exact".to_string());
        }
        // Default to winget source to avoid msstore connection timeouts
        args.push("--source".to_string());
        if self.search_source != "default" {
            args.push(self.search_source.clone());
        } else {
            args.push("winget".to_string());
        }
        args
    }
}

impl Default for WingetSettings {
    fn default() -> Self {
        Self {
            install_mode: "silent".to_string(),
            install_scope: "default".to_string(),
            install_architecture: "default".to_string(),
            install_location: String::new(),
            install_force: false,
            upgrade_mode: "silent".to_string(),
            upgrade_include_unknown: false,
            upgrade_force: false,
            uninstall_mode: "silent".to_string(),
            uninstall_purge: false,
            search_count: 50,
            search_exact: false,
            search_source: "default".to_string(),
        }
    }
}

/// Raw execution output from a spawned process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommandOutput {
    /// Decoded standard output text.
    pub stdout: String,

    /// Decoded standard error text.
    pub stderr: String,

    /// Whether the process exited with status code 0.
    pub success: bool,

    /// Process exit status code, or `None` if terminated by signal.
    pub status_code: Option<i32>,
}

impl CommandOutput {
    /// Intelligently combines stdout and stderr into a single formatted string.
    pub fn combined_output(&self) -> String {
        crate::winget::process::combine_output(&self.stdout, &self.stderr)
    }
}
