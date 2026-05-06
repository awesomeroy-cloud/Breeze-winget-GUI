import { loadSettings } from "./settings";

export interface Package {
  name: string;
  id: string;
  version: string;
  available?: string;
  source?: string;
  matched?: string;
}

export interface PackageDetail {
  name: string;
  id: string;
  version: string;
  publisher: string;
  description: string;
  homepage: string;
  license: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  output: string;
}

// Detect if running inside Tauri
const isTauri = !!(window as any).__TAURI_INTERNALS__;

// Dynamic import for Tauri API (only in Tauri context)
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // Fallback: return mock data for browser dev
  return mockInvoke<T>(cmd, args);
}

// ===== Mock data for browser development =====
const MOCK_INSTALLED: Package[] = [
  { name: "Google Chrome", id: "Google.Chrome", version: "125.0.6422.60", source: "winget" },
  { name: "Visual Studio Code", id: "Microsoft.VisualStudioCode", version: "1.99.3", source: "winget" },
  { name: "Git", id: "Git.Git", version: "2.47.2", source: "winget" },
  { name: "Node.js", id: "OpenJS.NodeJS", version: "22.15.0", source: "winget" },
  { name: "Python 3.12", id: "Python.Python.3.12", version: "3.12.10", source: "winget" },
  { name: "7-Zip", id: "7zip.7zip", version: "24.09", source: "winget" },
  { name: "VLC media player", id: "VideoLAN.VLC", version: "3.0.21", source: "winget" },
  { name: "Discord", id: "Discord.Discord", version: "1.0.9176", source: "winget" },
  { name: "Steam", id: "Valve.Steam", version: "2.10.91.91", source: "winget" },
  { name: "Firefox", id: "Mozilla.Firefox", version: "138.0", source: "winget" },
  { name: "Notepad++", id: "Notepad++.Notepad++", version: "8.7.8", source: "winget" },
  { name: "Windows Terminal", id: "Microsoft.WindowsTerminal", version: "1.22.10352.0", source: "msstore" },
  { name: "PowerToys", id: "Microsoft.PowerToys", version: "0.89.0", source: "winget" },
  { name: "Obsidian", id: "Obsidian.Obsidian", version: "1.8.9", source: "winget" },
  { name: "WireShark", id: "WiresharkFoundation.Wireshark", version: "4.4.5", source: "winget" },
  { name: "Figma", id: "Figma.Figma", version: "124.7.4", source: "winget" },
  { name: "Postman", id: "Postman.Postman", version: "11.31.0", source: "winget" },
  { name: "Docker Desktop", id: "Docker.DockerDesktop", version: "4.39.0", source: "winget" },
];

const MOCK_UPGRADES: Package[] = [
  { name: "Google Chrome", id: "Google.Chrome", version: "125.0.6422.60", available: "126.0.6478.55", source: "winget" },
  { name: "Visual Studio Code", id: "Microsoft.VisualStudioCode", version: "1.99.3", available: "1.100.0", source: "winget" },
  { name: "Discord", id: "Discord.Discord", version: "1.0.9176", available: "1.0.9187", source: "winget" },
  { name: "PowerToys", id: "Microsoft.PowerToys", version: "0.89.0", available: "0.90.1", source: "winget" },
  { name: "Obsidian", id: "Obsidian.Obsidian", version: "1.8.9", available: "1.9.0", source: "winget" },
];

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

  switch (cmd) {
    case "search_packages": {
      const q = (args?.query as string || "").toLowerCase();
      const all = [...MOCK_INSTALLED,
        { name: "Spotify", id: "Spotify.Spotify", version: "1.2.52.442", source: "winget" },
        { name: "Telegram Desktop", id: "Telegram.TelegramDesktop", version: "5.12.3", source: "winget" },
        { name: "Sublime Text", id: "SublimeHQ.SublimeText.4", version: "4189", source: "winget" },
        { name: "Cursor", id: "Anysphere.Cursor", version: "0.50.5", source: "winget" },
        { name: "Rust (MSVC)", id: "Rustlang.Rust.MSVC", version: "1.86.0", source: "winget" },
      ];
      return all.filter(
        (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      ) as T;
    }
    case "list_installed":
      return MOCK_INSTALLED as T;
    case "check_upgrades":
      return MOCK_UPGRADES as T;
    case "show_package": {
      const id = args?.id as string || "";
      const found = [...MOCK_INSTALLED, ...MOCK_UPGRADES].find((p) => p.id === id);
      return {
        name: found?.name || id,
        id,
        version: found?.version || "unknown",
        publisher: "Publisher Inc.",
        description: `${found?.name || id} — 一款优秀的软件。在 Windows 上广受欢迎。`,
        homepage: `https://example.com/${id.toLowerCase().replace(/\./g, "/")}`,
        license: "MIT / Apache-2.0",
      } as T;
    }
    case "install_package":
    case "uninstall_package":
    case "upgrade_package":
    case "upgrade_all":
      return { success: true, message: "OK", output: "Mock operation succeeded." } as T;
    case "get_winget_version":
      return "v1.10.340" as T;
    case "get_package_versions":
      return ["1.0.2", "1.0.1", "1.0.0"] as T;
    default:
      throw new Error(`Unknown mock command: ${cmd}`);
  }
}

// ===== Public API =====
export async function searchPackages(query: string): Promise<Package[]> {
  const settings = loadSettings();
  return invoke("search_packages", { query, settings });
}

export async function listInstalled(): Promise<Package[]> {
  return invoke("list_installed");
}

export async function checkUpgrades(): Promise<Package[]> {
  return invoke("check_upgrades");
}

export async function showPackage(id: string): Promise<PackageDetail> {
  return invoke("show_package", { id });
}

export async function installPackage(id: string, version?: string): Promise<OperationResult> {
  const settings = loadSettings();
  return invoke("install_package", { id, version, settings });
}

export async function uninstallPackage(id: string): Promise<OperationResult> {
  const settings = loadSettings();
  return invoke("uninstall_package", { id, settings });
}

export async function upgradePackage(id: string): Promise<OperationResult> {
  const settings = loadSettings();
  return invoke("upgrade_package", { id, settings });
}

export async function upgradeAll(): Promise<OperationResult> {
  const settings = loadSettings();
  return invoke("upgrade_all", { settings });
}

export async function getWingetVersion(): Promise<string> {
  return invoke("get_winget_version");
}

export async function getPackageVersions(id: string): Promise<string[]> {
  return invoke("get_package_versions", { id });
}

export async function installWingetEnv(): Promise<OperationResult> {
  return invoke("install_winget_env");
}
