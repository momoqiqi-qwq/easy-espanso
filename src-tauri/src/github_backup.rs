//! GitHub Contents API backup support.
//!
//! The renderer never receives the PAT. On Windows it is protected with DPAPI and
//! this module performs all authenticated requests natively. The archive contains
//! only Espanso's `config`, `match`, and `packages` directories plus a small manifest.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::{Client, Method, RequestBuilder, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Cursor, Seek, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const API_ROOT: &str = "https://api.github.com";
const API_VERSION: &str = "2022-11-28";
const TOKEN_FILE: &str = "github-token.dpapi";
const BACKUP_ROOT: &str = ".easy-espanso/backups";
// Contents API accepts files below 100 MB. Leave room for base64 and JSON request
// overhead so an archive which passes the local check is not rejected remotely.
const MAX_ARCHIVE_BYTES: usize = 70 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepository {
    pub repository: String,
    pub owner: String,
    pub name: String,
    pub default_branch: String,
    pub private: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubBackupEntry {
    pub name: String,
    pub path: String,
    pub sha: String,
    pub size: u64,
    pub download_url: Option<String>,
    pub html_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct BackupManifest {
    format: &'static str,
    version: u32,
    created_at: u64,
}

#[derive(Debug, Deserialize)]
struct GitHubContent {
    name: String,
    path: String,
    sha: String,
    #[serde(default)]
    size: u64,
    download_url: Option<String>,
    html_url: Option<String>,
    #[serde(rename = "type")]
    content_type: Option<String>,
}

fn token_path(config_root: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(config_root);
    if !root.is_dir() {
        return Err("Espanso 配置目录不存在".into());
    }
    Ok(root.join(TOKEN_FILE))
}

fn validate_token(token: &str) -> Result<&str, String> {
    let token = token.trim();
    if token.is_empty() || token.len() > 512 || token.chars().any(|c| c == '\r' || c == '\n') {
        return Err("GitHub 令牌格式无效".into());
    }
    Ok(token)
}

#[cfg(windows)]
fn protect_token(token: &str) -> Result<Vec<u8>, String> {
    use std::ptr::null;
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CryptProtectData, CRYPT_INTEGER_BLOB},
    };

    let bytes = token.as_bytes();
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    let ok = unsafe { CryptProtectData(&input, null(), null(), null(), null(), 0, &mut output) };
    if ok == 0 || output.pbData.is_null() {
        return Err("Windows DPAPI 无法保护 GitHub 令牌".into());
    }
    let encrypted = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData.cast()) };
    Ok(encrypted)
}

#[cfg(not(windows))]
fn protect_token(_token: &str) -> Result<Vec<u8>, String> {
    Err("GitHub 备份令牌保护目前仅支持 Windows DPAPI".into())
}

#[cfg(windows)]
fn unprotect_token(encrypted: &[u8]) -> Result<String, String> {
    use std::ptr::null;
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CryptUnprotectData, CRYPT_INTEGER_BLOB},
    };

    let input = CRYPT_INTEGER_BLOB { cbData: encrypted.len() as u32, pbData: encrypted.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    let ok = unsafe { CryptUnprotectData(&input, std::ptr::null_mut(), null(), null(), null(), 0, &mut output) };
    if ok == 0 || output.pbData.is_null() {
        return Err("无法解密 GitHub 令牌，请重新输入".into());
    }
    let plain = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData.cast()) };
    let token = String::from_utf8(plain).map_err(|_| "GitHub 令牌编码无效".to_string())?;
    validate_token(&token).map(str::to_owned)
}

#[cfg(not(windows))]
fn unprotect_token(_encrypted: &[u8]) -> Result<String, String> {
    Err("GitHub 备份令牌保护目前仅支持 Windows DPAPI".into())
}

fn load_token(config_root: &str) -> Result<String, String> {
    let path = token_path(config_root)?;
    let encrypted = fs::read(path).map_err(|_| "尚未配置 GitHub 令牌".to_string())?;
    unprotect_token(&encrypted)
}

