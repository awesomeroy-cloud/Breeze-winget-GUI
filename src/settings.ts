import { WingetSettings } from "./types";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "./constants/settings";

/**
 * Winget user preferences persistence layer.
 * @module settings
 */

// Re-export WingetSettings and defaults for 100% backward compatibility
export type { WingetSettings };
export { DEFAULT_SETTINGS };

/**
 * Loads persisted winget preferences from browser localStorage.
 * Automatically merges partial stored configurations with default settings
 * and falls back safely on corrupted JSON data.
 *
 * @returns Complete WingetSettings object
 */
export function loadSettings(): WingetSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Fall back to defaults on JSON syntax error or unavailable storage
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Persists winget preferences to localStorage under the key `"breeze-winget-settings"`.
 *
 * @param settings - Full WingetSettings object to serialize
 */
export function saveSettings(settings: WingetSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
