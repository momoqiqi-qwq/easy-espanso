# 2026-09-05 requested fixes: app-only snippets and Packages

## Application profile editor

- Widened the application-rule create/edit dialog to 920px (responsive to viewport width).
- Replaced the old "select match YAML files" block with an embedded snippet editor inspired by the main snippet editor.
- App-only snippets are stored in `match/__easy_espanso_app_only/<profile>.yml` and are automatically referenced through the profile's `extra_includes`.
- These managed files are automatically kept in the global profile's `extra_excludes`, so snippets created here are only active while the matching application profile is active.
- The managed app-only directory is hidden from the normal/global snippet tree.
- Existing non-managed `extra_includes` are preserved for backward compatibility.

## Packages context menu

- Fixed Windows package path detection by normalizing `\\` and `/` separators.
- Added `新建 Packages 包` to the root Packages context menu.
- New packages ask for a name, create the folder plus an empty `package.yml`, reload the tree, expand Packages, and select the new folder.
- Package folders also expose `新建片段`, targeting their hidden `package.yml` directly.
- Empty package folders with a `package.yml` are now shown in the tree.
- `match/packages` is created automatically so the Packages root remains available even when empty.

## Open in Explorer

- The Tauri `open_in_explorer` command now treats successful process launch as success rather than waiting for the GUI file manager's exit code. This avoids false errors from Windows Explorer when it hands the request to an existing Explorer process.
- Settings > Packages now points to `match/packages`, matching the Packages tree.
- Import with "preserve current snippets" still restores `match/packages`, so package backups are not skipped.
