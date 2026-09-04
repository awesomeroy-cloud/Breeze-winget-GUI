/**
 * Package metadata and CLI operation types.
 * @module types/package
 */

/**
 * Represents a software package returned by winget (search, list, or upgrade).
 */
export interface Package {
  /** Display name of the application or package */
  name: string;
  /** Unique package identifier (e.g. "Microsoft.VisualStudioCode") */
  id: string;
  /** Currently installed or catalog version */
  version: string;
  /** Available upgrade version if an update is detected */
  available?: string;
  /** Package source repository (e.g. "winget", "msstore") */
  source?: string;
  /** Matched field or query alias when returned from search */
  matched?: string;
}

/**
 * Detailed package metadata queried via `winget show <id>`.
 */
export interface PackageDetail {
  /** Display name of the application */
  name: string;
  /** Unique package identifier */
  id: string;
  /** Current version string */
  version: string;
  /** Software author or organization publisher */
  publisher: string;
  /** Description or summary of the application */
  description: string;
  /** Official project or product homepage URL */
  homepage: string;
  /** Software license moniker or terms */
  license: string;
}

/**
 * Envelope returned by mutating winget operations (install, uninstall, upgrade).
 */
export interface OperationResult {
  /** Indicates whether the CLI command exited successfully (code 0) */
  success: boolean;
  /** High-level human-readable status message */
  message: string;
  /** Combined raw output (stdout and stderr) from the winget CLI execution */
  output: string;
}
