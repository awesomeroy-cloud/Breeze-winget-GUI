import { NavItem } from "../types";

/**
 * Navigation configuration constants.
 * @module constants/navigation
 */

/**
 * Ordered list of navigation destinations rendered in the main sidebar.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: "discover", icon: "🔍", label: "发现" },
  { id: "installed", icon: "📦", label: "已安装" },
  { id: "updates", icon: "🔄", label: "更新" },
  { id: "settings", icon: "⚙️", label: "设置" },
] as const;