/// Save a PAT without returning or logging it. The plaintext is only held for this call.
#[tauri::command]
pub fn github_backup_save_token(config_root: String, token: String) -> Result<(), String> {
    let token = validate_token(&token)?;
    let path = token_path(&config_root)?;
    let encrypted = protect_token(token)?;
    let partial = path.with_extension("dpapi.part");
    fs::write(&partial, encrypted).map_err(|_| "保存 GitHub 令牌失败".to_string())?;
    // Windows rename does not replace an existing file. The replacement is
    // fully encrypted before the old token is removed.
    #[cfg(windows)]
    if path.exists() {
        fs::remove_file(&path).map_err(|_| "保存 GitHub 令牌失败".to_string())?;
    }
    if let Err(error) = fs::rename(&partial, &path) {
        let _ = fs::remove_file(&partial);
        return Err(format!("保存 GitHub 令牌失败: {error}"));
    }
    Ok(())
}

#[tauri::command]
pub fn github_backup_has_token(config_root: String) -> Result<bool, String> {
    Ok(token_path(&config_root)?.is_file())
}

#[tauri::command]
pub fn github_backup_clear_token(config_root: String) -> Result<(), String> {
    let path = token_path(&config_root)?;
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("删除 GitHub 令牌失败".into()),
    }
}

fn parse_repository(value: &str) -> Result<(String, String, String), String> {
    let value = value.trim();
    let slug = if let Some(rest) = value.strip_prefix("git@github.com:") {
        rest.to_owned()
    } else {
        let url = reqwest::Url::parse(value).map_err(|_| "GitHub 仓库地址无效".to_string())?;
        if url.scheme() != "https" || url.host_str() != Some("github.com") || url.query().is_some() || url.fragment().is_some() {
            return Err("GitHub 仓库地址无效".into());
        }
        url.path().trim_matches('/').to_owned()
    };
    let slug = slug.strip_suffix(".git").unwrap_or(&slug).trim_matches('/');
    let mut parts = slug.split('/');
    let owner = parts.next().unwrap_or("");
    let name = parts.next().unwrap_or("");
    if owner.is_empty() || name.is_empty() || parts.next().is_some()
        || !owner.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err("GitHub 仓库地址无效".into());
    }
    Ok((format!("{owner}/{name}"), owner.to_owned(), name.to_owned()))
}

fn sanitize_component(value: &str, fallback: &str) -> String {
    let mut result: String = value.chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(80)
        .collect();
    if result.is_empty() { result = fallback.to_owned(); }
    result
}

fn default_branch(value: Option<&str>) -> String {
    let value = value.unwrap_or("").trim();
    if value.is_empty() || value.len() > 255 || value.starts_with('/') || value.ends_with('/') || value.contains('\\') || value.contains("..") {
        "main".into()
    } else {
        value.into()
    }
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent(concat!("easy-espanso/", env!("CARGO_PKG_VERSION")))
        .build().map_err(|_| "无法初始化 GitHub 网络客户端".into())
}

fn authenticated(request: RequestBuilder, token: &str) -> RequestBuilder {
    request
        .bearer_auth(token)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", API_VERSION)
}

fn api_error(status: StatusCode) -> String {
    match status {
        StatusCode::UNAUTHORIZED => "GitHub 令牌无效或已过期".into(),
        StatusCode::FORBIDDEN => "GitHub 权限不足或请求受限".into(),
        StatusCode::NOT_FOUND => "GitHub 仓库或备份不存在".into(),
        StatusCode::CONFLICT => "GitHub 仓库状态冲突，请稍后重试".into(),
        StatusCode::UNPROCESSABLE_ENTITY => "GitHub 请求参数无效或资源已存在".into(),
        _ => format!("GitHub 请求失败（HTTP {}）", status.as_u16()),
    }
}

async fn json_response<T: for<'de> Deserialize<'de>>(response: reqwest::Response) -> Result<T, String> {
    let status = response.status();
    if !status.is_success() { return Err(api_error(status)); }
    response.json().await.map_err(|_| "GitHub 返回数据格式无效".into())
}

async fn bytes_response(response: reqwest::Response) -> Result<Vec<u8>, String> {
    let status = response.status();
    if !status.is_success() { return Err(api_error(status)); }
    let bytes = response.bytes().await.map_err(|_| "读取 GitHub 备份失败".to_string())?;
    if bytes.len() > MAX_ARCHIVE_BYTES { return Err("GitHub 备份文件过大".into()); }
    Ok(bytes.to_vec())
}

fn repo_url(slug: &str, suffix: &str) -> String {
    format!("{API_ROOT}/repos/{slug}{suffix}")
}

