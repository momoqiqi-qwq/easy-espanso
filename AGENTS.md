# AGENTS.md — Easy Espanso 项目约定

> 本文件是给 AI 助手 / 协作者看的项目硬约定。**每条都是红线，不要绕过。**

---

## 一、产物命名（最高优先级，不可变）

**可执行文件名永远是 `Easy Espanso.exe`。**

| 项 | 固定值 | 位置 |
| --- | --- | --- |
| 产物主名 / `productName` | `Easy Espanso` | `src-tauri/tauri.conf.json` |
| Windows 主程序文件名 | `Easy Espanso.exe` | 构建产物，**永远带空格、首字母大写** |
| 窗口标题 | `Easy Espanso` | `src-tauri/tauri.conf.json` → `app.windows[].title` |

### 规则

1. **不得**把可执行文件改成 `easy-espanso.exe`、`EasyEspanso.exe`、`easy espanso.exe`
   或其他任何形式。大小写、空格一个都不能动。
2. 分发包命名沿用 Tauri 默认格式，其中产品名部分同样固定为 `Easy Espanso`：
   - 安装包：`Easy Espanso_<version>_x64-setup.exe`（带版本号）
   - 便携版：**`Easy Espanso.exe`** —— **不带版本号、不带任何后缀，这个名称一直不变**
     （完整规定见第四节）
   - **不要**再用 `easy-espanso-<version>-x64-portable.exe`、
     `Easy Espanso_<version>_x64-portable.exe` 这类带版本号的便携版命名
3. 改版本号时，**只改 `<version>` 段**，`Easy Espanso` 这段保持原样。
   **便携版 `Easy Espanso.exe` 里没有 `<version>` 段，永远不动。**
4. 任何脚本、CI、更新下载逻辑里出现的文件名匹配，必须按 `Easy Espanso*.exe` 来写，
   不要按 `easy-espanso*.exe`。
5. `Cargo.toml` 里的 `name = "easy-espanso"` 是 **Rust crate 名**，与产物文件名无关，
   **不需要改**（Rust crate 名不允许空格）。因此 `src-tauri/target/release/` 里出现
   `easy-espanso.exe` 是**正常的内部产物名**，不算违反规则 1 —— 规则 1 约束的是
   **对外分发/交付的文件名**。分发前必须按第四节改名成 `Easy Espanso.exe`。

### 自查

```bash
# ① 构建产物本体（由 Cargo crate 名决定，属「内部产物名」，不是分发名）
ls "src-tauri/target/release/" | grep -i "\.exe"
# 期望看到：easy-espanso.exe

# ② 分发用便携版（必须是这个文件名，一字不差）
ls -l "releases/Easy Espanso.exe"
# 期望看到：Easy Espanso.exe
```

---

## 二、版本号三处同步

`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`
（以及 `src-tauri/Cargo.lock` 里 `name = "easy-espanso"` 那一条）必须完全一致。

---

## 三、构建

- 打包只出 NSIS：`--bundles nsis`
- 构建前逐条递归清 `dist/`（批量删除会被 safe-delete shim 拦）
- `src-tauri/Cargo.toml` 必须保留 `[features] custom-protocol = ["tauri/custom-protocol"]`
- 校验内嵌资源要 **brotli 解压后比 sha256**，不要拿 codegen 文件名当哈希比
- **构建完必须再产出一个便携版 exe 并放进 `releases/`** —— 见第四节，不许省

---

## 四、便携版（每次构建必出，不可省）

**每次构建都必须额外产出一个便携版 exe，放到 `releases/` 目录**（就是之前便携版
所在的位置，与安装包并列）。

**便携版文件名恒为 `Easy Espanso.exe` —— 不带版本号、不带 `_x64` / `-portable` 等任何后缀，
这个名称一直不变**（用户 2026-10-08 定）。它就是第一节里那个"永远不变"的可执行文件名。

| 项 | 值 |
| --- | --- |
| 便携版源文件 | `src-tauri/target/release/easy-espanso.exe`（构建产物本体） |
| 便携版目标 | `releases/Easy Espanso.exe` ← **名称固定，永不改变** |
| 安装包源文件 | `src-tauri/target/release/bundle/nsis/Easy Espanso_<version>_x64-setup.exe` |
| 安装包目标 | `releases/Easy Espanso_<version>_x64-setup.exe`（带版本号） |

### 命令

```bash
V=$(node -p "require('./package.json').version")
# 便携版：名称固定，每次构建直接覆盖
cp "src-tauri/target/release/easy-espanso.exe"                            "releases/Easy Espanso.exe"
# 安装包：带版本号，每个版本各留一份
cp "src-tauri/target/release/bundle/nsis/Easy Espanso_${V}_x64-setup.exe" "releases/Easy Espanso_${V}_x64-setup.exe"
```

### 规则

1. **便携版就是构建出的 exe 本体，只改名**：不裁剪、不压缩、不额外打包。
   重命名不影响运行 —— 应用不依赖自身文件名（更新检查找的是 release 里的 `*setup.exe`，
   图标/路径解析都以自身所在目录为基准）。
2. **便携版文件名恒为 `Easy Espanso.exe`**：带空格、首字母大写，**没有版本号**。
   每次构建**直接覆盖**同一个文件，不产生第二个便携版。
   **不得**出现 `easy-espanso-<version>-x64-portable.exe`、
   `Easy Espanso_<version>_x64-portable.exe` 等任何带版本号/后缀的便携版名字 ——
   那些是 `Cargo.toml` crate 名或旧约定带出来的，**不是分发名**（见第一节）。
3. 安装包相反：**必须带版本号**，`<version>` 与三处版本号一致（见第二节），
   每个版本各留一份，旧版本产物留在它自己的版本名下、不要改名。
4. 复制完必须核对**内容一致**（比大小 / sha256），不能只看"文件存在"。
5. `releases/` 已在 `.gitignore` 里，**不要提交**（分发靠 GitHub Release，不靠仓库二进制）。

### 自查

```bash
V=$(node -p "require('./package.json').version")
ls -l "releases/Easy Espanso.exe" "releases/Easy Espanso_${V}_x64-setup.exe"
cmp "src-tauri/target/release/easy-espanso.exe" "releases/Easy Espanso.exe" \
  && echo "✅ 便携版与构建产物一致"

# 反向检查：releases/ 里不该再有任何带版本号/后缀的便携版
ls releases/ | grep -Ei 'portable' && echo "❌ 存在多余的便携版命名，应删除" || echo "✅ 便携版命名唯一"
```

