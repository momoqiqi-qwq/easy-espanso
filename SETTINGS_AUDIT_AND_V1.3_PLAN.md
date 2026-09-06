# Easy Espanso v1.2.1 设置审计与 v1.3 优化计划

## 本轮结论

本轮对设置页、用户偏好 Store、Espanso 全局配置保存链路、编辑器自动保存链路、备份链路、主题/通知/侧栏等偏好消费位置做了静态审计。

已确认并修复 4 个设置层面的真实问题：

1. **“自动保存编辑”之前只是写入偏好，没有真正阻止 RuleEditForm 的失焦自动保存。** 现在关闭后，失焦/控件变化触发的隐式自动保存会跳过；用户显式点击保存仍然有效。
2. **“保存前创建备份”之前只是写入偏好，但 espansoService 每次保存仍无条件调用 backupFile。** 现在 workspaceService 会读取该偏好，关闭时不再创建 `.easy-espanso.bak`。
3. **多个数字输入使用普通 `v-model`。** 这类值存在以字符串写入 YAML 的风险。现在 `clipboard_threshold`、`pre_paste_delay`、`post_paste_delay`、`x11_key_delay`、`inject_delay` 全部改为 `v-model.number`，保存前还会做非负数校验。
4. **最近工作区数量虽然 Store 里有 `maxRecentWorkspaces`，设置页没有入口。** 现在增加 3/5/8/12/20 档数量选择和“清空最近工作区”按钮。

此外，对 localStorage 中损坏或旧版用户偏好做了容错：字体缩放、强调色、滚动条、侧栏宽度、界面密度、最近工作区数量如果出现非法值，会自动回退到默认值，降低升级后设置页异常概率。

## 设置项可用性审计

### 已确认有实际消费链路

- 主题：`useTheme.ts` 持久化并实时应用。
- 强调色：通过 `data-accent-color` 驱动 shadcn 主题变量。
- 字体缩放：通过 `--easy-font-scale` 应用。
- 滚动条尺寸：通过 `data-scrollbar-size` 应用。
- 侧栏尺寸 / 标签：分别由 CSS 变量和 AppSidebar 消费。
- 界面密度 / 减少动画：由 global.css 消费。
- 树节点点击展开、搜索自动展开、显示描述、记忆树状态：TreeNode / Store 有实际引用。
- 启动时检查 Espanso：App.vue 有实际分支。
- Toast 位置 / 时长：App.vue 的 Toaster 实际消费。
- 未保存警告：RightPane 有实际引用。
- 自动保存：本轮修复后，RuleEditForm 的隐式保存会遵循开关。
- 保存前备份：本轮修复后，所有走 workspaceService.backupFile 的保存链路会遵循开关。
- 最近工作区数量：Store 初始化时实际用于 rememberWorkspace，本轮增加 UI。
- Espanso 全局配置项：最终走 `updateGlobalConfig -> saveGlobalConfig -> YAML 校验 -> 写入`。

### 仍建议在 Windows + 本机 Espanso 做实机验证的设置

这些字段是否被当前安装的 Espanso 版本接受，最终取决于 Espanso 本身的配置 schema 和平台后端，因此静态检查不能等价于运行时验证：Windows/macOS/Linux 后端专用字段、通知图标/声音、日志字段、快捷键字符串、过滤规则、路径类字段。

建议 v1.3 增加“配置兼容性检查”：保存前调用 Espanso 自身的配置校验/重载命令，并把具体字段错误映射回设置控件，而不是只提示 YAML 语法错误。

## 代码结构优化建议

当前主要复杂度热点：

- `SettingsView.vue` 约 1700 行：模板、偏好绑定、Espanso 配置、平台分支、保存逻辑、样式混在一起。
- `useEspansoStore.ts` 约 1500 行：工作区、树、配置、选择、历史、文件系统等职责过多。
- `RuleEditForm.vue` 约 2100 行：编辑器、变量、表单状态、自动保存、转换逻辑耦合。
- `TreeNode.vue` 约 1000 行：节点展示、交互、上下文菜单、拖拽/展开逻辑集中。

建议下一步按功能拆，而不是按“组件大小”机械拆：

1. 设置页拆为 `BasicSettingsSection / InterfaceSettingsSection / PasteSettingsSection / PlatformSettingsSection / AdvancedSettingsSection / LoggingSettingsSection`，主页面只负责导航、加载、保存和脏状态。
2. 把 Espanso 配置默认值、字段 schema、校验规则抽到 `settingsSchema.ts`，避免模板和类型定义重复。
3. `useEspansoStore` 拆成 `workspaceStore / configTreeStore / selectionStore / historyStore`，文件系统写入继续留在 service。
4. `RuleEditForm` 把数据映射、变量解析、自动保存、CodeMirror 配置分别抽 composable。
5. 建立“用户偏好”和“Espanso 配置”两条明确的数据通道。前者即时生效并存 localStorage，后者显式保存到 YAML，UI 上也应明确标识。

## v1.3 推荐主题：自由度 + 安全感 + 可发现性

优先级建议：

### P0
- 设置搜索：输入“滚动条 / 自动保存 / Windows / 日志”等直接定位设置项。
- 配置字段级校验：数字范围、快捷键格式、路径可访问性、互斥后端组合。
- Espanso 配置测试按钮：保存前执行校验，失败时定位到具体字段。
- 每个设置分类增加“恢复本分类默认值”，并支持撤销。

### P1
- 编辑器：字体大小、自动换行、Tab 宽度、显示行号、自动保存延迟、保存后是否自动 reload Espanso。
- 界面：内容最大宽度、左右面板宽度、记忆分栏位置、列表行高、卡片圆角、动画强度。
- 工作区：最近工作区数量、启动时打开上次工作区、清空历史、固定常用工作区。
- 通知：成功/错误提示独立开关、位置、持续时间、是否播放声音。

### P2
- 应用配置规则测试器：读取当前窗口 title/class/exec，实时显示会命中哪条 profile。
- YAML Diff + 历史时间线 + 单文件恢复。
- Ctrl/Cmd+K 命令面板：跳设置、打开工作区、创建片段、重载 Espanso。
- 设置导入/导出：只导出 Easy Espanso 偏好，和 Espanso YAML 分开。

## 用户体验建议

- 设置页顶部显示“即时生效”与“保存到 Espanso”两类状态，避免用户不知道哪些需要点击保存。
- 对危险或平台相关设置增加状态提示，如“仅 Windows 生效”“需要重启 Espanso”。
- 数字设置尽量使用 Slider + 数字输入双控件，并给出推荐范围和“恢复推荐值”。
- 保存成功后不要整页 reload；只更新原始快照和必要状态，减少界面闪烁。
- 保存失败时保留用户当前编辑内容，不要自动 `loadConfig()` 覆盖，这一点建议 v1.3 优先改。
- 设置导航支持键盘上下移动和搜索结果高亮。

## 验证说明

本轮已完成静态调用链核对、修改点代码检查、ZIP 完整性检查。当前容器没有可用的 Vite 依赖；尝试 `npm install` 在 120 秒内未完成，因此无法在这里完成最终 `npm run build` / Tauri Windows 实机测试。建议在本机执行：

```bash
npm install
npm run build
npm run tauri:build
```

重点验证：关闭自动保存后失焦不写盘、关闭备份后不生成 `.easy-espanso.bak`、五个数字字段写入 YAML 为数字、最近工作区数量和清空按钮、设置保存失败时的提示。