#[tauri::command]
pub async fn github_backup_validate_repository(config_root: String, repository: String) -> Result<GitHubRepository, String> {
    let token = load_token(&config_root)?;
    let (slug, owner, name) = parse_repository(&repository)?;
    let response = authenticated(client()?.request(Method::GET, repo_url(&slug, "")), &token).send().await
        .map_err(|_| "无法连接 GitHub".to_string())?;
    let value: Value = json_response(response).await?;
    Ok(GitHubRepository {
        repository: format!("https://github.com/{slug}.git"), owner, name,
        default_branch: default_branch(value.get("default_branch").and_then(Value::as_str)),
        private: value.get("private").and_then(Value::as_bool).unwrap_or(false),
    })
}

#[tauri::command]
pub async fn github_backup_create_repository(config_root: String, app_name: Option<String>) -> Result<GitHubRepository, String> {
    let token = load_token(&config_root)?;
    let requested_name = format!("Backup-{}", sanitize_component(app_name.as_deref().unwrap_or("EasyEspanso"), "EasyEspanso"));
    let api = client()?;
    let list = authenticated(api.get(format!("{API_ROOT}/user/repos")).query(&[("type", "owner"), ("per_page", "100")]), &token)
        .send().await.map_err(|_| "无法连接 GitHub".to_string())?;
    let repos: Vec<Value> = json_response(list).await?;
    if let Some(existing) = repos.iter().find(|repo| repo.get("name").and_then(Value::as_str) == Some(requested_name.as_str())) {
        let owner = existing.get("owner").and_then(|x| x.get("login")).and_then(Value::as_str).unwrap_or("");
        let name = existing.get("name").and_then(Value::as_str).unwrap_or(&requested_name);
        if owner.is_empty() { return Err("GitHub 返回的仓库所有者无效".into()); }
        if existing.get("private").and_then(Value::as_bool) != Some(true) {
            return Err("默认备份仓库已存在但不是 Private，请改用私有仓库或重命名现有仓库".into());
        }
        return Ok(GitHubRepository { repository: format!("https://github.com/{owner}/{name}.git"), owner: owner.into(), name: name.into(), default_branch: default_branch(existing.get("default_branch").and_then(Value::as_str)), private: existing.get("private").and_then(Value::as_bool).unwrap_or(false) });
    }
    let response = authenticated(api.post(format!("{API_ROOT}/user/repos")).json(&json!({
        "name": requested_name,
        "private": true,
        "description": "Easy Espanso configuration backups",
    })), &token).send().await.map_err(|_| "无法连接 GitHub".to_string())?;
    let value: Value = json_response(response).await?;
    let owner = value.get("owner").and_then(|x| x.get("login")).and_then(Value::as_str).ok_or("GitHub 返回的仓库所有者无效")?;
    let name = value.get("name").and_then(Value::as_str).ok_or("GitHub 返回的仓库名称无效")?;
    Ok(GitHubRepository { repository: format!("https://github.com/{owner}/{name}.git"), owner: owner.into(), name: name.into(), default_branch: default_branch(value.get("default_branch").and_then(Value::as_str)), private: value.get("private").and_then(Value::as_bool).unwrap_or(true) })
}

fn add_directory<W: Write + Seek>(zip: &mut ZipWriter<W>, source: &Path, archive_name: &str, options: SimpleFileOptions) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source).map_err(|_| "读取配置目录失败".to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("配置目录包含不支持的符号链接".into());
    }
    if metadata.is_dir() {
        let mut entries = fs::read_dir(source).map_err(|_| "读取配置目录失败".to_string())?;
        let mut has_entry = false;
        while let Some(entry) = entries.next() {
            let entry = entry.map_err(|_| "读取配置目录失败".to_string())?;
            if entry.file_type().map_err(|_| "读取配置目录失败".to_string())?.is_symlink() {
                return Err("配置目录包含不支持的符号链接".into());
            }
            has_entry = true;
            let name = format!("{}/{}", archive_name.trim_end_matches('/'), entry.file_name().to_string_lossy());
            add_directory(zip, &entry.path(), &name, options)?;
        }
        if !has_entry { zip.add_directory(format!("{}/", archive_name.trim_end_matches('/')), options).map_err(|_| "创建备份目录失败".to_string())?; }
    } else if metadata.is_file() {
        zip.start_file(archive_name.replace('\\', "/"), options).map_err(|_| "创建备份文件失败".to_string())?;
        let mut file = fs::File::open(source).map_err(|_| "读取配置文件失败".to_string())?;
        std::io::copy(&mut file, zip).map_err(|_| "写入备份文件失败".to_string())?;
    }
    Ok(())
}

