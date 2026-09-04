//! Windows Package Manager (`winget`) Integration Module for Breeze.
//!
//! This module coordinates process invocation, localized table output parsing,
//! streaming download progress tracking, and high-level package management operations.
//!
//! # Architecture
//! The module is split into focused submodules:
//! - [`types`]: Core data models, IPC payload envelopes, and CLI argument generation.
//! - [`process`]: Process execution, Win32 creation flags, encoding fallback, and error handling.
//! - [`parser`]: Monospace column detection, visual-to-character coordinate mapping, and table parsing.
//! - [`progress`]: Byte-level carriage return stream reading and multi-tier progress heuristics.
//! - [`commands`]: High-level package search, installation, uninstallation, and upgrade workflows.

pub mod commands;
pub mod parser;
pub mod process;
pub mod progress;
pub mod types;

pub use commands::{
    check_upgrades, get_package_versions, get_winget_version, install_package,
    install_winget_env, list_installed, search_packages, show_package, uninstall_package,
    upgrade_all, upgrade_package,
};

pub use types::{OperationResult, Package, PackageDetail, WingetSettings};

#[allow(unused_imports)]
pub use types::{AppError, CommandOutput, EnvInstallProgressPayload, ProgressPayload};

#[cfg(test)]
mod tests;
