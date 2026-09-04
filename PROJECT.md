# Project: Breeze (winget-GUI) Detection, Initialization & Update Pipeline Fixes

## Architecture
Breeze is a Windows package manager GUI built on Tauri (v2) with a Rust backend (`src-tauri`) and a React 19 + TypeScript + Vite frontend (`src/`).
- **Backend**: Invokes the Windows `winget` CLI, resolves binary paths across standard and restricted environments, sanitizes CLI parameters per subcommand, parses tabular output into structured domain models, and exposes Tauri IPC commands.
- **Frontend**: Single-page React application consuming Tauri IPC via `src/api.ts` and React context providers (`PackageContext`, `ToastContext`), managing package installation, upgrade, uninstallation, and initial environment readiness.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Robust Winget CLI Detection & Root Flag Sanitization | Call `winget --version` without `--accept-source-agreements`; sanitize arguments so root commands never receive subcommand-only flags | M1 | Survey (R1) |
| 2 | Multi-Tier Binary Path Resolution | Implement `resolve_winget_path()` checking `PATH`, `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe`, and `where.exe winget` | M1 | Survey (R1) |
| 3 | Strict Subcommand Argument Filtering | Implement `sanitize_winget_args()` strictly restricting `--accept-source-agreements` to `search`, `install`, `upgrade`, `list` | M1 | Survey (R1) |
| 4 | Upgrade Table Parser & Ghost Package Elimination | Fix `parser.rs` to filter winget advisory footers (`--include-unknown`, `无法确定`, `cannot be determined`) and require valid `available` version in `check_upgrades()` | M1 | Survey (R3) |
| 5 | Direct Startup to Main Interface | Fix `checkWinget` in `App.tsx` to transition immediately to `"ready"` on winget detection and isolate `refreshInstalled()` into independent error boundary | M2 | Survey (R2) |
| 6 | Environment Installer Streaming Feedback | Add `app: tauri::AppHandle` to `install_winget_env`, stream download/install progress via `"env-install-progress"` events, and render live progress bar in `InitPage.tsx` | M2 | Survey (R2) |
| 7 | Update Lifecycle & Installed List Cache Synchronization | Ensure `UpdatesPage.tsx` `handleUpgradeAll` calls `await refreshInstalled()` on all branches (including partial failure), and guard unversioned packages in `PackageCard.tsx` | M2 | Survey (R3) |
| 8 | Regression Test Integrity & Forensic Audit | Maintain 100% passing tests (`cargo test`, `npx vitest run`, `npm run build`), verify edge cases with Challengers, and pass Forensic Integrity Audit | M3 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Backend CLI Detection, Resolution, Parameter Sanitization & Parser Fixes | Implement `resolve_winget_path`, `sanitize_winget_args`, update `process.rs`/`progress.rs`/`commands.rs`/`parser.rs`/`lib.rs`, add unit tests in `tests.rs` | none | IN_PROGRESS |
| 2 | M2: Frontend Initialization State, Installer Feedback & Update Pipeline UI | Fix `App.tsx` state machine, add event listener and progress bar to `InitPage.tsx`, fix `UpdatesPage.tsx` and `PackageCard.tsx` | M1 | PLANNED |
| 3 | M3: Cross-Stack Verification, Adversarial Challenge & Forensic Audit | Run full regression tests (`cargo test`, `vitest`, `build`), run Reviewers, Challengers, and Forensic Auditor | M1, M2 | PLANNED |

## Code Layout
### Backend (`src-tauri/src/`)
- `lib.rs`: Tauri command registration and `install_winget_env` IPC signature.
- `winget/process.rs`: Process execution, `resolve_winget_path`, `sanitize_winget_args`, `CREATE_NO_WINDOW` flags.
- `winget/progress.rs`: Streaming execution, `run_winget_with_progress`, progress regex, argument sanitization.
- `winget/parser.rs`: Tabular output parsing, ANSI stripping, advisory line filtering (`--include-unknown`, `无法确定`, `cannot be determined`, counts).
- `winget/commands.rs`: High-level operations (`get_winget_version`, `check_upgrades`, `install_winget_env` with progress, `upgrade_package`, `upgrade_all`).
- `winget/tests.rs`: Comprehensive unit tests for path resolution, parameter sanitization, table parsing with advisory lines, and version checks.

### Frontend (`src/`)
- `App.tsx`: Initial startup sequence, `checkWinget` error boundary, state transition to `"ready"`.
- `pages/InitPage.tsx`: Environment installer screen with live progress bar, percentage, stage messages, and error retry.
- `pages/UpdatesPage.tsx`: Updates list, single/batch upgrades, `refreshInstalled` on completion.
- `components/PackageCard.tsx`: Package card with version badge safeguards (`未知版本` for unversioned apps).
- `context/PackageContext.tsx`: Installed/upgrade packages state and operations.
- `api.ts`: IPC invocation wrappers.

## Interface Contracts
### Tauri IPC Commands (`src-tauri/src/lib.rs` ↔ `src/api.ts`)
- `get_winget_version() -> Result<String, String>`
- `check_upgrades() -> Result<Vec<Package>, String>`
- `install_winget_env(app: tauri::AppHandle) -> Result<OperationResult, String>`
- `upgrade_package(id: String, settings: Option<WingetSettings>) -> Result<OperationResult, String>`
- `upgrade_all(settings: Option<WingetSettings>) -> Result<OperationResult, String>`

### Tauri Event Streams
- Channel `"download-progress"`: `{ id: String, progress: f64 }`
- Channel `"env-install-progress"`: `{ phase: String, progress: f64, message: String }`
