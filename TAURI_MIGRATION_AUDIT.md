# Tauri migration and startup audit

## Migration completed

- Replaced Electron/electron-vite/electron-builder scripts and dependencies with Vite + Tauri 2.
- Removed the Electron main/preload tree and ElectronAdapter.
- Added `src-tauri` with Tauri config, capabilities, Rust commands and application icons.
- Added `TauriAdapter` implementing the existing `IPlatformAdapter` contract.
- Removed runtime `window.preloadApi` use from Espanso installation/status/control logic.
- Migrated file operations, path joining, environment access, Espanso discovery/status/control and explorer reveal to Rust commands.
- Migrated native dialogs, notifications and external URL opening to official Tauri plugins.
- Updated the build helper and GitHub Actions workflow for Tauri.

## Startup-blocking checks performed

- `package.json`, `tauri.conf.json`, and `capabilities/default.json` parse as valid JSON.
- Changed TypeScript files parse successfully with the TypeScript parser.
- No active Electron imports, `preloadApi`, `ElectronAdapter`, electron-vite or electron-builder references remain in runtime/build source paths.
- Tauri window is configured `visible: true`, so renderer failures do not create the previous hidden-window failure mode.
- Vite dev server and Tauri `devUrl` both use `127.0.0.1:1420` with `strictPort: true`.
- Tauri command argument names use camelCase on the JavaScript side to match Tauri 2 command conventions.
- Required dialog/notification/opener plugin permissions are present in the default capability.
- Bundle icons are present under `src-tauri/icons`.

## Environment limitation during verification

The current execution environment does not have `rustc` or `cargo`, so `cargo check` / `tauri dev` cannot be executed here. Frontend dependency installation also timed out repeatedly in this environment, preventing a full Vite dependency-resolved build. These are verification-environment limitations, not observed application errors.

For a machine with prerequisites installed, use:

```bash
npm install
npm run tauri:dev
```

For a release build:

```bash
npm run tauri:build
```
