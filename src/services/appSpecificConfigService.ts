import * as platformService from './platformService';
import * as yamlService from './yamlService';
import type { Match } from '@/types/core/espanso.types';
import type { EspansoMatchYaml } from '@/types/core/espanso-format.types';
import { cleanMatchForSaving, processMatch } from '@/utils/espansoDataUtils';

export type AppFilterType = 'filter_exec' | 'filter_class' | 'filter_title';
export interface AppSpecificConfig {
  fileName: string;
  filterType: AppFilterType;
  filterValue: string;
  enable?: boolean;
  backend?: 'auto' | 'inject' | 'clipboard';
  paste_shortcut?: string;
  inject_delay?: number;
  key_delay?: number;
  apply_patch?: boolean;
  /** Match files that should only be active while this application profile matches. */
  matchFiles?: string[];
}

const APP_ONLY_MATCH_DIR = '__easy_espanso_app_only';
const APP_ONLY_MATCH_PREFIX = `../match/${APP_ONLY_MATCH_DIR}/`;

function safeProfileKey(fileName: string): string {
  const withoutPriority = fileName.trim().replace(/^\d{3}[-_]/, '');
  return withoutPriority.replace(/[^a-zA-Z0-9_-]/g, '_') || 'app';
}

function normalizeIncludePath(value: string): string {
  return value.replace(/\\/g, '/');
}

export function isManagedAppOnlyMatchReference(value: string): boolean {
  return normalizeIncludePath(value).startsWith(APP_ONLY_MATCH_PREFIX);
}

/**
 * Return the dedicated match file used by the in-dialog app-only snippet editor.
 * Existing references are kept stable so profile reordering/filename prefixes do not
 * silently move the snippet file.
 */
export function getAppOnlyMatchReference(item: Pick<AppSpecificConfig, 'fileName' | 'matchFiles'>): string {
  const existing = item.matchFiles?.find(isManagedAppOnlyMatchReference);
  if (existing) return normalizeIncludePath(existing);
  return `${APP_ONLY_MATCH_PREFIX}${safeProfileKey(item.fileName)}.yml`;
}

export function withAppOnlyMatchReference<T extends AppSpecificConfig>(item: T): T {
  const reference = getAppOnlyMatchReference(item);
  const existing = (item.matchFiles || []).map(normalizeIncludePath);
  if (existing.includes(reference)) return { ...item, matchFiles: existing };
  return { ...item, matchFiles: [...existing, reference] };
}

async function resolveManagedMatchPath(
  configRoot: string,
  item: Pick<AppSpecificConfig, 'fileName' | 'matchFiles'>,
): Promise<{ reference: string; path: string }> {
  const reference = getAppOnlyMatchReference(item);
  const fileName = reference.slice(APP_ONLY_MATCH_PREFIX.length);
  const directory = await platformService.joinPath(configRoot, 'match', APP_ONLY_MATCH_DIR);
  const path = await platformService.joinPath(directory, fileName);
  return { reference, path };
}

export async function loadAppOnlySnippets(
  configRoot: string,
  item: Pick<AppSpecificConfig, 'fileName' | 'matchFiles'>,
): Promise<Match[]> {
  const { path } = await resolveManagedMatchPath(configRoot, item);
  if (!(await platformService.fileExists(path))) return [];

  const raw = await yamlService.parseYaml(await platformService.readFile(path)) as { matches?: EspansoMatchYaml[] };
  const counter = { count: 0 };
  return (Array.isArray(raw.matches) ? raw.matches : []).map((match) => processMatch(match, path, counter));
}

