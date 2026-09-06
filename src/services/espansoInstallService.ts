import { PlatformAdapterFactory } from './platform/PlatformAdapterFactory';
import type { EspansoControlResult, EspansoRuntimeStatus } from '@/types/core/preload.types';

const CUSTOM_EXECUTABLE_KEY = 'easy-espanso:custom-executable';

const EMPTY_STATUS: EspansoRuntimeStatus = {
  installed: false,
  running: false,
  state: 'not-found',
  executablePath: null,
  source: null,
  version: '',
  message: '',
};

export function getSavedEspansoExecutable(): string {
  try {
    return localStorage.getItem(CUSTOM_EXECUTABLE_KEY) || '';
  } catch (_) {
    return '';
  }
}

export function saveEspansoExecutable(executablePath: string): void {
  try {
    if (executablePath) {
      localStorage.setItem(CUSTOM_EXECUTABLE_KEY, executablePath);
    } else {
      localStorage.removeItem(CUSTOM_EXECUTABLE_KEY);
    }
  } catch (error) {
    console.warn('保存 Espanso 可执行文件路径失败:', error);
  }
}

/**
 * 获取 Espanso 的安装与运行状态。
 * Electron 环境使用主进程的专用 IPC，不再依赖 renderer PATH，也不执行任意 shell 命令。
 */
export async function getEspansoStatus(customExecutablePath = getSavedEspansoExecutable()): Promise<EspansoRuntimeStatus> {
  try {
    const adapter = PlatformAdapterFactory.getInstance();
    if (typeof adapter.getEspansoStatus === 'function') {
      return await adapter.getEspansoStatus(customExecutablePath);
    }

    if (customExecutablePath && await adapter.fileExists(customExecutablePath)) {
      return {
        ...EMPTY_STATUS,
        installed: true,
        state: 'unknown',
        executablePath: customExecutablePath,
        source: 'custom',
        message: 'Executable exists, runtime status is unavailable in this environment.',
      };
    }
    return { ...EMPTY_STATUS };
  } catch (error: any) {
    console.error('检测 Espanso 状态失败:', error);
    return { ...EMPTY_STATUS, state: 'unknown', message: error?.message || String(error) };
  }
}

/** 检测 Espanso 是否已安装。运行状态不再影响“已安装”判断。 */
export async function checkEspansoInstalled(): Promise<boolean> {
  const status = await getEspansoStatus();
  return status.installed;
}

export async function controlEspanso(action: 'start' | 'stop' | 'restart'): Promise<EspansoControlResult> {
  const adapter = PlatformAdapterFactory.getInstance();
  if (typeof adapter.controlEspanso !== 'function') {
    throw new Error('当前环境不支持控制 Espanso 服务');
  }
  return adapter.controlEspanso(action, getSavedEspansoExecutable());
}

/**
 * 获取当前操作系统类型
 */
export function getOSType(): 'windows' | 'macos' | 'linux' | 'unknown' {
  try {
    const navigatorPlatform = (navigator.platform || '').toLowerCase();
    if (navigatorPlatform.includes('win')) return 'windows';
    if (navigatorPlatform.includes('mac')) return 'macos';
    if (navigatorPlatform.includes('linux') || navigatorPlatform.includes('x11')) return 'linux';

    return 'unknown';
  } catch (error) {
    console.error('获取操作系统类型失败:', error);
    return 'unknown';
  }
}

/** 获取 Espanso 官方安装指南。 */
export function getInstallGuideLink(): string {
  const osType = getOSType();
  const baseUrl = 'https://espanso.org/install/';

  switch (osType) {
    case 'windows':
      return `${baseUrl}windows/`;
    case 'macos':
      return `${baseUrl}mac/`;
    case 'linux':
      return `${baseUrl}linux/`;
    default:
      return baseUrl;
  }
}
