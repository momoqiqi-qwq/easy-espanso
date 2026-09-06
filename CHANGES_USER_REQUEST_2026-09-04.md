# 用户反馈修复（2026-09-04）

1. 片段树中的文件夹名称后显示其递归包含的片段数量。
2. 修复“新建文件夹”依赖不存在的 `match` 树节点导致“无法找到或创建match文件夹节点”的问题。当前 `configTree` 直接表示 `match/` 内容，新目录会直接创建在 `match/` 并加入树根。
3. 拖动片段后会按拖动后的数组顺序保存 YAML，并重新编号内部 `guiOrder`，保证重启后显示顺序保持一致。
4. 应用配置增强：
   - 新建/编辑规则时可选择“仅此软件可用的片段文件”；应用配置写入 `extra_includes`，全局 `default.yml` 同步写入受管理的 `extra_excludes`。
   - 使用 `.easy-espanso-app-match-excludes.json` 记录由 Easy Espanso 管理的排除项，避免覆盖用户自己维护的 `extra_excludes`。
   - Windows 下新增拖动准星识别目标程序：把准星拖到目标软件窗口上方松开，自动读取该窗口进程的 EXE 并填入 `filter_exec`。

## 验证说明

当前执行环境无法联网安装前端依赖，且未安装 Rust/Cargo，因此未能在此环境完成 Vite/Tauri 编译验证。代码已做静态检查和关键路径核对；建议在开发机执行 `npm install && npm run build` 以及 `npm run tauri:build` 做最终编译验证。
