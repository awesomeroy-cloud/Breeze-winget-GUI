import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../src/settings";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

describe("settings persistence", () => {
  let storage: ReturnType<typeof createStorage>;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("localStorage", storage);
  });

  it("returns defaults when no settings are stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored partial settings with defaults", () => {
    storage.setItem(
      "breeze-winget-settings",
      JSON.stringify({
        install_mode: "interactive",
        search_count: 25,
      }),
    );

    expect(loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      install_mode: "interactive",
      search_count: 25,
    });
  });

  it("falls back to defaults when stored JSON is invalid", () => {
    storage.setItem("breeze-winget-settings", "{not-json");

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("saves settings as JSON", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      uninstall_purge: false,
      search_source: "winget" as const,
    };

    saveSettings(settings);

    expect(storage.setItem).toHaveBeenCalledWith(
      "breeze-winget-settings",
      JSON.stringify(settings),
    );
  });
});
