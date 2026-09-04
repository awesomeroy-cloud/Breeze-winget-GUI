import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPackageIcon } from "../src/utils/icon";
import { copyToClipboard } from "../src/utils/clipboard";
import {
  TOAST_ICONS,
  DEFAULT_PACKAGE_ICON,
  PACKAGE_ICON_RULES,
  NAV_ITEMS,
  DEFAULT_SETTINGS,
} from "../src/constants";
import { ToastType } from "../src/types";

describe("Stress Test — getPackageIcon (src/utils/icon.ts)", () => {
  describe("Known Categories Resolution", () => {
    it("resolves development / code tools matching keyword rules correctly", () => {
      const codeTools = [
        "Visual Studio Code",
        "VSCode",
        "Sublime Text 4",
        "Cursor AI",
        "Android Studio",
        "IntelliJ IDEA Ultimate", // contains "ide"
      ];
      for (const name of codeTools) {
        expect(getPackageIcon(name)).toBe("💻");
      }
    });

    it("falls back to default icon for development tools not matching keyword heuristics", () => {
      // Tools like WebStorm and CLion do not contain keywords in PACKAGE_ICON_RULES, thus correctly fallback
      expect(getPackageIcon("WebStorm")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("CLion")).toBe(DEFAULT_PACKAGE_ICON);
    });

    it("resolves git version control tools correctly", () => {
      const gitTools = [
        "Git",
        "GitHub Desktop",
        "GitLab Runner",
        "TortoiseGit",
        "GitKraken",
      ];
      for (const name of gitTools) {
        expect(getPackageIcon(name)).toBe("🔀");
      }
    });

    it("resolves web browsers correctly", () => {
      const browsers = [
        "Google Chrome",
        "Mozilla Firefox",
        "Microsoft Edge",
        "Brave Browser",
        "Opera GX",
        "Apple Safari",
      ];
      for (const name of browsers) {
        expect(getPackageIcon(name)).toBe("🌐");
      }
    });

    it("resolves media tools correctly", () => {
      expect(getPackageIcon("VLC")).toBe("🎬");
      expect(getPackageIcon("FFmpeg CLI")).toBe("🎬");
      expect(getPackageIcon("Spotify Music")).toBe("🎵");
      expect(getPackageIcon("Apple Music")).toBe("🎵");
      expect(getPackageIcon("Netease Cloud Music")).toBe("🎵");
    });

    it("resolves chat / communication tools correctly", () => {
      const chatApps = [
        "Discord",
        "Telegram Desktop",
        "WeChat",
        "QQ",
        "Slack",
        "Microsoft Teams",
        "WhatsApp Desktop",
      ];
      for (const name of chatApps) {
        expect(getPackageIcon(name)).toBe("💬");
      }
    });

    it("resolves gaming platforms correctly", () => {
      const games = [
        "Steam",
        "Epic Games Launcher",
        "Battle.net",
        "Ubisoft Uplay",
        "EA Origin",
        "Riot Client",
      ];
      for (const name of games) {
        expect(getPackageIcon(name)).toBe("🎮");
      }
    });
  });

  describe("Case Sensitivity & Casing Variations", () => {
    it("handles ALL UPPERCASE, all lowercase, and mIxEd CaSe strings", () => {
      expect(getPackageIcon("VISUAL STUDIO CODE")).toBe("💻");
      expect(getPackageIcon("visual studio code")).toBe("💻");
      expect(getPackageIcon("vIsUaL sTuDiO cOdE")).toBe("💻");

      expect(getPackageIcon("GITHUB DESKTOP")).toBe("🔀");
      expect(getPackageIcon("github desktop")).toBe("🔀");
      expect(getPackageIcon("GiThUb DeSkToP")).toBe("🔀");

      expect(getPackageIcon("GOOGLE CHROME")).toBe("🌐");
      expect(getPackageIcon("google chrome")).toBe("🌐");
      expect(getPackageIcon("GoOgLe ChRoMe")).toBe("🌐");

      expect(getPackageIcon("DISCORD")).toBe("💬");
      expect(getPackageIcon("discord")).toBe("💬");
      expect(getPackageIcon("DiScOrD")).toBe("💬");

      expect(getPackageIcon("STEAM")).toBe("🎮");
      expect(getPackageIcon("steam")).toBe("🎮");
      expect(getPackageIcon("StEaM")).toBe("🎮");
    });

    it("handles casing in package IDs", () => {
      expect(getPackageIcon("GenericApp", "MICROSOFT.VISUALSTUDIOCODE")).toBe("💻");
      expect(getPackageIcon("GenericApp", "git.git")).toBe("🔀");
      expect(getPackageIcon("GenericApp", "Google.CHROME")).toBe("🌐");
    });
  });

  describe("Numbers, Special Characters, and Punctuation", () => {
    it("handles purely numeric inputs and version numbers", () => {
      expect(getPackageIcon("123456")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("00000")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("Python 3.12.4")).toBe("⚡");
      expect(getPackageIcon("7-Zip 24.05")).toBe("📁");
      expect(getPackageIcon("WinRAR 7.01")).toBe("📁");
    });

    it("handles complex punctuation, brackets, and symbols", () => {
      expect(getPackageIcon("[Unofficial] (Beta) {v1.0} Git-Tool")).toBe("🔀");
      expect(getPackageIcon("Code_OSS-portable.bin")).toBe("💻");
      expect(getPackageIcon("!@#$%^&*()_+~`|}{[]:;?><,./")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("----....____")).toBe(DEFAULT_PACKAGE_ICON);
    });

    it("handles unicode and non-ASCII characters without throwing", () => {
      expect(getPackageIcon("微信 (WeChat)")).toBe("💬");
      expect(getPackageIcon("网易云音乐 (Netease)")).toBe("🎵");
      expect(getPackageIcon("🔥 火狐浏览器 (Firefox)")).toBe("🌐");
      expect(getPackageIcon("🚀 没有任何关键字的应用")).toBe(DEFAULT_PACKAGE_ICON);
    });
  });

  describe("Empty, Whitespace, and Nullish Edge Cases", () => {
    it("returns default fallback icon on empty and whitespace strings", () => {
      expect(getPackageIcon("")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("   ")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("\t\r\n")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("", "")).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("   ", "   ")).toBe(DEFAULT_PACKAGE_ICON);
    });

    it("handles nullish and falsy values gracefully without throwing", () => {
      expect(getPackageIcon(null as unknown as string)).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon(undefined as unknown as string)).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon(null as unknown as string, null as unknown as string)).toBe(
        DEFAULT_PACKAGE_ICON
      );
      expect(
        getPackageIcon(undefined as unknown as string, undefined as unknown as string)
      ).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("", undefined)).toBe(DEFAULT_PACKAGE_ICON);
      expect(getPackageIcon("SomeApp", null as unknown as string)).toBe(DEFAULT_PACKAGE_ICON);
    });
  });

  describe("Unknown Package Fallback", () => {
    it("returns default fallback icon ('📦') for unknown packages", () => {
      const unknownPackages = [
        "UnrelatedInternalEnterpriseTool",
        "XYZ_Random_Software_99",
        "FooBarBazQux",
        "AcmeCorporateHelper",
      ];
      for (const name of unknownPackages) {
        expect(getPackageIcon(name)).toBe("📦");
        expect(getPackageIcon(name, "Acme.Corporate.Helper")).toBe("📦");
      }
    });
  });

  describe("Keyword Rule Integrity & Substring Collision Analysis", () => {
    it("ensures no keyword is empty in PACKAGE_ICON_RULES", () => {
      for (const rule of PACKAGE_ICON_RULES) {
        expect(rule.keywords.length).toBeGreaterThan(0);
        for (const kw of rule.keywords) {
          expect(kw.trim().length).toBeGreaterThan(0);
        }
        expect(rule.icon.trim().length).toBeGreaterThan(0);
      }
    });

    it("evaluates substring matching nuances (e.g. 'video' vs 'ide')", () => {
      // Substring nuance: "video" contains "ide", which matches rule 1 (code/ide: 💻) before rule 7 (video: 🎬)
      // "Video Player" -> contains "ide", resolving to 💻
      expect(getPackageIcon("Video Player")).toBe("💻");
      // However, standalone VLC, Pot, MPV, FFmpeg resolve to 🎬
      expect(getPackageIcon("VLC Player")).toBe("🎵"); // "player" in rule 5 (music)
      expect(getPackageIcon("VLC")).toBe("🎬"); // "vlc" in rule 7
      expect(getPackageIcon("FFmpeg")).toBe("🎬");
    });
  });
});

