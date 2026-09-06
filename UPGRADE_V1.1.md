# Easy Espanso v1.1 upgrade

- Added an **应用专用** settings section based on Espanso's official app-specific configuration model.
- Supports `filter_exec`, `filter_class`, and `filter_title`, plus per-app `enable`, `backend`, `paste_shortcut`, `inject_delay`, `key_delay`, and `apply_patch`.
- Added YAML round-trip validation before normal saves.
- Added `.easy-espanso.bak` backup before overwriting YAML files.
- Added recent workspace tracking and safety-editing preferences.
- Added auto-save/backup preference switches as groundwork for the next editor refactor.

Official behavior to remember: app-specific config files live under `config/`; only one app-specific config applies at a time and alphabetical filename order determines precedence when multiple filters match. Wayland does not currently support app-specific configurations.