export async function saveAppOnlySnippets(
  configRoot: string,
  item: Pick<AppSpecificConfig, 'fileName' | 'matchFiles'>,
  snippets: Match[],
): Promise<string> {
  const { reference, path } = await resolveManagedMatchPath(configRoot, item);
  const directory = await platformService.joinPath(configRoot, 'match', APP_ONLY_MATCH_DIR);
  if (!(await platformService.directoryExists(directory))) await platformService.createDirectory(directory);

  let existing: Record<string, unknown> = {};
  if (await platformService.fileExists(path)) {
    try {
      existing = await yamlService.parseYaml(await platformService.readFile(path)) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  existing.matches = snippets.map((snippet) => {
    const prepared: Match = { ...snippet };
    const contentType = prepared.contentType || 'plain';
    const content = typeof prepared.content === 'string' ? prepared.content : undefined;
    if (contentType === 'plain' && content !== undefined) prepared.replace = content;
    if (contentType === 'markdown' && content !== undefined) prepared.markdown = content;
    if (contentType === 'html' && content !== undefined) prepared.html = content;
    if (contentType === 'image' && content !== undefined) prepared.image_path = content;
    if (contentType === 'form' && content !== undefined) prepared.form = content;
    return cleanMatchForSaving(prepared);
  });

  const text = await yamlService.serializeYaml(existing);
  await yamlService.parseYaml(text);
  await platformService.writeFile(path, text);
  return reference;
}

export async function deleteAppOnlySnippetFile(
  configRoot: string,
  item: Pick<AppSpecificConfig, 'fileName' | 'matchFiles'>,
): Promise<void> {
  const existing = item.matchFiles?.find(isManagedAppOnlyMatchReference);
  if (!existing) return;
  const { path } = await resolveManagedMatchPath(configRoot, item);
  if (await platformService.fileExists(path)) await platformService.deleteFile(path);
}

export async function saveAppSpecificConfig(configRoot: string, item: AppSpecificConfig): Promise<string> {
  const configDir = await platformService.joinPath(configRoot, 'config');
  await platformService.createDirectory(configDir);
  const safe = item.fileName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'app';
  const path = await platformService.joinPath(configDir, `${safe}.yml`);
  const data: Record<string, unknown> = { [item.filterType]: item.filterValue };
  if (item.matchFiles?.length) data.extra_includes = item.matchFiles;
  for (const key of ['enable','backend','paste_shortcut','inject_delay','key_delay','apply_patch'] as const) {
    if (item[key] !== undefined && item[key] !== '') data[key] = item[key];
  }
  const text = await yamlService.serializeYaml(data);
  await yamlService.parseYaml(text);
  await platformService.writeFile(path, text);
  return path;
}


/**
 * Keep app-only match files out of the global/default profile. Espanso app configs
 * can then opt them back in through extra_includes. Only paths used by at least one
 * Easy Espanso app profile are managed here.
 */
export async function syncAppOnlyMatchExcludes(configRoot: string): Promise<void> {
  const configDir = await platformService.joinPath(configRoot, 'config');
  if (!(await platformService.directoryExists(configDir))) return;

  const files = (await platformService.listFiles(configDir))
    .filter(file => /\.ya?ml(?:\.disabled)?$/i.test(file.name) && file.name !== 'default.yml');
  const managed = new Set<string>();
  for (const file of files) {
    try {
      const raw = await yamlService.parseYaml(await platformService.readFile(file.path)) as Record<string, unknown>;
      const includes = Array.isArray(raw.extra_includes) ? raw.extra_includes : [];
      for (const value of includes) if (typeof value === 'string' && value.startsWith('../match/')) managed.add(value);
    } catch { /* invalid profiles are ignored by the manager too */ }
  }

  const defaultPath = await platformService.joinPath(configDir, 'default.yml');
  const managedStatePath = await platformService.joinPath(configRoot, '.easy-espanso-app-match-excludes.json');
  let previousManaged: string[] = [];
  if (await platformService.fileExists(managedStatePath)) {
    try {
      const parsed = JSON.parse(await platformService.readFile(managedStatePath));
      if (Array.isArray(parsed)) previousManaged = parsed.filter((v): v is string => typeof v === 'string');
    } catch { previousManaged = []; }
  }

  let raw: Record<string, unknown> = {};
  if (await platformService.fileExists(defaultPath)) {
    try { raw = await yamlService.parseYaml(await platformService.readFile(defaultPath)) as Record<string, unknown>; } catch { raw = {}; }
  }
  const existing = Array.isArray(raw.extra_excludes) ? raw.extra_excludes.filter((v): v is string => typeof v === 'string') : [];
  const previousSet = new Set(previousManaged);
  const keepUserValues = existing.filter(value => !previousSet.has(value));
  const nextManaged = [...managed].sort();
  const next = [...new Set([...keepUserValues, ...nextManaged])];
  if (next.length) raw.extra_excludes = next; else delete raw.extra_excludes;
  await platformService.writeFile(defaultPath, await yamlService.serializeYaml(raw));
  await platformService.writeFile(managedStatePath, JSON.stringify(nextManaged, null, 2));
}
