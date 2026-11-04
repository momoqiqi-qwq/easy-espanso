import { invoke } from '@tauri-apps/api/core';

export type GitHubBackupIntervalMinutes = 15 | 60 | 360 | 1440;

export interface GitHubBackupSettings {
  repository: string;
  branch: string;
  enabled: boolean;
  intervalMinutes: GitHubBackupIntervalMinutes;
}

export interface GitHubRepositoryInfo {
  repository: string;
  branch: string;
  owner: string;
  name: string;
  private: boolean;
}

export interface GitHubBackupEntry {
  path: string;
  name: string;
  sha: string;
  size: number;
  downloadUrl?: string;
  htmlUrl?: string;
}

const STORAGE_KEY = 'easy-espanso-github-backup-settings';
export const GITHUB_BACKUP_SETTINGS_CHANGED_EVENT = 'easy-espanso-github-backup-settings-changed';
const DEFAULT_SETTINGS: GitHubBackupSettings = { repository: '', branch: 'main', enabled: false, intervalMinutes: 60 };
const VALID_INTERVALS: GitHubBackupIntervalMinutes[] = [15, 60, 360, 1440];

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function requireDesktop(): void {
  if (!isTauriRuntime()) throw new Error('GitHub 备份需要在 Easy Espanso 桌面版中使用');
}

function requireConfigRoot(configRoot: string): string {
  const value = configRoot.trim();
  if (!value) throw new Error('请先加载 Espanso 配置目录');
  return value;
}

function sanitizeSettings(input: Partial<GitHubBackupSettings> | null | undefined): GitHubBackupSettings {
  const branch = typeof input?.branch === 'string' ? input.branch.trim() : '';
  const interval = Number(input?.intervalMinutes) as GitHubBackupIntervalMinutes;
  return {
    repository: typeof input?.repository === 'string' ? input.repository.trim() : '',
    branch: branch && /^[A-Za-z0-9._/-]{1,255}$/.test(branch) ? branch : DEFAULT_SETTINGS.branch,
    enabled: input?.enabled === true,
    intervalMinutes: VALID_INTERVALS.includes(interval) ? interval : DEFAULT_SETTINGS.intervalMinutes,
  };
}

export function loadGitHubBackupSettings(): GitHubBackupSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.warn('[GitHubBackup] failed to read settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveGitHubBackupSettings(next: Partial<GitHubBackupSettings>): GitHubBackupSettings {
  const settings = sanitizeSettings({ ...loadGitHubBackupSettings(), ...next });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(GITHUB_BACKUP_SETTINGS_CHANGED_EVENT, { detail: settings }));
  return settings;
}

/** PATs are stored only by native DPAPI commands; never use localStorage/sessionStorage. */
export async function loadGitHubBackupToken(configRoot: string): Promise<boolean> {
  requireDesktop();
  return invoke<boolean>('github_backup_has_token', { configRoot: requireConfigRoot(configRoot) });
}

export async function saveGitHubBackupToken(configRoot: string, token: string): Promise<void> {
  requireDesktop();
  const normalized = token.trim();
  if (!normalized) throw new Error('请输入 GitHub Personal Access Token');
  await invoke('github_backup_save_token', { configRoot: requireConfigRoot(configRoot), token: normalized });
}

export async function clearGitHubBackupToken(configRoot: string): Promise<void> {
  requireDesktop();
  await invoke('github_backup_clear_token', { configRoot: requireConfigRoot(configRoot) });
}

export async function hasGitHubBackupToken(configRoot: string): Promise<boolean> {
  return loadGitHubBackupToken(configRoot);
}

interface NativeRepositoryInfo {
  repository: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
}

function toRepositoryInfo(info: NativeRepositoryInfo): GitHubRepositoryInfo {
  return { repository: info.repository, branch: info.defaultBranch || 'main', owner: info.owner, name: info.name, private: info.private };
}

export async function verifyGitHubRepository(configRoot: string, repository: string): Promise<GitHubRepositoryInfo> {
  requireDesktop();
  return toRepositoryInfo(await invoke<NativeRepositoryInfo>('github_backup_validate_repository', {
    configRoot: requireConfigRoot(configRoot), repository: repository.trim(),
  }));
}

export async function createOrConnectDefaultRepository(configRoot: string, appName = 'EasyEspanso'): Promise<GitHubRepositoryInfo> {
  requireDesktop();
  return toRepositoryInfo(await invoke<NativeRepositoryInfo>('github_backup_create_repository', {
    configRoot: requireConfigRoot(configRoot), appName,
  }));
}

function deviceSegment(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform || 'desktop' : 'desktop';
  return platform.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'desktop';
}

export async function uploadConfigBackup(configRoot: string, settings: GitHubBackupSettings): Promise<GitHubBackupEntry> {
  requireDesktop();
  return invoke<GitHubBackupEntry>('github_backup_upload', {
    configRoot: requireConfigRoot(configRoot), repository: settings.repository,
    branch: settings.branch || 'main', device: deviceSegment(),
  });
}

export async function listConfigBackups(configRoot: string, settings: GitHubBackupSettings): Promise<GitHubBackupEntry[]> {
  requireDesktop();
  try {
    return await invoke<GitHubBackupEntry[]>('github_backup_list', {
      configRoot: requireConfigRoot(configRoot), repository: settings.repository,
      branch: settings.branch || 'main', device: deviceSegment(),
    });
  } catch (error) {
    if (String(error).includes('不存在')) return [];
    throw error;
  }
}

export async function restoreConfigBackup(entry: GitHubBackupEntry, configRoot: string, settings: GitHubBackupSettings, preserveMatches: boolean): Promise<void> {
  requireDesktop();
  await invoke('github_backup_restore', {
    configRoot: requireConfigRoot(configRoot), repository: settings.repository,
    branch: settings.branch || 'main', path: entry.path, preserveMatches,
  });
}

export async function deleteConfigBackup(entry: GitHubBackupEntry, configRoot: string, settings: GitHubBackupSettings): Promise<void> {
  requireDesktop();
  await invoke('github_backup_delete', {
    configRoot: requireConfigRoot(configRoot), repository: settings.repository,
    branch: settings.branch || 'main', path: entry.path, sha: entry.sha,
  });
}

export function clearGitHubBackupSettings(): GitHubBackupSettings {
  return saveGitHubBackupSettings({ ...DEFAULT_SETTINGS });
}
