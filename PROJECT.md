# Project: Breeze (winget-GUI) Refactoring

## Architecture
Breeze is a modern Windows package manager GUI built on Tauri (v2) with a Rust backend (`src-tauri`) and a React 19 + TypeScript + Vite frontend (`src/`).
- **Backend**: Invokes the Windows `winget` CLI, parses tabular output, monitors download/install progress via stream reading, and exposes 11 IPC commands to the frontend.
- **Frontend**: Single-page application communicating exclusively through `src/api.ts` with Tauri IPC, providing search, installation, upgrade management, and settings configuration.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Rust Module Decomposition | Split monolithic `winget.rs` (887 lines) into `types.rs`, `process.rs`, `parser.rs`, `progress.rs`, `commands.rs` with facade `mod.rs` | M1 | Survey (R1) |
| 2 | Rust Technical Nuance Rustdoc | Comprehensive `///` documentation for Win32 `CREATE_NO_WINDOW`, dual GBK/UTF-8 decoding, CJK `char_width`, CR streaming, stderr deadlock thread, 3-tier uninstall fallback | M1 | Survey (R1) |
| 3 | Rust Quality & Lints | Fix 7 Clippy warnings in backend and expand unit tests for width/parsing/heuristics | M1 | Survey (R1, R3) |
| 4 | Frontend Domain Types & Constants | Centralize types in `src/types/` and constants in `src/constants/` | M2 | Survey (R2) |
| 5 | Shared Utilities & Components | Extract `icon.ts`, `clipboard.ts`, and reusable `ConfirmModal` | M2 | Survey (R2) |
| 6 | React Context & Hooks | Introduce `ToastContext` and `PackageContext` (`useToast`, `usePackages`, `useOperations`), eliminating `globalState` prop-drilling | M2 | Survey (R2) |
| 7 | Frontend Page Refactoring | Refactor `DiscoverPage`, `InstalledPage`, `UpdatesPage`, `Sidebar`, and `DetailPanel` to consume context hooks with 0 prop-drilling | M2 | Survey (R2) |
| 8 | Comprehensive JSDoc | Document all exported interfaces, types, functions, and components with JSDoc | M2 | Survey (R2) |
| 9 | IPC Compatibility & Contract Verification | Ensure 100% backward compatibility for all 11 Tauri IPC commands, `"download-progress"` stream event, and `WingetSettings` snake_case serialization | M3 | Survey (R3) |
| 10 | Regression & Build Integrity | Ensure zero cargo test failures, zero vitest failures (7/7+ tests), and zero TypeScript/Vite build errors | M3 | Survey (R3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Backend Modularization & Documentation | Refactor `src-tauri/src/winget.rs` into submodules (`types`, `process`, `parser`, `progress`, `commands`, `mod.rs`), add Rustdocs, fix Clippy warnings, verify `cargo test` | none | DONE |
| 2 | M2: Frontend Architecture & Prop-Drilling Elimination | Centralize types/constants, extract utilities, implement Context/hooks, refactor pages & `DetailPanel`, add JSDoc, verify `npm test` & `npm run build` | none | DONE |
| 3 | M3: Compatibility & Full Regression Hardening | Verify cross-stack IPC contracts, run full test suites, adversarial stress tests, forensic integrity audit | M1, M2 | DONE |

## Code Layout
### Backend (`src-tauri/src/`)
- `lib.rs`: Tauri builder and IPC command registration facade.
- `winget/mod.rs`: Public API facade re-exporting types and command handlers.
- `winget/types.rs`: Data structs (`Package`, `PackageDetail`, `OperationResult`, `WingetSettings`, `ProgressPayload`, `AppError`) and argument serialization.
- `winget/process.rs`: Process execution (`run_winget`, `run_winget_with_settings`), encoding fallback (`decode_command_bytes`), Win32 creation flags (`CREATE_NO_WINDOW`).
- `winget/parser.rs`: Tabular output parsing (`parse_winget_table`, `parse_table_as_map`, `extract_columns`), visual column width (`char_width`), ANSI stripping, ARP filtering.
- `winget/progress.rs`: Streaming command execution (`run_winget_with_progress`), carriage return `\r` handling, progress regex extraction, stderr thread draining.
- `winget/commands.rs`: High-level package operations (`search_packages`, `list_installed`, `check_upgrades`, `show_package`, `install_package`, `uninstall_package` with 3-tier fallback, `upgrade_package`, `upgrade_all`, `get_winget_version`, `get_package_versions`, `install_winget_env`).
- `winget/tests.rs`: Unit test suite (preserving all 3 baseline tests + adding width/parser/progress tests).

### Frontend (`src/`)
- `types/`: Domain TypeScript type definitions (`package.ts`, `settings.ts`, `toast.ts`, `navigation.ts`, `index.ts`).
- `constants/`: Configuration & constants (`categories.ts`, `navigation.ts`, `settings.ts`, `icons.ts`, `index.ts`).
- `utils/`: Shared helper functions (`icon.ts`, `clipboard.ts`, `index.ts`).
- `context/`: React Contexts and custom hooks (`ToastContext.tsx`, `PackageContext.tsx`, `index.ts`).
- `components/`: Reusable UI components (`ConfirmModal.tsx`, `PackageCard.tsx`, `Sidebar.tsx`, `Toast.tsx`, `DetailPanel.tsx`, `RainbowProgressBar.tsx`).
- `pages/`: Page components (`DiscoverPage.tsx`, `InstalledPage.tsx`, `UpdatesPage.tsx`, `SettingsPage.tsx`, `InitPage.tsx`).
- `api.ts`: Pure IPC invocation layer (compatible with both Tauri runtime and Vitest mock mode).
- `settings.ts`: Settings persistence layer.
- `App.tsx`: Root application shell providing Context providers and page navigation.

## Interface Contracts
### Tauri IPC Commands (`src-tauri/src/lib.rs` ↔ `src/api.ts`)
1. `search_packages(query: String, settings: Option<WingetSettings>) -> Result<Vec<Package>, String>`
2. `list_installed() -> Result<Vec<Package>, String>`
3. `check_upgrades() -> Result<Vec<Package>, String>`
4. `show_package(id: String) -> Result<PackageDetail, String>`
5. `install_package(id: String, settings: Option<WingetSettings>) -> Result<OperationResult, String>`
6. `uninstall_package(id: String, name: Option<String>, settings: Option<WingetSettings>) -> Result<OperationResult, String>`
7. `upgrade_package(id: String, settings: Option<WingetSettings>) -> Result<OperationResult, String>`
8. `upgrade_all(settings: Option<WingetSettings>) -> Result<OperationResult, String>`
9. `get_winget_version() -> Result<String, String>`
10. `get_package_versions(id: String) -> Result<Vec<String>, String>`
11. `install_winget_env() -> Result<OperationResult, String>`

### Tauri Event Stream
- Channel: `"download-progress"`
- Payload: `ProgressPayload { id: String, progress: f64 }` (0.0 to 100.0)

### Settings Contract (`WingetSettings`)
- Serialization: strictly `snake_case` on both Rust and TypeScript sides.
- Defaults: Rust `WingetSettings::default()` and TS `DEFAULT_SETTINGS` maintain their independent defaults as verified by unit tests.
