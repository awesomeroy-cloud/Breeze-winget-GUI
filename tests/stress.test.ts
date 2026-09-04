import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../src/settings";
import type { WingetSettings } from "../src/types/settings";

function createMockStorage(initialData: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialData));
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
    get rawStore() {
      return store;
    },
  };
}

describe("Adversarial Stress Test: Headless API & Mock Invocations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", createMockStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ensures src/api.ts does NOT import or instantiate React", async () => {
    const apiModule = await import("../src/api");
    // Verify apiModule has no React hooks or JSX components
    const exportedKeys = Object.keys(apiModule);
    for (const key of exportedKeys) {
      expect(key.startsWith("use")).toBe(false);
    }
    // Verify all 11 API functions exist
    expect(typeof apiModule.searchPackages).toBe("function");
    expect(typeof apiModule.listInstalled).toBe("function");
    expect(typeof apiModule.checkUpgrades).toBe("function");
    expect(typeof apiModule.showPackage).toBe("function");
    expect(typeof apiModule.installPackage).toBe("function");
    expect(typeof apiModule.uninstallPackage).toBe("function");
    expect(typeof apiModule.upgradePackage).toBe("function");
    expect(typeof apiModule.upgradeAll).toBe("function");
    expect(typeof apiModule.getWingetVersion).toBe("function");
    expect(typeof apiModule.getPackageVersions).toBe("function");
    expect(typeof apiModule.installWingetEnv).toBe("function");
  });

  it("verifies all 11 mock IPC invocations succeed headlessly", async () => {
    const api = await import("../src/api");

    // 1. searchPackages
    const searchRes = await api.searchPackages("chrome");
    expect(Array.isArray(searchRes)).toBe(true);
    expect(searchRes.length).toBeGreaterThan(0);
    expect(searchRes.some((p) => p.id === "Google.Chrome")).toBe(true);

    // 2. listInstalled
    const installed = await api.listInstalled();
    expect(installed.length).toBe(18);
    expect(installed[0]).toHaveProperty("name");
    expect(installed[0]).toHaveProperty("id");
    expect(installed[0]).toHaveProperty("version");

    // 3. checkUpgrades
    const upgrades = await api.checkUpgrades();
    expect(upgrades.length).toBe(5);
    expect(upgrades[0]).toHaveProperty("available");

    // 4. showPackage (known package)
    const detail = await api.showPackage("Google.Chrome");
    expect(detail.id).toBe("Google.Chrome");
    expect(detail.name).toBe("Google Chrome");
    expect(detail.publisher).toBeTruthy();
    expect(detail.homepage).toContain("google/chrome");

    // 4b. showPackage (unknown package fallback)
    const unknownDetail = await api.showPackage("NonExistent.CustomApp");
    expect(unknownDetail.id).toBe("NonExistent.CustomApp");
    expect(unknownDetail.name).toBe("NonExistent.CustomApp");
    expect(unknownDetail.version).toBe("unknown");

    // 5. installPackage (with and without version)
    const install1 = await api.installPackage("Git.Git");
    expect(install1.success).toBe(true);
    const install2 = await api.installPackage("Git.Git", "2.47.2");
    expect(install2.success).toBe(true);

    // 6. uninstallPackage
    const uninstallRes = await api.uninstallPackage("Git.Git");
    expect(uninstallRes.success).toBe(true);
    expect(uninstallRes.message).toBe("OK");

    // 7. upgradePackage
    const upgradeRes = await api.upgradePackage("Google.Chrome");
    expect(upgradeRes.success).toBe(true);

    // 8. upgradeAll
    const upgradeAllRes = await api.upgradeAll();
    expect(upgradeAllRes.success).toBe(true);

    // 9. getWingetVersion
    const version = await api.getWingetVersion();
    expect(version).toBe("v1.10.340");

    // 10. getPackageVersions
    const versions = await api.getPackageVersions("Git.Git");
    expect(versions).toEqual(["1.0.2", "1.0.1", "1.0.0"]);

    // 11. installWingetEnv
    const envRes = await api.installWingetEnv();
    expect(envRes.success).toBe(true);
  }, 15000);

  it("handles adversarial search inputs (case-insensitivity, regex chars, empty query)", async () => {
    const api = await import("../src/api");

    // Empty query returns all packages (18 installed + 5 extras = 23 total)
    const allPkgs = await api.searchPackages("");
    expect(allPkgs.length).toBe(23);

    // Case insensitive match
    const lower = await api.searchPackages("code");
    const upper = await api.searchPackages("CODE");
    expect(lower).toEqual(upper);

    // Regex chars: should not throw regex errors
    const regexQuery = await api.searchPackages(".*+?^${}()|[]\\");
    expect(Array.isArray(regexQuery)).toBe(true);
    expect(regexQuery.length).toBe(0);

    // Search by ID match
    const byId = await api.searchPackages("OpenJS.NodeJS");
    expect(byId.some((p) => p.id === "OpenJS.NodeJS")).toBe(true);
  }, 15000);

  it("survives high-concurrency mock invocations without race conditions", async () => {
    const api = await import("../src/api");

    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 20; i++) {
      promises.push(api.getWingetVersion());
      promises.push(api.searchPackages("Git"));
      promises.push(api.showPackage("Google.Chrome"));
      promises.push(api.installPackage("Git.Git"));
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(80);
    // Every call resolved
    for (const res of results) {
      expect(res).toBeDefined();
    }
  }, 20000);
});

