/**
 * Winget execution settings configuration types.
 * @module types/settings
 */

/**
 * User-configurable settings mapped to CLI arguments for winget commands.
 * Field names strictly use snake_case to match backend serde deserialization.
 */
export interface WingetSettings {
  /** Installation display mode flag */
  install_mode: "silent" | "interactive" | "default";
  /** Target installation scope */
  install_scope: "user" | "machine" | "default";
  /** Binary target CPU architecture */
  install_architecture: "x64" | "x86" | "arm64" | "default";
  /** Custom installation directory path (empty string denotes winget default) */
  install_location: string;
  /** Force direct install even if winget detects potential conflicts */
  install_force: boolean;
  /** Upgrade display mode flag */
  upgrade_mode: "silent" | "interactive" | "default";
  /** Whether to include unknown/unpinned versions during upgrade checks */
  upgrade_include_unknown: boolean;
  /** Force direct upgrade */
  upgrade_force: boolean;
  /** Uninstallation display mode flag */
  uninstall_mode: "silent" | "interactive" | "default";
  /** Whether to purge user configuration and app data upon uninstall */
  uninstall_purge: boolean;
  /** Maximum number of results returned by search (0 means unlimited) */
  search_count: number;
  /** Whether to enforce exact query matching during search */
  search_exact: boolean;
  /** Target source repository filter for searches */
  search_source: "winget" | "msstore" | "default";
}
