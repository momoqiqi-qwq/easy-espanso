# 2026-09-04 follow-up fixes

## 1. Snippet drag reorder

The root cause was nested SortableJS containers sharing the same drag handle. When dragging a snippet inside a YAML file, an outer folder/root Sortable instance could grab the containing file first and reject the move.

Changes:
- Root tree is no longer a Sortable container.
- Folder levels are no longer Sortable containers.
- Only YAML file child lists are sortable.
- Snippets use a dedicated `.match-drag-handle`.
- Cross-file dragging remains enabled through the `matchRows` group.
- `forceFallback` is enabled for more consistent Tauri/WebView behavior.

## 2. File snippet counts

Snippet count badges now display on both folders and YAML files, including `base.yml`.

## 3. App configuration snippet visibility

The app profile editor now expands each match YAML file to show the individual snippets contained in it, including trigger and label. Existing app profile cards also show the snippets covered by the selected app-only match files under `仅此应用`.

Note: Espanso's app-specific inclusion mechanism is file-based (`extra_includes` / `extra_excludes`). This UI therefore exposes the individual snippets for visibility while the actual inclusion unit remains a match YAML file.
