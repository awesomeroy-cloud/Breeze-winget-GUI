import { ToastType } from "../types";

/**
 * Visual icons and mapping rules for the application.
 * @module constants/icons
 */

/**
 * Emoji icons corresponding to each toast severity level.
 * Includes explicit mapping for "warning".
 */
export const TOAST_ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  info: "ℹ️",
  warning: "⚠️",
};

/**
 * Keyword-to-icon rules used for package emoji heuristic resolution.
 */
export const PACKAGE_ICON_RULES: ReadonlyArray<{
  keywords: readonly string[];
  icon: string;
}> = [
  { keywords: ["code", "studio", "ide", "develop", "sublime", "cursor"], icon: "💻" },
  { keywords: ["chrome", "firefox", "browser", "edge", "brave", "opera", "safari"], icon: "🌐" },
  { keywords: ["git", "github", "gitlab", "tortoise"], icon: "🔀" },
  { keywords: ["node", "python", "java", "rust", "golang", "dotnet", "ruby", "php"], icon: "⚡" },
  { keywords: ["music", "spotify", "player", "audio", "sound", "apple music", "netease"], icon: "🎵" },
  { keywords: ["photo", "image", "paint", "draw", "figma", "photoshop", "gimp"], icon: "🎨" },
  { keywords: ["video", "vlc", "pot", "media", "mpv", "ffmpeg", "obs"], icon: "🎬" },
  { keywords: ["chat", "discord", "telegram", "wechat", "qq", "slack", "teams", "whatsapp"], icon: "💬" },
  { keywords: ["office", "word", "excel", "powerpoint", "pdf", "acrobat", "docs"], icon: "📄" },
  { keywords: ["zip", "7z", "rar", "tar", "archive", "compress"], icon: "📁" },
  { keywords: ["driver", "amd", "nvidia", "intel", "geforce", "hardware"], icon: "🖥️" },
  { keywords: ["game", "steam", "epic", "battle.net", "uplay", "origin", "riot"], icon: "🎮" },
  { keywords: ["vpn", "proxy", "clash", "v2ray", "security", "antivirus"], icon: "🔒" },
  { keywords: ["terminal", "shell", "powershell", "bash", "cmd", "iterm", "alacritty", "wezterm"], icon: "⌨️" },
] as const;

/**
 * Fallback icon when no keyword match is found.
 */
export const DEFAULT_PACKAGE_ICON = "📦";
