# Startup audit

## Changes in this pass

- Main window no longer depends solely on `did-finish-load` to become visible.
- Added `ready-to-show` plus a 4-second visibility fallback so renderer failures cannot leave a permanently hidden window.
- Main-frame `did-fail-load` now reveals the window and logs URL/error details.
- Vue DevTools installation is now non-blocking in development mode.
- Application icon resolution now checks packaged and development paths instead of assuming `dist/build/icon.png`.

## Validation performed

- `electron/main/index.js`: `node --check` passed.
- `electron/preload/index.js`: `node --check` passed.
- `electron/services/espanso.js`: `node --check` passed.
- Full dependency install/build could not be completed in the execution environment because `npm install` exceeded the available operation timeout. This is not evidence of a project build failure.

## Tauri migration note

The Vue renderer can largely be retained. The existing `IPlatformAdapter` / `PlatformAdapterFactory` abstraction is a good migration seam. A Tauri port would mainly replace Electron preload/IPC and the Electron main-process implementations for filesystem, dialogs, notifications, shell/open, Espanso process status/control, and path/environment access.
