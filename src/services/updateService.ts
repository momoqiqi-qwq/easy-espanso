import { invoke, isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { version } from '../../package.json';
import { openExternalLink } from './platformService';

export const RELEASES_URL = 'https://github.com/momoqiqi-qwq/easy-espanso/releases';
export interface ReleaseAsset { name: string; size: number; browser_download_url: string }
export interface Release {
  tag_name: string;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
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

export async function openReleaseUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.startsWith('/momoqiqi-qwq/easy-espanso/releases')) {
    throw new Error('Invalid GitHub release URL');
  }
  if (!await openExternalLink(url)) throw new Error('Unable to open download in browser');
}
