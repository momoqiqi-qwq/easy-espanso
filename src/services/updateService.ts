import { invoke, isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { version } from '../../package.json';
import { openExternalLink } from './platformService';

export const RELEASES_URL = 'https://github.com/momoqiqi-qwq/easy-espanso/releases';
export interface ReleaseAsset { name: string; size: number; browser_download_url: string }
export interface Release { tag_name: string; html_url: string; body: string | null; draft: boolean; prerelease: boolean; assets: ReleaseAsset[] }

/** 原生下载进度事件名，必须与 src-tauri/src/lib.rs 的 UPDATE_PROGRESS_EVENT 一致。 */
export const UPDATE_PROGRESS_EVENT = 'update-download-progress';

export interface UpdateDownloadProgress {
  /** 已下载字节数 */
  downloaded: number;
  /** 总字节数；0 表示服务端没给 content-length */
  total: number;
  /** 0–100，总长度未知时为 0 */
  percent: number;
}

/** 字节数 → 人类可读（1024 进制，≥100 取整、其余保留 1 位小数）。 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const shown = index === 0 || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${shown} ${units[index]}`;
}

/** 剩余秒数 → "12s" / "1m 20s" / "1h 5m"；未知（≤0 / 非有限）返回空串。 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.ceil(seconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    const rest = total % 60;
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** 下载百分比：总长未知或 ≤0 返回 0，结果取整并夹在 0–100。 */
export function downloadPercent(downloaded: number, total: number): number {
  if (!Number.isFinite(downloaded) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((downloaded / total) * 100)));
}

function parseVersion(value: string) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z.-]+))?(?:\+[\da-zA-Z.-]+)?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid release version: ${value}`);
  return { numbers: match.slice(1, 4).map(Number), prerelease: match[4]?.split('.') };
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest), b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a.numbers[i] !== b.numbers[i]) return a.numbers[i] > b.numbers[i];
  }
  if (!a.prerelease || !b.prerelease) return !a.prerelease && !!b.prerelease;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const x = a.prerelease[i], y = b.prerelease[i];
    if (x === y) continue;
    if (x === undefined) return false;
    if (y === undefined) return true;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) > Number(y);
    if (xn !== yn) return !xn;
    return x > y;
  }
  return false;
}

export async function currentVersion(): Promise<string> {
  return isTauri() ? getVersion() : version;
}

export async function latestRelease(): Promise<Release | null> {
  let release: Release | null;
  if (isTauri()) {
    release = await invoke<Release | null>('get_latest_release');
  } else {
    const response = await fetch('https://api.github.com/repos/momoqiqi-qwq/easy-espanso/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    release = await response.json();
  }
  if (!release || release.draft || release.prerelease) return null;
  if (!Array.isArray(release.assets)) throw new Error('Invalid release assets');
  return release;
}

export function downloadableAssets(release: Release): ReleaseAsset[] {
  return release.assets.filter(asset => /\.(exe|msi|dmg|appimage|deb|rpm|zip|tar\.gz)$/i.test(asset.name));
}

/** Windows 优先取 NSIS 安装包（*setup.exe），其次任意 exe，最后 msi。 */
export function pickInstallerAsset(release: Release): ReleaseAsset | null {
  const exe = release.assets.filter(asset => /\.exe$/i.test(asset.name));
  return exe.find(asset => /setup/i.test(asset.name)) ?? exe[0]
    ?? release.assets.find(asset => /\.msi$/i.test(asset.name)) ?? null;
}

export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

/** 「不再提醒」按版本记录：只忽略被点掉的那个版本，出现更高版本仍会提醒。 */
export function isVersionSkipped(latest: string, skipped: string | undefined | null): boolean {
  if (!skipped || !latest) return false;
  return normalizeVersion(latest) === normalizeVersion(skipped);
}

/** 走 Rust 原生下载到临时目录，返回本地路径；Web 预览下退回浏览器下载。
 *  `onProgress` 订阅原生下载事件（约 120ms 一次），用于渲染进度条。 */
export async function downloadUpdateAsset(
  asset: ReleaseAsset,
  onProgress?: (progress: UpdateDownloadProgress) => void,
): Promise<string> {
  if (!isTauri()) {
    await openReleaseUrl(asset.browser_download_url);
    return '';
  }
  let unlisten: UnlistenFn | undefined;
  if (onProgress) {
    try {
      unlisten = await listen<UpdateDownloadProgress>(UPDATE_PROGRESS_EVENT, event => onProgress(event.payload));
    } catch {
      unlisten = undefined; // 订阅失败不影响下载本身
    }
  }
  try {
    return await invoke<string>('download_update_asset', { url: asset.browser_download_url, fileName: asset.name });
  } finally {
    unlisten?.();
  }
}

/** 启动安装程序并退出应用；Web 预览下退回打开下载页。 */
export async function installUpdate(path: string): Promise<void> {
  if (!isTauri() || !path) return;
  await invoke('install_update_and_restart', { path });
}

export async function openReleaseUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.startsWith('/momoqiqi-qwq/easy-espanso/releases')) {
    throw new Error('Invalid GitHub release URL');
  }
  if (!await openExternalLink(url)) throw new Error('Unable to open download in browser');
}
