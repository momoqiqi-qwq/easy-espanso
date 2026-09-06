# 应用配置 Hotfix（2026-09-03）

## 修复内容

1. 将“设置 → 应用专用”完整迁移到“应用配置管理器”。
   - 设置侧栏不再显示“应用专用”。
   - 应用配置页“新建配置”直接打开创建对话框，不再跳转设置页。
   - 旧的 `/settings?section=applications` 深链会自动跳转到 `/apps`。

2. 修复编辑应用配置时报错：
   `Failed to execute 'structuredClone' on 'Window': #<Object> could not be cloned.`
   - 原因：Pinia/Vue 把 `AppProfile` 包装成响应式 Proxy，浏览器 `structuredClone()` 无法克隆 Proxy。
   - 修复：编辑前使用 `toRaw()` 解包响应式对象，并显式复制 `raw` 与 `conflicts` 字段，不再直接对 Proxy 调用 `structuredClone()`。

3. 应用配置管理器新增完整创建表单：
   - 配置名称
   - 过滤类型（exec/class/title）
   - 匹配值
   - 输入后端
   - 粘贴快捷键
   - 注入/按键延迟
   - enable / apply_patch

## 建议验证

- 打开“应用配置”，点击任意规则“编辑”，确认不再出现 structuredClone 报错。
- 修改匹配值并保存，确认 YAML 正常写回并刷新列表。
- 点击“新建配置”，确认直接在当前页面创建配置。
- 打开旧地址 `/settings?section=applications`，确认自动跳转到 `/apps`。
