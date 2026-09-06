# Easy Espanso v1.2.1 优化结果

## 本轮直接修复

### 1. Windows 后台黑色终端窗口

根因不只是子进程。Rust `main.rs` 没有声明 Windows GUI subsystem，因此 Windows 可以把 Easy Espanso 本体当成控制台程序启动；即使 Espanso/where 子进程已经使用 `CREATE_NO_WINDOW`，应用本体仍可能出现黑色 Windows Terminal/Console 窗口。

处理：

- `src-tauri/src/main.rs` 在 Windows 下固定使用 `windows_subsystem = "windows"`，Debug/Release 都不再自动创建控制台窗口。
- `open_in_explorer` 也统一走 `child_command()`，并把 stdin/stdout/stderr 置空，避免后续系统命令重新引入控制台闪窗。

### 2. 设置 / 应用配置点击无反应

根因在 `src/main.ts` 的全局 capture 点击监听。它会在 Vue Router 的 `RouterLink` 之前执行 `preventDefault()`，然后把 `#/settings` / `#/apps` 直接传给 `router.push()`。在 `createWebHashHistory()` 下，这种写法会把它解释成当前页面的 hash，而不是目标路由，因此 RouterLink 自己随后也因为事件已被 preventDefault 而不再导航。

处理：

- 删除这段全局链接劫持逻辑，让 RouterLink 完整接管站内导航。
- 删除“任何 Vue/Router 错误都自动跳回 `/snippets`”的恢复逻辑，避免设置页发生轻微异常后看起来像“点了没有反应”。
- Settings 和 AppProfiles 改为主包直接导入，降低桌面端懒加载 chunk 失败带来的页面打不开风险。
- 左侧导航增加层级隔离、`aria-current` 和更明确的 hover/active 反馈。
- 设置分类从不可聚焦的 `div` 改为真正的 `button`，支持键盘操作。
- 设置分类会同步到 `?section=`，应用配置管理器可直接打开“设置 → 应用专用”。

### 3. 滚动条加入主题色

- 滚动条轨道不再透明/纯白，而是使用 `primary` 的低透明度主题色。
- 滑块使用更明显的主题色，hover 时增强。
- CodeMirror 滚动条同步主题。
- 新增滚动条宽度：细 / 标准 / 宽。
- 清理 `main.css` 中重复且依赖已失效旧变量的滚动条规则，避免后加载 CSS 相互覆盖。

### 4. 更多界面自由度

界面偏好新增：

- 主题强调色：蓝 / 紫 / 青 / 绿 / 橙 / 玫红。
- 滚动条宽度：细 / 标准 / 宽。
- UI 缩放新增 150%。
- 默认强调色使用紫色，更接近当前 v1.2.1 视觉方向。
- 所有偏好即时保存并即时应用。

### 5. 应用配置管理器 UX 重做

- 新增规则搜索。
- 新增规则总数 / 冲突数量摘要。
- 新增“新建配置”入口，并直达设置页应用专用分类。
- 增加加载、空状态、错误状态和重试入口。
- 优先级按钮增加边界禁用状态。
- 编辑、启停、移动、删除增加错误 toast。
- 编辑弹窗增加关闭按钮、保存中状态和空值校验。
- 卡片、徽章、冲突提示和暗色模式统一使用语义主题变量。

### 6. 版本号统一

原项目存在 `package.json=1.2.0`、Tauri/Cargo=`1.0.1` 的版本漂移。本轮统一为 `1.2.1`。

## 代码结构观察

当前最需要继续拆分的文件：

- `SettingsView.vue`：约 1700 行。建议拆成 `settings/BasicSettings.vue`、`InterfaceSettings.vue`、`ApplicationsSettings.vue`、`PasteSettings.vue`、`AdvancedSettings.vue`，并建立 setting schema。
- `RuleEditForm.vue`：约 2100 行。建议拆成内容编辑、触发器、高级选项、变量、测试区等模块。
- `useEspansoStore.ts`：约 1490 行。它同时承担 workspace、配置树、选择、保存、历史、剪贴板和 CRUD；建议拆为 `workspaceStore`、`configTreeStore`、`snippetStore`、`historyStore`。
- `TreeNode.vue`：约 1000 行。建议把拖拽、右键菜单、展开状态和节点展示拆成 composables / 子组件。
- `platformService.ts` 仍保留不少旧 Electron 时代的注释和 fallback。既然当前已迁到 Tauri，可以逐步收紧接口，减少“adapter 方法不存在再 fallback”的分支。
- `main.css` 与 `tailwind.css/global.css/shadcn.css` 有历史重复。建议 v1.3 做一次样式层清理，只保留 theme tokens + Tailwind base/components + 少量全局行为样式。

## 下一个版本建议：v1.3「可发现性 + 安全修改」

优先级建议：

1. **设置搜索 + 快捷跳转**：设置项越来越多后，不要继续只堆侧栏；Ctrl/Cmd+K 也应能直接跳到某个设置项。
2. **应用规则测试器**：输入窗口 title/class/exec，实时显示哪些规则会命中、最终哪个优先。
3. **YAML Diff + 历史时间线**：保存前预览差异；每次保存形成可恢复快照，支持单文件回滚。
4. **快捷键中心**：让用户自定义新建、保存、搜索、展开、切换面板、打开设置等应用内快捷键，并检测冲突。
5. **可拖拽面板宽度 + 记忆布局**：左/中/右面板可拖动，保存每个工作区的布局。
6. **设置导入 / 导出**：迁移主题、密度、通知、快捷键、布局等 Easy Espanso 偏好。
7. **外部修改监听**：VS Code/Git 修改 YAML 后自动检测，提供“重新加载 / 对比 / 保留本地”冲突处理。
8. **大配置性能专项**：树虚拟化、搜索索引、增量刷新，目标支持数万条 snippet。

如果只选 v1.3 的三个核心功能，我建议先做：**应用规则测试器 + Diff/历史时间线 + 设置/命令搜索**。这三个对新手可理解性、误操作防护和高级用户效率都有直接提升。

## 验证

- JSON 配置文件语法检查通过。
- 修改后的 TypeScript / Vue `<script setup>` 使用 TypeScript parser 做了语法检查，没有发现语法错误。
- 已确认源码中不再存在会劫持 RouterLink 的 `document` capture 点击监听。
- 已确认 Windows `main.rs` 声明 GUI subsystem。
- 已确认主滚动条和 CodeMirror 滚动条都使用主题 `primary` 色。
- 当前执行环境没有 Rust toolchain；同时 `npm install` 在 120 秒限制内未完成，因此没有在此环境完成 Tauri/Vite 全量构建。建议在 Windows 开发机执行 `npm install` 后再运行 `npm run tauri:build` 做最终安装包验证。
