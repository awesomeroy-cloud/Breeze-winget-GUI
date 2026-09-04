/**
 * Curated package categories for the Discover view.
 * @module constants/categories
 */

/**
 * A curated category group containing package recommendations.
 */
export interface FeaturedCategory {
  /** Category title with leading emoji */
  title: string;
  /** List of featured items with display labels and winget package IDs */
  items: Array<{
    /** Short application display label */
    label: string;
    /** Exact winget package ID */
    id: string;
  }>;
}

/**
 * Curated software packages displayed on the Discover page.
 */
export const FEATURED_CATEGORIES: readonly FeaturedCategory[] = [
  {
    title: "🛠️ 开发工具",
    items: [
      { label: "VS Code", id: "Microsoft.VisualStudioCode" },
      { label: "Git", id: "Git.Git" },
      { label: "Node.js", id: "OpenJS.NodeJS" },
      { label: "Python", id: "Python.Python.3" },
      { label: "Docker", id: "Docker.DockerDesktop" },
      { label: "Notepad++", id: "Notepad++.Notepad++" },
    ],
  },
  {
    title: "🌐 浏览器 & 通讯",
    items: [
      { label: "Chrome", id: "Google.Chrome" },
      { label: "Firefox", id: "Mozilla.Firefox" },
      { label: "Discord", id: "Discord.Discord" },
      { label: "Telegram", id: "Telegram.TelegramDesktop" },
    ],
  },
  {
    title: "🎬 媒体 & 工具",
    items: [
      { label: "VLC", id: "VideoLAN.VLC" },
      { label: "7-Zip", id: "7zip.7zip" },
      { label: "Steam", id: "Valve.Steam" },
      { label: "PowerToys", id: "Microsoft.PowerToys" },
    ],
  },
] as const;
