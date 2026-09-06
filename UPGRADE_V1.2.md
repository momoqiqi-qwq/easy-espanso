# Easy Espanso v1.2

## 新功能
- 应用配置管理器：自动扫描 `config/*.yml` / `*.yaml` 中包含 `filter_exec`、`filter_class`、`filter_title` 的配置。
- 应用规则启停：停用时改名为 `.yml.disabled`，不会被 Espanso 当作 YAML 配置加载。
- 显式优先级：通过 `001-`、`002-` 文件名前缀调整 Espanso 的文件名匹配顺序。
- 冲突提示：检测相同过滤类型 + 相同过滤值的启用规则。
- 编辑器 Undo / Redo：保存最近 60 个编辑快照，支持 Ctrl/Cmd+Z、Ctrl/Cmd+Y（macOS 也支持 Cmd+Shift+Z）。撤销后会把恢复状态重新写回 YAML。
- Ctrl/Cmd+K 命令面板：页面跳转、撤销/重做、打开配置目录、重启 Espanso、展开/折叠配置树。

## 设计说明
Espanso 的应用专用配置位于 `config` 目录，并使用 `filter_exec` / `filter_class` / `filter_title`。多个规则匹配时，文件名顺序会影响选择，因此管理器将优先级直接映射为文件名前缀，避免维护一套与 Espanso 不一致的私有优先级。

## 后续建议
v1.3 可增加：规则正则表达式测试器、`#detect#` 结果一键导入、应用图标识别、配置差异预览、历史时间线 UI，以及把大 Store 拆成 workspace/tree/snippet 三个 store。