describe("Stress Test — copyToClipboard (src/utils/clipboard.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Successful Clipboard Writing", () => {
    it("copies standard text successfully", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const result = await copyToClipboard("Hello, Breeze!");
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith("Hello, Breeze!");
    });

    it("copies empty string successfully", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const result = await copyToClipboard("");
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith("");
    });

    it("copies multiline text with LF and CRLF newlines", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const multiline = "Line 1\nLine 2\r\nLine 3\n\nFinal Line";
      const result = await copyToClipboard(multiline);
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith(multiline);
    });

    it("copies massive text payload (100,000 chars) successfully", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const massive = "A".repeat(100_000);
      const result = await copyToClipboard(massive);
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith(massive);
    });

    it("copies emojis, unicode, and symbols", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const special = "📦 🚀 💻 \u0000 \t \n \uD83D\uDE00";
      const result = await copyToClipboard(special);
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith(special);
    });
  });

  describe("Fallback and Failure Resilience", () => {
    it("returns false when navigator is undefined (Node/SSR)", async () => {
      vi.stubGlobal("navigator", undefined);

      const result = await copyToClipboard("some text");
      expect(result).toBe(false);
    });

    it("returns false when navigator.clipboard is undefined (insecure context/HTTP)", async () => {
      vi.stubGlobal("navigator", {});

      const result = await copyToClipboard("some text");
      expect(result).toBe(false);
    });

    it("returns false when navigator.clipboard.writeText is undefined", async () => {
      vi.stubGlobal("navigator", { clipboard: {} });

      const result = await copyToClipboard("some text");
      expect(result).toBe(false);
    });

    it("returns false and catches async rejection when writeText fails (e.g. Permission Denied)", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const writeText = vi.fn().mockRejectedValue(new Error("NotAllowedError: Permission denied"));
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const result = await copyToClipboard("denied text");
      expect(result).toBe(false);
      expect(errSpy).toHaveBeenCalled();
    });

    it("returns false and catches synchronous exceptions during clipboard access", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const writeText = vi.fn().mockImplementation(() => {
        throw new Error("Synchronous crash in clipboard implementation");
      });
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const result = await copyToClipboard("crash text");
      expect(result).toBe(false);
      expect(errSpy).toHaveBeenCalled();
    });

    it("returns false if navigator.clipboard getter throws SecurityError", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const fakeNav = {};
      Object.defineProperty(fakeNav, "clipboard", {
        get() {
          throw new Error("SecurityError: Access forbidden");
        },
      });
      vi.stubGlobal("navigator", fakeNav);

      const result = await copyToClipboard("security error text");
      expect(result).toBe(false);
      expect(errSpy).toHaveBeenCalled();
    });
  });
});

