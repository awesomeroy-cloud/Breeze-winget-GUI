import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPackageIcon } from "../src/utils/icon";
import { copyToClipboard } from "../src/utils/clipboard";
import { TOAST_ICONS, DEFAULT_PACKAGE_ICON, NAV_ITEMS } from "../src/constants";

describe("utils/icon", () => {
  it("resolves correct emoji for development tools", () => {
    expect(getPackageIcon("Visual Studio Code")).toBe("💻");
    expect(getPackageIcon("Sublime Text")).toBe("💻");
    expect(getPackageIcon("Cursor")).toBe("💻");
  });

  it("resolves correct emoji for browsers", () => {
    expect(getPackageIcon("Google Chrome")).toBe("🌐");
    expect(getPackageIcon("Mozilla Firefox")).toBe("🌐");
    expect(getPackageIcon("Microsoft Edge")).toBe("🌐");
  });

  it("resolves correct emoji for git version control", () => {
    expect(getPackageIcon("Git", "Git.Git")).toBe("🔀");
    expect(getPackageIcon("GitHub Desktop")).toBe("🔀");
  });

  it("resolves correct emoji for programming languages and runtimes", () => {
    expect(getPackageIcon("Node.js")).toBe("⚡");
    expect(getPackageIcon("Python 3.12")).toBe("⚡");
    expect(getPackageIcon("Rust (MSVC)")).toBe("⚡");
  });

  it("resolves using package ID when name does not contain keyword", () => {
    expect(getPackageIcon("Unknown App", "Microsoft.VisualStudioCode")).toBe("💻");
  });

  it("falls back to default package icon when no rule matches", () => {
    expect(getPackageIcon("SomeRandomAppxyz123")).toBe(DEFAULT_PACKAGE_ICON);
    expect(getPackageIcon("")).toBe(DEFAULT_PACKAGE_ICON);
  });
});

describe("utils/clipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when writeText succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await copyToClipboard("sample text to copy");
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("sample text to copy");
  });

  it("returns false when clipboard API throws error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await copyToClipboard("sample text");
    expect(result).toBe(false);
  });

  it("returns false when navigator.clipboard is undefined", async () => {
    vi.stubGlobal("navigator", {});

    const result = await copyToClipboard("sample text");
    expect(result).toBe(false);
  });
});

describe("constants integrity", () => {
  it("defines warning icon in TOAST_ICONS", () => {
    expect(TOAST_ICONS.warning).toBe("⚠️");
    expect(TOAST_ICONS.success).toBe("✅");
    expect(TOAST_ICONS.error).toBe("❌");
    expect(TOAST_ICONS.info).toBe("ℹ️");
  });

  it("defines all four primary navigation routes", () => {
    const ids = NAV_ITEMS.map((item) => item.id);
    expect(ids).toEqual(["discover", "installed", "updates", "settings"]);
  });
});
