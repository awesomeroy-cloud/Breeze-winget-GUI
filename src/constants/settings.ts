import { WingetSettings } from "../types";

/**
 * Settings persistence keys, defaults, and option choices.
 * @module constants/settings
 */

/**
 * LocalStorage key for persisting winget configuration.
 */
export const STORAGE_KEY = "breeze-winget-settings";

/**
 * Default winget settings.
 * Preserves uninstall_purge: true and search_count: 0 per project specification.
 */
export const DEFAULT_SETTINGS: WingetSettings = {
  install_mode: "silent",
  install_scope: "default",
  install_architecture: "default",
  install_location: "",
  install_force: false,
  upgrade_mode: "silent",
  upgrade_include_unknown: false,
  upgrade_force: false,
  uninstall_mode: "silent",
  uninstall_purge: true,
  search_count: 0,
  search_exact: false,
  search_source: "default",
};

/**
 * Option descriptors for install/upgrade/uninstall mode dropdowns.
 */
export const EXECUTION_MODES = [
  { value: "silent", label: "静默模式 (Silent)" },
  { value: "interactive", label: "交互模式 (Interactive)" },
  { value: "default", label: "默认模式 (跟随安装包)" },
] as const;

/**
 * Option descriptors for installation scope dropdowns.
 */
export const INSTALL_SCOPES = [
  { value: "default", label: "默认 (Default)" },
  { value: "user", label: "当前用户 (User)" },
  { value: "machine", label: "所有用户 (Machine)" },
] as const;

/**
 * Option descriptors for CPU architecture dropdowns.
 */
export const ARCHITECTURES = [
  { value: "default", label: "默认 (系统原生)" },
  { value: "x64", label: "x64 (64位)" },
  { value: "x86", label: "x86 (32位)" },
  { value: "arm64", label: "ARM64" },
] as const;

/**
 * Option descriptors for search repository source dropdowns.
 */
export const SEARCH_SOURCES = [
  { value: "default", label: "所有来源 (All Sources)" },
  { value: "winget", label: "官方社区源 (winget)" },
  { value: "msstore", label: "微软应用商店 (msstore)" },
] as const;
