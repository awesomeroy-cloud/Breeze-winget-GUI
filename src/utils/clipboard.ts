/**
 * System clipboard interaction utilities.
 * @module utils/clipboard
 */

/**
 * Safely copies text to the system clipboard using the asynchronous Clipboard API.
 * Gracefully handles permissions errors or headless environments without throwing.
 *
 * @param text - The string content to copy to the clipboard
 * @returns A promise resolving to `true` if copying succeeded, or `false` on failure
 *
 * @example
 * ```ts
 * const ok = await copyToClipboard("Error log details");
 * if (ok) {
 *   addToast("Copied to clipboard", "success");
 * }
 * ```
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
}
