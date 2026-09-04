use std::process::Stdio;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::winget::types::CommandOutput;

/// Win32 process creation flag to prevent console window allocation.
///
/// # Technical Nuance: Windows Creation Flags (`CREATE_NO_WINDOW`)
/// In the Win32 Process Creation API, console subsystem executables (`IMAGE_SUBSYSTEM_WINDOWS_CUI`),
/// such as `winget.exe` or `powershell.exe`, automatically allocate or attach to a console host
/// window (`conhost.exe`) when spawned from a graphical subsystem application (`IMAGE_SUBSYSTEM_WINDOWS_GUI`).
///
/// If this flag is omitted, a black terminal window flashes on the user's desktop every time
/// Breeze performs a background search, query, or upgrade check. Passing `0x08000000`
/// (`CREATE_NO_WINDOW`) via `std::os::windows::process::CommandExt::creation_flags` instructs
/// Windows kernel to execute the child process in a completely headless context.
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Decodes raw byte buffers emitted by Windows child processes into UTF-8 strings,
/// implementing an automatic dual-encoding fallback mechanism.
///
/// # Technical Nuance: Dual-Encoding Fallback (UTF-8 -> GBK / Code Page 936)
/// On English or modern UTF-8 configured Windows environments, console outputs adhere to standard UTF-8.
/// However, on Simplified Chinese editions of Windows (where the active system OEM code page is CP936 / GBK),
/// the `winget` command-line executable outputs strings encoded in GBK.
/// Attempting to unconditionally decode via `String::from_utf8` will encounter `FromUtf8Error` whenever
/// Chinese characters appear in package descriptions or localized terminal prompts.
///
/// This function first attempts lossless UTF-8 conversion. If invalid UTF-8 byte sequences are detected,
/// it invokes `encoding_rs::GBK.decode(...)` to properly decode Simplified Chinese characters, preventing
/// mojibake (乱码) and process panics.
pub fn decode_command_bytes(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap_or_else(|_| {
        let (cow, _, _) = encoding_rs::GBK.decode(bytes);
        cow.into_owned()
    })
}

/// Intelligently concatenates stdout and stderr strings, trimming extraneous whitespace.
///
/// Returns an empty string if both buffers are empty or whitespace-only.
/// If both contain non-whitespace characters, separates them with a newline.
pub fn combine_output(stdout: &str, stderr: &str) -> String {
    match (stdout.trim().is_empty(), stderr.trim().is_empty()) {
        (true, true) => String::new(),
        (false, true) => stdout.to_string(),
        (true, false) => stderr.to_string(),
        (false, false) => format!("{}\n{}", stdout, stderr),
    }
}

/// Formats a comprehensive error message when a command exits with a non-zero status code.
///
/// Includes the executable name, invocation arguments, exit status, and combined terminal output.
pub fn format_command_failure(command: &str, args: &[String], output: &CommandOutput) -> String {
    let status = output
        .status_code
        .map(|code| code.to_string())
        .unwrap_or_else(|| "terminated by signal".to_string());
    let details = output.combined_output();
    if details.trim().is_empty() {
        format!("{} {} failed with exit code {}", command, args.join(" "), status)
    } else {
        format!(
            "{} {} failed with exit code {}\n{}",
            command,
            args.join(" "),
            status,
            details.trim()
        )
    }
}

/// Executes a `winget` CLI command synchronously inside a blocking thread pool task,
/// capturing stdout, stderr, and exit status without opening a console window.
///
/// Global non-interactive flags (`--accept-source-agreements`, `--disable-interactivity`)
/// are appended automatically to ensure the process never blocks on interactive user prompts.
pub async fn run_winget_output(args: &[&str]) -> Result<CommandOutput, String> {
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    tokio::task::spawn_blocking(move || {
        let mut cmd = std::process::Command::new("winget");
        cmd.args(&args_owned)
            .args(["--accept-source-agreements", "--disable-interactivity"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let output = cmd.output().map_err(|e| format!("Failed to run winget: {}", e))?;

        let command_output = CommandOutput {
            stdout: decode_command_bytes(&output.stdout),
            stderr: decode_command_bytes(&output.stderr),
            success: output.status.success(),
            status_code: output.status.code(),
        };

        Ok(command_output)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Executes a `winget` CLI command and returns its decoded standard output string on success.
///
/// If the process fails or exits with a non-zero code, returns an `Err(String)` containing
/// a descriptive failure message generated by [`format_command_failure`].
pub async fn run_winget(args: &[&str]) -> Result<String, String> {
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let command_output = run_winget_output(args).await?;
    if command_output.success {
        Ok(command_output.stdout)
    } else {
        Err(format_command_failure("winget", &args_owned, &command_output))
    }
}