describe("Stress Test — Toast Icons & Constants Integrity", () => {
  it("verifies all four ToastType variants map to non-empty icons in TOAST_ICONS", () => {
    const requiredTypes: ToastType[] = ["success", "error", "info", "warning"];

    for (const type of requiredTypes) {
      const icon = TOAST_ICONS[type];
      expect(icon).toBeDefined();
      expect(typeof icon).toBe("string");
      expect(icon.trim().length).toBeGreaterThan(0);
    }
  });

  it("verifies exact emoji values for each ToastType", () => {
    expect(TOAST_ICONS.success).toBe("✅");
    expect(TOAST_ICONS.error).toBe("❌");
    expect(TOAST_ICONS.info).toBe("ℹ️");
    expect(TOAST_ICONS.warning).toBe("⚠️");
  });

  it("verifies TOAST_ICONS contains no extraneous keys beyond ToastType", () => {
    const keys = Object.keys(TOAST_ICONS).sort();
    expect(keys).toEqual(["error", "info", "success", "warning"]);
  });

  it("verifies DEFAULT_PACKAGE_ICON is '📦'", () => {
    expect(DEFAULT_PACKAGE_ICON).toBe("📦");
  });

  it("verifies NAV_ITEMS configuration integrity", () => {
    expect(NAV_ITEMS.length).toBe(4);
    expect(NAV_ITEMS.map((n) => n.id)).toEqual(["discover", "installed", "updates", "settings"]);
    for (const item of NAV_ITEMS) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });

  it("verifies DEFAULT_SETTINGS integrity and required defaults", () => {
    expect(DEFAULT_SETTINGS.uninstall_purge).toBe(true);
    expect(DEFAULT_SETTINGS.search_count).toBe(0);
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
});