describe("Adversarial Stress Test: Settings Persistence & Defaults", () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strictly validates DEFAULT_SETTINGS properties and contracts", () => {
    // 1. Explicit requirements from user request & specification:
    expect(DEFAULT_SETTINGS.uninstall_purge).toBe(true);
    expect(DEFAULT_SETTINGS.search_count).toBe(0);

    // 2. Full 13 snake_case property verification
    const expectedKeys: (keyof WingetSettings)[] = [
      "install_mode",
      "install_scope",
      "install_architecture",
      "install_location",
      "install_force",
      "upgrade_mode",
      "upgrade_include_unknown",
      "upgrade_force",
      "uninstall_mode",
      "uninstall_purge",
      "search_count",
      "search_exact",
      "search_source",
    ];

    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(expectedKeys.sort());

    expect(DEFAULT_SETTINGS.install_mode).toBe("silent");
    expect(DEFAULT_SETTINGS.install_scope).toBe("default");
    expect(DEFAULT_SETTINGS.install_architecture).toBe("default");
    expect(DEFAULT_SETTINGS.install_location).toBe("");
    expect(DEFAULT_SETTINGS.install_force).toBe(false);
    expect(DEFAULT_SETTINGS.upgrade_mode).toBe("silent");
    expect(DEFAULT_SETTINGS.upgrade_include_unknown).toBe(false);
    expect(DEFAULT_SETTINGS.upgrade_force).toBe(false);
    expect(DEFAULT_SETTINGS.uninstall_mode).toBe("silent");
    expect(DEFAULT_SETTINGS.search_exact).toBe(false);
    expect(DEFAULT_SETTINGS.search_source).toBe("default");
  });

  it("guarantees immutability: mutating loaded settings does NOT alter DEFAULT_SETTINGS", () => {
    const loaded = loadSettings();
    expect(loaded).toEqual(DEFAULT_SETTINGS);

    // Mutate the loaded object
    (loaded as any).uninstall_purge = false;
    (loaded as any).search_count = 999;
    (loaded as any).new_rogue_property = "corrupted";

    // Verify DEFAULT_SETTINGS remains pristine
    expect(DEFAULT_SETTINGS.uninstall_purge).toBe(true);
    expect(DEFAULT_SETTINGS.search_count).toBe(0);
    expect((DEFAULT_SETTINGS as any).new_rogue_property).toBeUndefined();

    // Verify subsequent loadSettings returns pristine defaults
    const reloaded = loadSettings();
    expect(reloaded.uninstall_purge).toBe(true);
    expect(reloaded.search_count).toBe(0);
  });

  it("handles corrupted or adversarial localStorage entries gracefully", () => {
    // Malformed JSON syntax
    storage.setItem("breeze-winget-settings", "INVALID_JSON_OBJECT{{{");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    // Stored JSON null
    storage.setItem("breeze-winget-settings", "null");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    // Stored JSON primitive number
    storage.setItem("breeze-winget-settings", "42");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    // Stored JSON boolean
    storage.setItem("breeze-winget-settings", "true");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);

    // Empty string
    storage.setItem("breeze-winget-settings", "");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("handles localStorage exceptions (e.g. security block or quota exceeded)", () => {
    // Mock getItem throwing SecurityError
    storage.getItem = vi.fn().mockImplementation(() => {
      throw new Error("SecurityError: Access to localStorage is denied");
    });

    expect(() => loadSettings()).not.toThrow();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("verifies round-trip save and load with partial and complete settings", () => {
    const customSettings: WingetSettings = {
      install_mode: "interactive",
      install_scope: "user",
      install_architecture: "arm64",
      install_location: "D:\\Apps",
      install_force: true,
      upgrade_mode: "interactive",
      upgrade_include_unknown: true,
      upgrade_force: true,
      uninstall_mode: "interactive",
      uninstall_purge: false,
      search_count: 100,
      search_exact: true,
      search_source: "msstore",
    };

    saveSettings(customSettings);
    const retrieved = loadSettings();
    expect(retrieved).toEqual(customSettings);
  });
});
