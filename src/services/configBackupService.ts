import * as platformService from './platformService';

export type BackupIntervalMinutes = 5 | 15 | 30 | 60 | 1440;

export interface ConfigBackupSettings {
  enabled: boolean;
  intervalMinutes: BackupIntervalMinutes;
  directory: string;
}

export const BACKUP_SETTINGS_CHANGED_EVENT = 'easy-espanso-backup-settings-changed';

const STORAGE_KEY = 'easy-espanso-config-backup-settings';
const DEFAULT_SETTINGS: ConfigBackupSettings = {
  enabled: false,
  intervalMinutes: 30,
  directory: '',
};
const VALID_INTERVALS: BackupIntervalMinutes[] = [5, 15, 30, 60, 1440];

function sanitizeSettings(input: Partial<ConfigBackupSettings> | null | undefined): ConfigBackupSettings {
  const interval = Number(input?.intervalMinutes) as BackupIntervalMinutes;
  return {
    enabled: input?.enabled === true,
    intervalMinutes: VALID_INTERVALS.includes(interval) ? interval : DEFAULT_SETTINGS.intervalMinutes,
    directory: typeof input?.directory === 'string' ? input.directory.trim() : '',
  };
}

export function loadConfigBackupSettings(): ConfigBackupSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.warn('[ConfigBackup] 读取定时备份设置失败:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveConfigBackupSettings(next: Partial<ConfigBackupSettings>): ConfigBackupSettings {
  const settings = sanitizeSettings({ ...loadConfigBackupSettings(), ...next });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(BACKUP_SETTINGS_CHANGED_EVENT, { detail: settings }));
  } catch (error) {
    console.error('[ConfigBackup] 保存定时备份设置失败:', error);
  }
  return settings;
}

/** Create a timestamped full Espanso backup below the user-selected directory. */
export async function createConfigBackup(configRootDir: string, directory: string): Promise<string> {
  if (!configRootDir) throw new Error('当前还没有加载 Espanso 配置目录');
  if (!directory) throw new Error('请先选择配置备份文件夹');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = await platformService.joinPath(directory, `easy-espanso-backup-${stamp}`);
  return platformService.exportEspansoBackup(configRootDir, target);
}

export function getConfigBackupSettings(): ConfigBackupSettings {
  return loadConfigBackupSettings();
}
