# Easy Espanso v1.2.2 优化结果

## 已修复

1. **右键粘贴 structuredClone 报错**
   - 根因：Pinia/Vue 响应式 Proxy 被直接传入 `structuredClone`。
   - 新增 `src/utils/safeClone.ts`，统一使用 `toRaw + cloneDeep` 生成历史快照。
   - History Store 在 push / undo / redo 时均使用安全克隆，避免快照从 Pinia ref 取出后再次变成 Proxy 导致复发。

2. **右键菜单“新建”失败**
   - “新建配置文件 / 新建片段”同样会先创建历史快照，因此与粘贴共享同一根因。
   - 修复快照后，新建流程不再在业务动作开始前被 `structuredClone` 中断。

3. **粘贴产生重复撤销记录**
   - 移除 pasteItem 自己的重复 checkpoint。
   - addItem / moveItem 支持传入历史标签，粘贴仍显示为“粘贴片段”，但只产生一条撤销记录。

## 新增设置

- **撤销历史数量**：20 / 60 / 100 / 200，可根据内存与使用习惯调整。
- **删除前二次确认**：熟练用户可关闭，提高右键操作效率。
- **新建文件/文件夹后自动重命名**：可关闭，避免创建后自动抢焦点。

以上设置均写入现有 `userPreferences`，即时保存；中英文文案已补齐。

## 代码结构建议

### 高优先级

1. **合并 RootContextMenu 与 useContextMenu 的创建逻辑**
   - 当前创建文件、文件夹、自动重命名在两处重复维护，后续很容易一处修复另一处遗漏。
   - 建议抽成 `treeOperationService` 或 Store action：`createFile / createFolder / createSnippet / beginRename`。

2. **去掉 DOM 查询 + 人工派发 dblclick 的重命名方式**
   - 当前依赖 `.text-sm.font-medium.flex-grow` 和 `setTimeout(300)`，样式或渲染速度改变就可能失效。
   - 建议在 Store 中增加 `editingNodeId`，TreeNode 根据状态直接进入编辑模式。

3. **Checkpoint 应在校验完成后创建**
   - 目前多处 action 在参数/目标校验前先 checkpoint，失败操作也可能污染撤销栈。
   - 建议统一为：validate -> checkpoint -> mutate -> persist -> success。

4. **文件系统修改需要事务/回滚策略**
   - create/move/delete 同时修改内存树与磁盘，任一阶段失败可能造成两边不一致。
   - 建议封装 operation transaction，失败时 reload 或显式 rollback。

### 中优先级

5. `SettingsView.vue` 已较大，建议按分类拆成 InterfaceSettings / PasteSettings / NotificationSettings / PlatformSettings。
6. 将大量中文硬编码 toast/status 文案迁入 i18n。
7. 统一路径拼接，避免 `${rootDir}/match`，全部走 `platformService.joinPath`，提升 Windows 兼容性。
8. 为 clipboard/history/tree operations 增加 Vitest 单测，重点覆盖 Proxy、copy/cut、跨文件移动、Undo/Redo。

## 下一个版本建议：v1.3 “交互可靠性 + 自定义工作流”

建议不要继续单纯堆设置项，而是围绕高频编辑体验做：

- 原生“编辑状态”重命名，不再模拟双击。
- 新建默认名称模板（例如 `snippet-{date}.yml`、自定义前缀）。
- 新建片段默认插入位置：顶部 / 当前项之后 / 底部。
- 删除行为：确认 / 直接删除 / 移入应用内回收站。
- 自动保存延迟可调（立即 / 300ms / 800ms / 手动）。
- 右键菜单可配置：隐藏低频项、显示快捷键、紧凑模式。
- Undo/Redo 历史面板，可查看最近操作并点击回退。
- 快捷键设置页，允许自定义新建、复制、粘贴、删除、搜索等应用内快捷键。

这样 v1.3 的“自由度”会直接改善日常效率，而不是让设置页面变复杂。

## 验证说明

已完成源码级检查：项目中业务代码不再直接调用 `structuredClone`。
当前运行环境依赖安装超时，无法完成 Vite/Tauri 的实际编译验证；发布前请在本机执行 `npm install && npm run build`，再运行一次 Tauri 开发版做右键菜单回归测试。
