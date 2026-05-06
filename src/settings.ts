// Winget command settings - persisted via localStorage

export interface WingetSettings {
  // install
  install_mode: "silent" | "interactive" | "default";
  install_scope: "user" | "machine" | "default";
  install_architecture: "x64" | "x86" | "arm64" | "default";
  install_location: string; // empty = default
  install_force: boolean;
  // upgrade
  upgrade_mode: "silent" | "interactive" | "default";
  upgrade_include_unknown: boolean;
  upgrade_force: boolean;
  // uninstall
  uninstall_mode: "silent" | "interactive" | "default";
  uninstall_purge: boolean;
  // search
  search_count: number; // 0 = no limit
  search_exact: boolean;
  search_source: "winget" | "msstore" | "default";
}

const STORAGE_KEY = "breeze-winget-settings";

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
  uninstall_purge: false,
  search_count: 0,
  search_exact: false,
  search_source: "default",
};

export function loadSettings(): WingetSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: WingetSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