fn build_archive(config_root: &Path) -> Result<Vec<u8>, String> {
    if !config_root.is_dir() { return Err("Espanso 配置目录不存在".into()); }
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let manifest = serde_json::to_vec(&BackupManifest { format: "easy-espanso-backup", version: 1, created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }).map_err(|_| "创建备份清单失败".to_string())?;
    zip.start_file("manifest.json", options).map_err(|_| "创建备份清单失败".to_string())?;
    zip.write_all(&manifest).map_err(|_| "写入备份清单失败".to_string())?;
    for name in ["config", "match", "packages"] {
        let source = config_root.join(name);
        if source.exists() { add_directory(&mut zip, &source, name, options)?; }
    }
    let bytes = zip.finish().map_err(|_| "完成备份归档失败".to_string())?.into_inner();
    if bytes.len() > MAX_ARCHIVE_BYTES { return Err("备份文件过大，GitHub Contents API 限制为 100 MB".into()); }
    Ok(bytes)
}

fn backup_path(device: &str, name: &str) -> Result<String, String> {
    let device = sanitize_component(device, "default");
    let name = sanitize_component(name, "backup.zip");
    if !name.to_ascii_lowercase().ends_with(".zip") { return Err("备份文件名无效".into()); }
    Ok(format!("{BACKUP_ROOT}/{device}/{name}"))
}

#[tauri::command]
pub async fn github_backup_upload(config_root: String, repository: String, branch: Option<String>, device: Option<String>) -> Result<GitHubBackupEntry, String> {
    let token = load_token(&config_root)?;
    let (slug, _, _) = parse_repository(&repository)?;
    let branch = default_branch(branch.as_deref());
    let device = sanitize_component(device.as_deref().unwrap_or("default"), "default");
    let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let path = backup_path(&device, &format!("easy-espanso-{timestamp}.zip"))?;
    let content = BASE64.encode(build_archive(Path::new(&config_root))?);
    let message = format!("Backup Easy Espanso ({timestamp})");
    let response = authenticated(client()?.put(repo_url(&slug, &format!("/contents/{path}"))).json(&json!({ "message": message, "content": content, "branch": branch })), &token)
        .send().await.map_err(|_| "无法连接 GitHub".to_string())?;
    let value: Value = json_response(response).await?;
    let item = value.get("content").cloned().unwrap_or(value);
    serde_json::from_value(item).map_err(|_| "GitHub 返回的备份信息无效".into())
}

fn allowed_backup_path(path: &str) -> Result<(String, String), String> {
    let path = path.trim().trim_matches('/');
    if path.contains("..") || path.contains('\\') || path.split('/').any(str::is_empty) || !path.starts_with(&format!("{BACKUP_ROOT}/")) {
        return Err("备份路径无效".into());
    }
    let rest = &path[BACKUP_ROOT.len() + 1..];
    let mut parts = rest.split('/');
    let device = parts.next().unwrap_or("");
    let name = parts.next().unwrap_or("");
    if device.is_empty() || name.is_empty() || parts.next().is_some() || !name.to_ascii_lowercase().ends_with(".zip") { return Err("备份路径无效".into()); }
    Ok((device.to_owned(), name.to_owned()))
}

#[tauri::command]
pub async fn github_backup_list(config_root: String, repository: String, branch: Option<String>, device: Option<String>) -> Result<Vec<GitHubBackupEntry>, String> {
    let token = load_token(&config_root)?;
    let (slug, _, _) = parse_repository(&repository)?;
    let branch = default_branch(branch.as_deref());
    let path = format!("{BACKUP_ROOT}/{}", sanitize_component(device.as_deref().unwrap_or("default"), "default"));
    let response = authenticated(client()?.get(repo_url(&slug, &format!("/contents/{path}"))).query(&[("ref", branch)]), &token)
        .send().await.map_err(|_| "无法连接 GitHub".to_string())?;
    let values: Vec<GitHubContent> = json_response(response).await?;
    Ok(values.into_iter().filter(|item| item.content_type.as_deref() == Some("file") && item.name.to_ascii_lowercase().ends_with(".zip")).map(|item| GitHubBackupEntry { name: item.name, path: item.path, sha: item.sha, size: item.size, download_url: item.download_url, html_url: item.html_url }).collect())
}

