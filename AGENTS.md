# AGENTS.md

Instructions for coding agents working in this repository.

## What this is

Breeze is a Windows desktop GUI for [winget](https://github.com/microsoft/winget-cli), built with **Tauri 2 + React 19 + TypeScript + Vite**. The app searches, installs, upgrades, and uninstalls packages, and can bootstrap winget if it is missing.

Repo: `https://github.com/awesomeroy-cloud/Breeze-winget-GUI`  
Identifier: `com.breeze.desktop`  
Frontend port (Vite): `http://localhost:1420`

## Layout

| Path | Role |
|------|------|
| `src/` | React UI |
| `src/api.ts` | Tauri IPC wrappers + browser mocks for Vitest |
| `src/context/` | `PackageContext` (installed list, upgrade badge, progress) and `ToastContext` |
| `src/pages/` | Discover, Installed, Updates, Settings, Init |
| `src/settings.ts` | `localStorage` persistence (`breeze-winget-settings`, snake_case) |
| `src-tauri/src/lib.rs` | Tauri command registration |
| `src-tauri/src/winget/` | CLI spawn, table parse, progress stream, commands |
| `.github/workflows/release.yml` | Cloud build |

Do not reintroduce a monolithic `winget.rs`. Keep `types` / `process` / `parser` / `progress` / `commands` split.

## Commands

Run from the project root (`breeze/`). Windows only for Tauri.

```bash
npm install
npm run tauri dev          # desktop app (preferred for real winget)
npm run dev                # Vite only; uses mocks in api.ts
npm test                   # vitest run
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build        # local NSIS installer
```

Tauri HMR is unreliable after hook-count changes. If Settings or another page blanks out, restart `npm run tauri dev` instead of relying on hot reload.

## Architecture rules

- **IPC only through `src/api.ts`.** Pages must not call `invoke` directly.
- **Settings always snake_case** on both TS (`WingetSettings`) and Rust (`WingetSettings`). Changing a field requires both sides.
- **Tauri injects `AppHandle`.** Frontend does not pass `app`. Commands that stream progress take `app: tauri::AppHandle` last (or as a registered arg).
- **Do not block startup on `list_installed`.** `get_winget_version` success → `ready`. Refresh installed/upgrades in the background. A list failure must not bounce to InitPage.
- **`--accept-source-agreements` is not a global flag.** `sanitize_winget_args` may attach it only to `search` / `install` / `upgrade` / `list`. Root flags such as `--version` must never receive it.
- **Resolve winget via `resolve_winget_path`:** PATH → `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe` → `where.exe`. Always spawn with `CREATE_NO_WINDOW` (`0x08000000`).
- **Decode CLI output UTF-8 then GBK.** Chinese Windows often emits CP936.

## Winget output and progress

`winget` prints tables and in-place `\r` bars, not JSON.

- Parse tables with visual column width (`char_width`: CJK width 2). Skip footers: `--include-unknown`, `无法确定`, `cannot be determined`, `upgrades available`.
- `check_upgrades` must drop rows without a real `available` version (empty, `-`, `unknown`).
- Progress: prefer `12.3 MB / 24.6 MB` and `%`; then block bars (`█`/`▒`/`░`). Do **not** treat every line containing `安装` / `Installing` as 100%. Installer start ≈ 92%; success phrases → 100%.
- `upgrade --all` should switch progress `id` when a `Found Name [Id]` / `找到 … [Id]` line appears. Do not paint the same percent on every card.
- Single-package upgrade must **not** set “全部更新中” or disable the whole Updates page. That label is only for `upgradingAll`.

## UI conventions

- Dark-first Fluent-ish CSS in `src/index.css` (no CSS-in-JS framework).
- Unversioned packages show `未知版本`, not `v-` / `vunknown`.
- Settings page is winget CLI options only. Do not add an “About Breeze” block.
- Default search source is winget (avoids Microsoft Store timeouts). The settings label must match that behavior.
- Installed page loading uses `installedLoaded`, not “empty list == still loading”.

## Tests

- Frontend: `tests/*.ts` (Vitest). `api.ts` mocks when `window.__TAURI_INTERNALS__` is absent. Mock search has a 0.6–1s delay; tests that call it need a long enough timeout.
- Backend: `src-tauri/src/winget/tests.rs`. Add cases when changing parsers or `sanitize_winget_args`.
- Do not run `npx vitest run` from `C:\Users\Roy` (picks up unrelated tests). Always `cd` into this repo.

## CI / release

Workflow: `.github/workflows/release.yml` (`windows-latest`).

| Trigger | Result |
|---------|--------|
| Push to `main` | Test + Tauri build; upload `Breeze-windows-x64` artifact (no GitHub Release) |
| Tag `v*` or Actions **Run workflow** | CalVer/SemVer sync + GitHub Release with NSIS installer |

Tag is **not** required for compile. Do not create a Release on every commit.

Installer lives under `src-tauri/target/release/bundle/nsis/`. Unsigned; SmartScreen “more info → run anyway” is expected.

## Git

- Default branch: `main`. Remote: `origin` → `awesomeroy-cloud/Breeze-winget-GUI`.
- Do not commit `node_modules/`, `src-tauri/target/`, or `dist/`.
- Ignore CRLF-only dirty files (e.g. `Cargo.toml` with no real diff).
- Commit messages: imperative, focused. Example: `fix: keep single-package upgrade from locking Updates`.
)
