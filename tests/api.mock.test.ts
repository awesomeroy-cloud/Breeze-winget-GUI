import { beforeEach, describe, expect, it, vi } from "vitest";

function createStorage() {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
}

describe("browser mock API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", createStorage());
  });

  it("searches mock packages by id", async () => {
    const { searchPackages } = await import("../src/api");

    const packages = await searchPackages("Microsoft.VisualStudioCode");

    expect(packages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "Microsoft.VisualStudioCode",
          name: "Visual Studio Code",
        }),
      ]),
    );
  });

  it("reports mock winget version outside Tauri", async () => {
    const { getWingetVersion } = await import("../src/api");

    await expect(getWingetVersion()).resolves.toBe("v1.10.340");
  });

  it("returns successful mock operation results", async () => {
    const { installPackage } = await import("../src/api");

    await expect(installPackage("Git.Git")).resolves.toMatchObject({
      success: true,
      message: "OK",
    });
  });
});