#[tauri::command]
pub async fn github_backup_delete(config_root: String, repository: String, branch: Option<String>, path: String, sha: String) -> Result<(), String> {
    let token = load_token(&config_root)?;
    let (slug, _, _) = parse_repository(&repository)?;
    allowed_backup_path(&path)?;
    if sha.trim().is_empty() || sha.len() > 128 || !sha.chars().all(|c| c.is_ascii_hexdigit()) { return Err("备份版本标识无效".into()); }
    let branch = default_branch(branch.as_deref());
    let response = authenticated(client()?.delete(repo_url(&slug, &format!("/contents/{}", path.trim_matches('/')))).json(&json!({ "message": "Delete Easy Espanso backup", "sha": sha, "branch": branch })), &token)
        .send().await.map_err(|_| "无法连接 GitHub".to_string())?;
    if response.status().is_success() { Ok(()) } else { Err(api_error(response.status())) }
}

fn extract_archive(bytes: &[u8], target: &Path) -> Result<(), String> {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|_| "备份归档格式无效".to_string())?;
    let mut has_manifest = false;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|_| "读取备份归档失败".to_string())?;
        let name = file.enclosed_name().ok_or_else(|| "备份归档包含非法路径".to_string())?.to_owned();
        if name == Path::new("manifest.json") { has_manifest = true; }
        let destination = target.join(&name);
        if file.is_dir() { fs::create_dir_all(&destination).map_err(|_| "解压备份失败".to_string())?; continue; }
        if !matches!(name.components().next(), Some(Component::Normal(component)) if ["config", "match", "packages", "manifest.json"].iter().any(|allowed| component == *allowed)) {
            return Err("备份归档包含不支持的路径".into());
        }
        if let Some(parent) = destination.parent() { fs::create_dir_all(parent).map_err(|_| "解压备份失败".to_string())?; }
        let mut output = fs::File::create(destination).map_err(|_| "解压备份失败".to_string())?;
        std::io::copy(&mut file, &mut output).map_err(|_| "解压备份失败".to_string())?;
    }
    if !has_manifest { return Err("备份归档缺少清单".into()); }
    Ok(())
}

#[tauri::command]
pub async fn github_backup_restore(config_root: String, repository: String, branch: Option<String>, path: String, preserve_matches: bool) -> Result<(), String> {
    let token = load_token(&config_root)?;
    let (slug, _, _) = parse_repository(&repository)?;
    allowed_backup_path(&path)?;
    let branch = default_branch(branch.as_deref());
    let response = authenticated(client()?.get(repo_url(&slug, &format!("/contents/{}", path.trim_matches('/')))).query(&[("ref", branch)]), &token)
        .header("Accept", "application/vnd.github.raw+json")
        .send().await.map_err(|_| "无法连接 GitHub".to_string())?;
    let bytes = bytes_response(response).await?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
    let root = PathBuf::from(&config_root);
    let staging = root.join(format!(".easy-espanso-github-restore-{stamp}"));
    fs::create_dir_all(&staging).map_err(|_| "创建恢复暂存目录失败".to_string())?;
    let result = (|| -> Result<(), String> {
        extract_archive(&bytes, &staging)?;
        for name in ["config", "packages"] {
            let source = staging.join(name);
            if source.exists() { crate::replace_dir_with_copy(&source, &root.join(name), &staging, name)?; }
        }
        if !preserve_matches {
            let source = staging.join("match");
            if source.exists() { crate::replace_dir_with_copy(&source, &root.join("match"), &staging, "match")?; }
        } else {
            let source = staging.join("match").join("packages");
            if source.exists() { crate::replace_dir_with_copy(&source, &root.join("match").join("packages"), &staging, "match-packages")?; }
        }
        Ok(())
    })();
    let _ = fs::remove_dir_all(&staging);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_supported_repository_forms() {
        assert_eq!(parse_repository("https://github.com/acme/easy.git").unwrap().0, "acme/easy");
        assert_eq!(parse_repository("git@github.com:acme/easy.git").unwrap().0, "acme/easy");
        assert!(parse_repository("https://github.com.evil/acme/easy").is_err());
        assert!(parse_repository("https://github.com/acme/easy?token=secret").is_err());
    }

    #[test]
    fn backup_path_rejects_traversal() {
        assert!(allowed_backup_path(".easy-espanso/backups/pc/a.zip").is_ok());
        assert!(allowed_backup_path(".easy-espanso/backups/pc/../a.zip").is_err());
        assert!(allowed_backup_path(".easy-espanso/backups/pc/a.exe").is_err());
    }

    #[test]
    fn token_validation_rejects_newlines() {
        assert!(validate_token("ghp_example").is_ok());
        assert!(validate_token("ghp_example\nsecret").is_err());
    }
}
