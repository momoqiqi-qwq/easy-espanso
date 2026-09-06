# Easy Espanso UX 优化结果（2026-09-04）

## 本轮已完成

### 1. 拖动不再“一点就拖”

片段树拖动现在增加短按住激活：默认 180ms，并同时增加 4px 的容错距离，减少普通点击、轻微手抖被识别成拖动的情况。

新增“拖动激活时间”界面设置：
- 120ms：较快
- 180ms：推荐（默认）
- 250ms：稳妥
- 350ms：较慢

该设置只影响 Easy Espanso 的拖动交互，不修改 Espanso YAML。

### 2. 纯界面内容可以拖动调整

设置 > 界面新增“左侧导航顺序”拖动预览。用户可以直接拖动“片段 / 应用配置 / 设置”调整显示顺序，修改会实时应用到左侧导航。

这属于 Easy Espanso 本地 UI 偏好，只写入 localStorage，不会改 Espanso 配置内容。

### 3. 增加界面自由度

新增：
- 片段列表宽度：300 / 350 / 420 / 500px
- 树层级缩进：14 / 18 / 20 / 24 / 28px
- 拖动激活时间
- 左侧导航拖动排序

这些项目都属于“界面偏好”，即时生效、自动保存。

### 4. 轻量代码清理

移除了 `MiddlePane.vue` 模板渲染过程中直接执行的 `console.log`，避免每次渲染都产生副作用和调试噪音。

## 代码结构检查结论

当前最值得继续优化的位置：

1. `SettingsView.vue` 仍然过大。建议按分类拆成独立 section 组件，主页面只保留导航、加载和 Espanso 配置保存。
2. `TreeNode.vue` 同时承担渲染、展开、拖动、重命名、上下文菜单、状态提示。建议把拖动逻辑抽为 `useTreeDrag`，重命名逻辑改为 Store 驱动的 `editingNodeId`。
3. `useEspansoStore.ts` 职责过多。建议逐步拆成 workspace / tree / selection / persistence，而不是一次性重写。
4. `RootContextMenu` 与 `useContextMenu` 的新建/重命名流程仍有重复维护风险，建议统一进 tree operation service。
5. `MainLayout.vue` 仍使用屏幕宽度猜测 Windows/macOS 标题栏高度，这不是可靠的平台判断。建议下一轮改为 platformService / Tauri 平台信息。
6. `MainLayout.vue` 通过组件 ref + `@ts-ignore` 把 MiddlePane 传给 RightPane，耦合偏强。建议把共享的选中/焦点状态放入 store/composable。
7. 多个组件仍有较多业务级 `console.log`，建议保留 error/warn，把普通调试日志统一放到 dev logger。

## 建议下一个版本：v1.3 “可自定义工作台”

比继续堆 Espanso 参数更值得优先做的是：

- 左右面板直接拖动分隔线调整宽度，并记忆位置。
- 可配置顶部/右侧常用操作按钮：显示、隐藏、排序。
- 快捷键设置：新建、搜索、保存、删除、复制、粘贴、Undo/Redo。
- 右键菜单自定义：隐藏不常用项、紧凑模式、显示快捷键。
- 编辑器设置：字体大小、换行、Tab 宽度、自动保存延迟。
- 设置搜索 + “只看已修改设置”。
- 每个设置分类单独恢复默认，并提供一次撤销。
- UI 布局预设：紧凑 / 默认 / 大屏编辑 / 极简。

我最建议先做“可拖动分栏 + 工具按钮自定义 + 快捷键设置”，因为这三项对日常使用频率最高，而且符合“自由度更高”的方向。

## 建议下一轮确认的结构优化

如果继续做结构重构，建议先确认是否接受以下范围：

- 拆 `SettingsView.vue`
- 抽 `useTreeDrag`
- 统一 tree operation service
- 移除 MainLayout 的组件 ref 耦合
- 统一 dev logger

这批属于内部结构优化，外观变化不大，但会降低后续继续加功能时的维护成本。

## 验证说明

本轮已做源码级静态检查和修改点复核。当前交付环境没有安装项目的 Vite 依赖，执行 `npm run build` 时提示 `vite: not found`，因此这里无法完成最终前端编译和 Tauri 实机验证。

请在开发机执行：

```bash
npm install
npm run build
npm run tauri:build
```

重点回归：普通点击片段、按住约 180ms 后拖动、跨 YAML 文件拖动、设置导航排序、重启后界面偏好保持、不同片段列表宽度与树缩进。
