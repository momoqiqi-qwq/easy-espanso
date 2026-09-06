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

export async function backupFile(filePath: string): Promise<string | null> {
  if (!isBackupBeforeSaveEnabled()) return null;
  if (!(await platformService.fileExists(filePath))) return null;
  const original = await platformService.readFile(filePath);
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
