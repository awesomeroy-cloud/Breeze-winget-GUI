/**
 * Navigation and page routing types.
 * @module types/navigation
 */

/**
 * Top-level application pages accessible via the primary sidebar.
 */
export type Page = "discover" | "installed" | "updates" | "settings";

/**
 * Sidebar navigation item definition.
 */
export interface NavItem {
  /** Page identifier targeted by this navigation item */
  id: Page;
  /** Emoji or icon string displayed beside the label */
  icon: string;
  /** Localized human-readable label */
  label: string;
}
