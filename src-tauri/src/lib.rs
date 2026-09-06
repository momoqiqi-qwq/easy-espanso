use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashSet,
    env,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    name: String,
    path: String,
    extension: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemNode {
    #[serde(rename = "type")]
    node_type: String,
    name: String,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileSystemNode>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EspansoRuntimeStatus {
    installed: bool,
    running: bool,
    state: String,
    executable_path: Option<String>,
    source: Option<String>,
    version: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EspansoControlResult {
    success: bool,
    action: String,
    executable_path: String,
    output: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenPathRequest {
    path: String,
}



#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupRequest {
    source_root: String,
    target_root: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RestoreRequest {
    backup_root: String,
    target_root: String,
    preserve_matches: bool,
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), String> {
    if !source.exists() { return Ok(()); }
    fs::create_dir_all(target).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src = entry.path();
        let dst = target.join(entry.file_name());
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_dir_recursive(&src, &dst)?;
        } else {
            if let Some(parent) = dst.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
            fs::copy(&src, &dst).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

// 文件 I/O 与子进程命令均为 async：Tauri 的同步命令在主线程执行，
// 大目录扫描或等待子进程会冻结窗口；async 命令自动跑在线程池上。
#[tauri::command]
async fn export_espanso_backup(request: BackupRequest) -> Result<String, String> {
    let source = PathBuf::from(request.source_root);
    let target = PathBuf::from(request.target_root);
    if !source.is_dir() { return Err("Espanso config root does not exist".into()); }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    for name in ["config", "match", "packages"] {
        copy_dir_recursive(&source.join(name), &target.join(name))?;
    }
    Ok(path_string(&target))
}

#[tauri::command]
async fn import_espanso_backup(request: RestoreRequest) -> Result<(), String> {
    let backup = PathBuf::from(request.backup_root);
    let target = PathBuf::from(request.target_root);
    if !backup.is_dir() { return Err("Backup folder does not exist".into()); }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    for name in ["config", "packages"] {
        let src = backup.join(name);
        if src.exists() {
            let dst = target.join(name);
            if dst.exists() { fs::remove_dir_all(&dst).map_err(|e| e.to_string())?; }
            copy_dir_recursive(&src, &dst)?;
        }
    }
    if !request.preserve_matches {
        let src = backup.join("match");
        if src.exists() {
            let dst = target.join("match");
            if dst.exists() { fs::remove_dir_all(&dst).map_err(|e| e.to_string())?; }
            copy_dir_recursive(&src, &dst)?;
        }
    } else {
        // Espanso packages live under match/packages. Preserve the user's normal
        // match files while still restoring package backups.
        let src = backup.join("match").join("packages");
        if src.exists() {
            let match_dst = target.join("match");
            fs::create_dir_all(&match_dst).map_err(|e| e.to_string())?;
            let dst = match_dst.join("packages");
            if dst.exists() { fs::remove_dir_all(&dst).map_err(|e| e.to_string())?; }
            copy_dir_recursive(&src, &dst)?;
        }
    }
    Ok(())
}

fn child_command<S: AsRef<std::ffi::OsStr>>(program: S) -> Command {
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn scan_dir(path: &Path) -> Result<Vec<FileSystemNode>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let mut nodes = Vec::new();
    for entry in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if file_type.is_dir() {
            nodes.push(FileSystemNode {
                node_type: "directory".into(),
                name,
                path: path_string(&entry_path),
                children: Some(scan_dir(&entry_path)?),
            });
        } else {
            nodes.push(FileSystemNode {
                node_type: "file".into(),
                name,
                path: path_string(&entry_path),
                children: None,
            });
        }
    }
    nodes.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(nodes)
}

#[tauri::command]
async fn read_file(file_path: String) -> Result<String, String> {
    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(file_path: String, content: String) -> Result<(), String> {
    fs::write(file_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn file_exists(file_path: String) -> bool {
    Path::new(&file_path).is_file()
}

#[tauri::command]
async fn directory_exists(dir_path: String) -> bool {
    Path::new(&dir_path).is_dir()
}

#[tauri::command]
async fn create_directory(dir_path: String) -> Result<(), String> {
    fs::create_dir_all(dir_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_files(dir_path: String) -> Result<Vec<FileInfo>, String> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let extension = path.extension().map(|v| v.to_string_lossy().into_owned()).unwrap_or_default();
        files.push(FileInfo { name, path: path_string(&path), extension });
    }
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(files)
}

#[tauri::command]
async fn scan_directory(dir_path: String) -> Result<Vec<FileSystemNode>, String> {
    scan_dir(Path::new(&dir_path))
}

#[tauri::command]
async fn delete_file(file_path: String) -> Result<(), String> {
    fs::remove_file(file_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_directory(dir_path: String) -> Result<(), String> {
    fs::remove_dir_all(dir_path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn rename_file_or_directory(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(old_path, new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn join_path(paths: Vec<String>) -> String {
    let mut result = PathBuf::new();
    for part in paths {
        result.push(part);
    }
    path_string(&result)
}

#[tauri::command]
fn get_platform() -> String {
    if cfg!(target_os = "windows") { "win32".into() }
    else if cfg!(target_os = "macos") { "darwin".into() }
    else if cfg!(target_os = "linux") { "linux".into() }
    else { "unknown".into() }
}

#[tauri::command]
fn get_environment_variable(name: String) -> Option<String> {
    env::var(name).ok()
}

#[tauri::command]
fn parse_yaml(content: String) -> Result<Value, String> {
    let yaml: serde_yaml::Value = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;
    serde_json::to_value(yaml).map_err(|e| e.to_string())
}

#[tauri::command]
fn serialize_yaml(data: Value) -> Result<String, String> {
    serde_yaml::to_string(&data).map_err(|e| e.to_string())
}

fn is_existing_file(path: &Path) -> bool { path.is_file() }

fn common_espanso_paths() -> Vec<PathBuf> {
    let home = env::var_os("USERPROFILE").or_else(|| env::var_os("HOME")).map(PathBuf::from);
    let mut result = Vec::new();
    if cfg!(target_os = "windows") {
        let local = env::var_os("LOCALAPPDATA").map(PathBuf::from);
        let app = env::var_os("APPDATA").map(PathBuf::from);
        let pf = env::var_os("ProgramFiles").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Program Files"));
        let pfx = env::var_os("ProgramFiles(x86)").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Program Files (x86)"));
        if let Some(v) = local { result.push(v.join("Programs/Espanso/espanso.exe")); result.push(v.join("Programs/espanso/espanso.exe")); result.push(v.join("Espanso/espanso.exe")); }
        if let Some(v) = app { result.push(v.join("Espanso/espanso.exe")); }
        result.push(pf.join("Espanso/espanso.exe"));
        result.push(pfx.join("Espanso/espanso.exe"));
        if let Some(h) = home { result.push(h.join("scoop/shims/espanso.exe")); }
        result.push(PathBuf::from(r"C:\ProgramData\chocolatey\bin\espanso.exe"));
    } else if cfg!(target_os = "macos") {
        result.extend([PathBuf::from("/opt/homebrew/bin/espanso"), PathBuf::from("/usr/local/bin/espanso"), PathBuf::from("/usr/bin/espanso"), PathBuf::from("/Applications/Espanso.app/Contents/MacOS/espanso")]);
        if let Some(h) = home { result.push(h.join(".local/bin/espanso")); }
    } else {
        result.extend([PathBuf::from("/usr/bin/espanso"), PathBuf::from("/usr/local/bin/espanso"), PathBuf::from("/snap/bin/espanso")]);
        if let Some(h) = home { result.push(h.join(".local/bin/espanso")); }
    }
    result
}

fn path_espanso_candidates() -> Vec<PathBuf> {
    let exe = if cfg!(target_os = "windows") { "espanso.exe" } else { "espanso" };
    env::var_os("PATH").map(|p| env::split_paths(&p).map(|d| d.join(exe)).collect()).unwrap_or_default()
}

/// Ask the operating system's command locator for Espanso.
///
/// This intentionally complements (rather than replaces) direct PATH scanning:
/// GUI applications can inherit a different PATH than an interactive shell, while
/// `where.exe`/`which` may still resolve the executable using the OS shell setup.
fn system_espanso_candidates() -> Vec<PathBuf> {
    let mut command = if cfg!(target_os = "windows") {
        let mut command = child_command("where.exe");
        command.arg("espanso");
        command
    } else {
        let mut command = child_command("which");
        command.arg("espanso");
        command
    };

    let Ok(output) = command.stdin(Stdio::null()).output() else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| PathBuf::from(line.trim_matches('"')))
        .collect()
}

fn resolve_espanso(custom_path: &str) -> Option<(PathBuf, String)> {
    if !custom_path.is_empty() {
        let p = PathBuf::from(custom_path);
        let name = p.file_name().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();
        if is_existing_file(&p) && (name == "espanso" || name == "espanso.exe") { return Some((p, "custom".into())); }
    }
    let mut seen = HashSet::new();
    let candidates = path_espanso_candidates()
        .into_iter()
        .map(|p| (p, "path"))
        .chain(system_espanso_candidates().into_iter().map(|p| (p, "system-command")))
        .chain(common_espanso_paths().into_iter().map(|p| (p, "common")));

    for (path, source) in candidates {
        let key = path_string(&path).to_ascii_lowercase();
        if seen.insert(key) && is_existing_file(&path) { return Some((path, source.into())); }
    }
    None
}

fn run_espanso(path: &Path, arg: &str) -> Result<(String, String, bool), String> {
    let output = child_command(path).arg(arg).stdin(Stdio::null()).output().map_err(|e| e.to_string())?;
    Ok((String::from_utf8_lossy(&output.stdout).trim().to_string(), String::from_utf8_lossy(&output.stderr).trim().to_string(), output.status.success()))
}

fn combined_output(stdout: String, stderr: String) -> String {
    [stdout, stderr].into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n")
}

#[tauri::command]
async fn get_espanso_status(custom_executable_path: Option<String>) -> EspansoRuntimeStatus {
    let custom = custom_executable_path.unwrap_or_default();
    let Some((path, source)) = resolve_espanso(&custom) else {
        return EspansoRuntimeStatus { installed: false, running: false, state: "not-found".into(), executable_path: None, source: None, version: String::new(), message: "Espanso executable was not found.".into() };
    };
    let version = run_espanso(&path, "--version").ok().map(|(o,e,_)| combined_output(o,e).lines().next().unwrap_or("").to_string()).unwrap_or_default();
    match run_espanso(&path, "status") {
        Ok((out, err, success)) => {
            let message = combined_output(out, err);
            let lower = message.to_ascii_lowercase();
            let stopped = lower.contains("not running") || lower.contains("stopped") || lower.contains("inactive") || lower.contains("not started") || !success;
            EspansoRuntimeStatus { installed: true, running: !stopped, state: if stopped { "stopped".into() } else { "running".into() }, executable_path: Some(path_string(&path)), source: Some(source), version, message }
        }
        Err(message) => EspansoRuntimeStatus { installed: true, running: false, state: "unknown".into(), executable_path: Some(path_string(&path)), source: Some(source), version, message },
    }
}

#[tauri::command]
async fn control_espanso(action: String, custom_executable_path: Option<String>) -> Result<EspansoControlResult, String> {
    if !matches!(action.as_str(), "start" | "stop" | "restart") { return Err(format!("Unsupported Espanso action: {action}")); }
    let custom = custom_executable_path.unwrap_or_default();
    let (path, _) = resolve_espanso(&custom).ok_or_else(|| "Espanso executable was not found.".to_string())?;
    let (out, err, success) = run_espanso(&path, &action)?;
    if !success { return Err(combined_output(out, err)); }
    Ok(EspansoControlResult { success: true, action, executable_path: path_string(&path), output: combined_output(out, err) })
}

#[tauri::command]
fn open_in_explorer(request: OpenPathRequest) -> Result<bool, String> {
    let path = PathBuf::from(request.path);
    if !path.exists() { return Err("Path does not exist".into()); }
    // File managers are GUI processes and their exit status is not a reliable
    // signal that the requested window was opened (notably explorer.exe may
    // return a non-zero status when it hands the request to an existing shell).
    // Treat a successful process spawn as success instead of waiting for exit.
    if cfg!(target_os = "windows") {
        let mut command = child_command("explorer.exe");
        if path.is_file() { command.arg(format!("/select,{}", path_string(&path))); }
        else { command.arg(&path); }
        command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| e.to_string())?;
    } else if cfg!(target_os = "macos") {
        let mut command = child_command("open");
        if path.is_file() { command.arg("-R").arg(&path); }
        else { command.arg(&path); }
        command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| e.to_string())?;
    } else {
        let target = if path.is_file() { path.parent().unwrap_or(Path::new("/")) } else { path.as_path() };
        child_command("xdg-open").arg(target).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|e| e.to_string())?;
    }
    Ok(true)
}


const B64_ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn b64_encode(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | (b[2] as u32);
        out.push(B64_ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(B64_ALPHABET[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { B64_ALPHABET[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { B64_ALPHABET[n as usize & 63] as char } else { '=' });
    }
    out
}

fn b64_decode(data: &str) -> Option<Vec<u8>> {
    fn val(c: u8) -> Option<u32> {
        match c {
            b'A'..=b'Z' => Some((c - b'A') as u32),
            b'a'..=b'z' => Some((c - b'a') as u32 + 26),
            b'0'..=b'9' => Some((c - b'0') as u32 + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let clean: Vec<u8> = data.bytes().filter(|b| !b.is_ascii_whitespace() && *b != b'=').collect();
    let mut out = Vec::with_capacity(clean.len() / 4 * 3);
    for chunk in clean.chunks(4) {
        let mut n: u32 = 0;
        for (i, c) in chunk.iter().enumerate() {
            n |= val(*c)? << (18 - 6 * i);
        }
        out.push((n >> 16) as u8);
        if chunk.len() > 2 { out.push((n >> 8) as u8); }
        if chunk.len() > 3 { out.push(n as u8); }
    }
    Some(out)
}

/// FNV-1a，用作图标缓存文件名
fn hash_key(s: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", h)
}

fn icon_cache_dir() -> Option<PathBuf> {
    let base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))?;
    let dir = PathBuf::from(base).join("com.easy-espanso").join("icons");
    fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

/// 程序正在运行时，通过进程快照直接拿完整路径（纯 WinAPI，毫秒级）
#[cfg(target_os = "windows")]
fn find_running_process_path(exe_name: &str) -> Option<String> {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == -1isize as _ { return None; }
        let lower_name = exe_name.to_lowercase();
        let mut pids: Vec<u32> = Vec::new();

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                let pname = String::from_utf16_lossy(&entry.szExeFile);
                if pname.trim_end_matches('\0').to_lowercase() == lower_name {
                    pids.push(entry.th32ProcessID);
                }
                if Process32NextW(snapshot, &mut entry) == 0 { break; }
            }
        }
        CloseHandle(snapshot);

        for pid in pids {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() { continue; }
            let mut buf = vec![0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut len);
            CloseHandle(handle);
            if ok != 0 {
                let path = String::from_utf16_lossy(&buf[..len as usize]);
                if !path.is_empty() && Path::new(&path).is_file() {
                    return Some(path);
                }
            }
        }
        None
    }
}

/// 在系统目录、PATH、常见安装/下载目录、注册表 App Paths、UWP 商店包中把 exe 名解析成完整路径
fn resolve_exe_path(executable: &str) -> Option<String> {
    let trimmed = executable.trim().trim_matches('"');
    if trimmed.is_empty() { return None; }
    if Path::new(trimmed).is_file() { return Some(trimmed.to_string()); }

    // 统一用文件名做后续搜索
    let name = Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(trimmed)
        .to_string();

    #[cfg(target_os = "windows")]
    {
        // 1. 程序正在运行时，进程快照直接给出完整路径（对任意盘符/目录的程序都有效）
        if let Some(found) = find_running_process_path(&name) {
            return Some(found);
        }

        // 2. 系统自带程序（cmd/powershell/notepad 等）秒解析
        for dir in [r"C:\Windows\System32", r"C:\Windows"] {
            let cand = Path::new(dir).join(&name);
            if cand.is_file() { return Some(cand.to_string_lossy().into_owned()); }
        }

        // 3. 常见下载/安装位置：下载与桌面根目录、两层常见程序目录
        if let Some(home) = env::var_os("USERPROFILE").map(PathBuf::from) {
            for dir in [home.join("Downloads"), home.join("Desktop")] {
                let cand = dir.join(&name);
                if cand.is_file() { return Some(cand.to_string_lossy().into_owned()); }
            }
        }
        let mut tree_roots: Vec<PathBuf> = vec![
            PathBuf::from(r"C:\Program Files"),
            PathBuf::from(r"C:\Program Files (x86)"),
        ];
        if let Some(local) = env::var_os("LOCALAPPDATA") {
            tree_roots.push(PathBuf::from(local).join("Programs"));
        }
        if let Some(found) = find_exe_in_trees(&name, &tree_roots) {
            return Some(found);
        }
    }

    // 4. PATH / 系统命令定位器
    let locator = if cfg!(target_os = "windows") { "where.exe" } else { "which" };
    if let Ok(output) = child_command(locator).arg(&name).stdin(Stdio::null()).output() {
        if output.status.success() {
            if let Some(found) = String::from_utf8_lossy(&output.stdout)
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty())
                .map(|line| line.trim_matches('"').to_string())
                .find(|line| Path::new(line).is_file())
            {
                return Some(found);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // 5. 注册表 App Paths（大量桌面软件在此注册）
        let reg_key = format!(
            r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{}",
            name
        );
        if let Ok(out) = child_command("reg.exe")
            .args(["query", &reg_key, "/ve"])
            .stdin(Stdio::null())
            .output()
        {
            if out.status.success() {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    if let Some(pos) = line.find("REG_SZ") {
                        let val = line[pos + 6..].trim().trim_matches('"');
                        if !val.is_empty() && Path::new(val).is_file() {
                            return Some(val.to_string());
                        }
                    }
                }
            }
        }

        // 6. UWP/商店应用（如 WindowsTerminal）：按包名匹配安装目录（耗时一次性，结果落盘缓存）
        if let Some(stem) = name.to_lowercase().strip_suffix(".exe") {
            let ps = format!(
                "Get-AppxPackage *{}* | ForEach-Object {{ $c1 = Join-Path $_.InstallLocation '{}'; $c2 = Join-Path $_.InstallLocation ($_.PackageFamilyName + '.exe'); if (Test-Path $c1) {{ $c1 }} elseif (Test-Path $c2) {{ $c2 }} }}",
                stem, name
            );
            if let Ok(out) = child_command("powershell.exe")
                .args(["-NoProfile", "-NonInteractive", "-Command", &ps])
                .stdin(Stdio::null())
                .output()
            {
                if out.status.success() {
                    for line in String::from_utf8_lossy(&out.stdout).lines() {
                        let cand = line.trim().trim_matches('"');
                        if !cand.is_empty() && Path::new(cand).is_file() {
                            return Some(cand.to_string());
                        }
                    }
                }
            }
        }
    }

    None
}

/// 在若干目录树里各下探一层寻找目标 exe（Program Files\<vendor>\<name> 这类布局）
fn find_exe_in_trees(name: &str, roots: &[PathBuf]) -> Option<String> {
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else { continue };
        for entry in entries.flatten() {
            let cand = entry.path().join(name);
            if cand.is_file() {
                return Some(cand.to_string_lossy().into_owned());
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn extract_icon_bmp_data_url(full_path: &str) -> Result<String, String> {
    use windows_sys::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC,
        BITMAP, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, HBITMAP,
    };
    use windows_sys::Win32::UI::Shell::SHDefExtractIconW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    const SIZE: i32 = 32;
    unsafe {
        let mut wide: Vec<u16> = full_path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut hicon: windows_sys::Win32::Foundation::HANDLE = std::ptr::null_mut();
        let size_param = (SIZE | (SIZE << 16)) as u32;
        let res = SHDefExtractIconW(wide.as_mut_ptr(), 0, 0, &mut hicon, std::ptr::null_mut(), size_param);
        if res != 0 || hicon.is_null() {
            return Err("图标提取失败".into());
        }

        let mut info: ICONINFO = std::mem::zeroed();
        let result = (|| -> Result<String, String> {
            if GetIconInfo(hicon as _, &mut info) == 0 {
                return Err("GetIconInfo 失败".into());
            }
            let color_bmp: HBITMAP = info.hbmColor;
            // 单色图标时 hbmColor 为空，用 mask 位图兜底
            let src_bmp: HBITMAP = if color_bmp.is_null() { info.hbmMask } else { color_bmp };

            let mut bmp_meta: BITMAP = std::mem::zeroed();
            if GetObjectW(
                src_bmp as _,
                std::mem::size_of::<BITMAP>() as i32,
                &mut bmp_meta as *mut _ as *mut _,
            ) == 0
            {
                DeleteObject(color_bmp);
                if !info.hbmMask.is_null() && info.hbmMask != color_bmp { DeleteObject(info.hbmMask); }
                return Err("GetObject 失败".into());
            }
            let w = bmp_meta.bmWidth;
            let h = bmp_meta.bmHeight.abs();

            let hdc_screen = GetDC(std::ptr::null_mut());
            let hdc_mem = CreateCompatibleDC(hdc_screen);
            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: w,
                    biHeight: h, // 正数 = 自下而上，与 BMP 文件行序一致
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: 0, // BI_RGB
                    ..std::mem::zeroed()
                },
                ..std::mem::zeroed()
            };
            let mut pixels = vec![0u8; (w as usize) * (h as usize) * 4];
            let got = GetDIBits(
                hdc_mem,
                src_bmp,
                0,
                h as u32,
                pixels.as_mut_ptr() as *mut _,
                &mut bmi as *mut _ as *mut _,
                DIB_RGB_COLORS,
            );
            DeleteDC(hdc_mem);
            ReleaseDC(std::ptr::null_mut(), hdc_screen);
            if got == 0 {
                DeleteObject(color_bmp);
                if !info.hbmMask.is_null() && info.hbmMask != color_bmp { DeleteObject(info.hbmMask); }
                return Err("GetDIBits 失败".into());
            }

            // 某些图标的 alpha 位未写（全 0），按不透明处理
            if pixels.chunks_exact(4).all(|px| px[3] == 0) {
                for px in pixels.chunks_exact_mut(4) {
                    px[3] = 255;
                }
            }

            let w_u = w as u32;
            let h_u = h as u32;
            let pixel_bytes = pixels.len() as u32;
            let mut bmp = Vec::with_capacity(54 + pixels.len());
            bmp.extend_from_slice(b"BM");
            bmp.extend_from_slice(&(54u32 + pixel_bytes).to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&54u32.to_le_bytes());
            bmp.extend_from_slice(&40u32.to_le_bytes());
            bmp.extend_from_slice(&w_u.to_le_bytes());
            bmp.extend_from_slice(&h_u.to_le_bytes());
            bmp.extend_from_slice(&1u16.to_le_bytes());
            bmp.extend_from_slice(&32u16.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
            bmp.extend_from_slice(&pixel_bytes.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&pixels);
            Ok(format!("data:image/bmp;base64,{}", b64_encode(&bmp)))
        })();

        if !info.hbmColor.is_null() { DeleteObject(info.hbmColor); }
        if !info.hbmMask.is_null() && info.hbmMask != info.hbmColor { DeleteObject(info.hbmMask); }
        DestroyIcon(hicon as _);
        result
    }
}

#[cfg(not(target_os = "windows"))]
fn extract_icon_bmp_data_url(_full_path: &str) -> Result<String, String> {
    Err("仅支持 Windows".into())
}

/// 提取应用可执行文件的图标，返回 BMP data URL 供 <img> 直接显示。
/// 缓存键统一为 exe 文件名（小写）：创建配置时可用完整路径提取一次，
/// 之后卡片列表按文件名查找直接命中。结果持久化到 %LOCALAPPDATA%。
#[tauri::command]
async fn get_app_icon_base64(executable: String) -> Result<String, String> {
    let trimmed = executable.trim().trim_matches('"');
    if trimmed.is_empty() { return Err("可执行文件为空".into()); }
    let exe_name = Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| trimmed.to_lowercase());
    let key = hash_key(&exe_name);
    let cache_dir = icon_cache_dir().ok_or_else(|| "无法创建图标缓存目录".to_string())?;
    let cache_file = cache_dir.join(format!("{}.bmp", key));
    let miss_file = cache_dir.join(format!("{}.miss", key));

    // 命中缓存直接返回（创建时用完整路径预取的图标也会落在这里）
    if let Ok(bytes) = fs::read(&cache_file) {
        if !bytes.is_empty() {
            return Ok(format!("data:image/bmp;base64,{}", b64_encode(&bytes)));
        }
    }
    // 之前解析失败的不再重复尝试（开销大的 PowerShell/注册表查询）
    if miss_file.exists() {
        return Err("未找到可执行文件".into());
    }

    let resolved = resolve_exe_path(trimmed);
    let Some(full_path) = resolved else {
        let _ = fs::write(&miss_file, b"");
        return Err("未找到可执行文件".into());
    };
    let full_path = full_path.trim_matches('"').to_string();

    match extract_icon_bmp_data_url(&full_path) {
        Ok(data_url) => {
            if let Some(b64) = data_url.strip_prefix("data:image/bmp;base64,") {
                if let Some(bytes) = b64_decode(b64) {
                    let _ = fs::write(&cache_file, bytes);
                }
            }
            Ok(data_url)
        }
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn get_executable_under_cursor() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::Foundation::{CloseHandle, POINT};
        use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetCursorPos, GetWindowThreadProcessId, WindowFromPoint};

        let mut point = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut point) == 0 { return Err("无法读取鼠标位置".into()); }
        let hwnd = WindowFromPoint(point);
        if hwnd.is_null() { return Err("鼠标下方没有可识别的窗口".into()); }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 { return Err("无法识别目标进程".into()); }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() { return Err("无法读取目标进程路径，请尝试以相同权限运行 Easy Espanso".into()); }
        let mut buf = vec![0u16; 32768];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buf.as_mut_ptr(), &mut len);
        CloseHandle(process);
        if ok == 0 { return Err("无法读取目标程序路径".into()); }
        Ok(String::from_utf16_lossy(&buf[..len as usize]))
    }
    #[cfg(not(target_os = "windows"))]
    { Err("拖动准星识别程序当前仅支持 Windows".into()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_file, write_file, file_exists, directory_exists, create_directory,
            list_files, scan_directory, delete_file, delete_directory,
            rename_file_or_directory, join_path, get_platform, get_environment_variable,
            parse_yaml, serialize_yaml, get_espanso_status, control_espanso, open_in_explorer,
            get_executable_under_cursor, export_espanso_backup, import_espanso_backup,
            get_app_icon_base64
        ])
        .run(tauri::generate_context!())
        .expect("error while running Easy Espanso");
}
