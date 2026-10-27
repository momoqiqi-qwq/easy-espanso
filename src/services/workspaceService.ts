import * as platformService from './platformService';

const RECENT_KEY = 'easy-espanso-recent-workspaces';

export interface RecentWorkspace { path: string; lastOpenedAt: string }

export function getRecentWorkspaces(): RecentWorkspace[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

export function clearRecentWorkspaces(): void {
  try { localStorage.removeItem(RECENT_KEY); } catch (error) { console.error('清空最近工作区失败:', error); }
}

function isBackupBeforeSaveEnabled(): boolean {
  try {
    const raw = localStorage.getItem('userPreferences');
    if (!raw) return true;
    const prefs = JSON.parse(raw);
    return prefs.backupBeforeSave !== false;
  } catch {
    return true;
  }
}

export function rememberWorkspace(path: string, limit = 8): void {
  const normalized = path.replace(/\\/g, '/');
  const next = [{ path: normalized, lastOpenedAt: new Date().toISOString() }, ...getRecentWorkspaces().filter(x => x.path !== normalized)].slice(0, limit);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export async function validateYamlText(text: string): Promise<void> {
  const { parseYaml } = await import('./yamlService');
  await parseYaml(text);
}

/**
 * 写入前备份原文件。knownContent 为调用方已读到的原文（null 表示文件不存在），
 * 传入时直接复用，省去一次存在性检查和一次读文件。
 */
export async function backupFile(filePath: string, knownContent?: string | null): Promise<string | null> {
  if (!isBackupBeforeSaveEnabled()) return null;
  const original = knownContent !== undefined
    ? knownContent
    : (await platformService.fileExists(filePath) ? await platformService.readFile(filePath) : null);
  if (original === null) return null;
  const backupPath = `${filePath}.easy-espanso.bak`;
  await platformService.writeFile(backupPath, original);
  return backupPath;
}

export async function restoreBackup(filePath: string): Promise<boolean> {
  const backupPath = `${filePath}.easy-espanso.bak`;
  if (!(await platformService.fileExists(backupPath))) return false;
  await platformService.writeFile(filePath, await platformService.readFile(backupPath));
  return true;
}
