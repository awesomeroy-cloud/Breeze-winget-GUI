import { PACKAGE_ICON_RULES, DEFAULT_PACKAGE_ICON } from "../constants/icons";

/**
 * Package visual representation and icon utilities.
 * @module utils/icon
 */

/**
 * Resolves a deterministic emoji icon for a software package based on its name and optional ID.
 *
 * Checks keyword patterns against lowercase package name and identifier. If no keyword matches,
 * returns the default fallback icon ("📦").
 *
 * @param name - Display name of the package (e.g. "Visual Studio Code")
 * @param id - Optional unique package identifier (e.g. "Microsoft.VisualStudioCode")
 * @returns An emoji icon representing the software category
 *
 * @example
 * ```ts
 * getPackageIcon("Google Chrome"); // returns "🌐"
 * getPackageIcon("Git", "Git.Git"); // returns "🔀"
 * getPackageIcon("CustomApp"); // returns "📦"
 * ```
 */
export function getPackageIcon(name: string, id?: string): string {
  const target = `${name || ""} ${id || ""}`.toLowerCase();

  for (const rule of PACKAGE_ICON_RULES) {
    if (rule.keywords.some((kw) => target.includes(kw))) {
      return rule.icon;
    }
  }

  return DEFAULT_PACKAGE_ICON;
}
