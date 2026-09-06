import { invoke } from '@tauri-apps/api/core';
import { open, save, confirm, message } from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import * as yaml from 'js-yaml';
import type { IPlatformAdapter } from './IPlatformAdapter';
import type {
  EspansoControlResult,
  EspansoRuntimeStatus,
  FileInfo,
  FileSystemNode,
  MessageBoxOptions,
  MessageBoxResult,
  OpenDialogOptions,
  OpenDialogResult,
  SaveDialogOptions,
  SaveDialogResult,
  YamlData,
} from '@/types/core/preload.types';

export class TauriAdapter implements IPlatformAdapter {
  async readFile(filePath: string): Promise<string> {
    return invoke<string>('read_file', { filePath });
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await invoke('write_file', { filePath, content });
  }

  async fileExists(filePath: string): Promise<boolean> {
    return invoke<boolean>('file_exists', { filePath });
  }

  async directoryExists(dirPath: string): Promise<boolean> {
    return invoke<boolean>('directory_exists', { dirPath });
  }

  async createDirectory(dirPath: string): Promise<void> {
    await invoke('create_directory', { dirPath });
  }

  async listFiles(dirPath: string): Promise<FileInfo[]> {
    return invoke<FileInfo[]>('list_files', { dirPath });
  }

  async scanDirectory(dirPath: string): Promise<FileSystemNode[]> {
    return invoke<FileSystemNode[]>('scan_directory', { dirPath });
  }

  async deleteFile(filePath: string): Promise<void> {
    await invoke('delete_file', { filePath });
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    await invoke('delete_directory', { dirPath });
  }

  async renameFileOrDirectory(oldPath: string, newPath: string): Promise<void> {
    await invoke('rename_file_or_directory', { oldPath, newPath });
  }

  async joinPath(...paths: string[]): Promise<string> {
    return invoke<string>('join_path', { paths });
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult> {
    const directory = options.properties?.includes('openDirectory') ?? false;
    const multiple = options.properties?.includes('multiSelections') ?? false;
    const selected = await open({
      title: options.title,
      defaultPath: options.defaultPath,
      directory,
      multiple,
      filters: options.filters?.map((filter) => ({ name: filter.name, extensions: filter.extensions })),
    });
    if (selected == null) return { canceled: true, filePaths: [] };
    return { canceled: false, filePaths: Array.isArray(selected) ? selected : [selected] };
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult> {
    const selected = await save({
      title: options.title,
      defaultPath: options.defaultPath,
      filters: options.filters?.map((filter) => ({ name: filter.name, extensions: filter.extensions })),
    });
    return selected == null ? { canceled: true } : { canceled: false, filePath: selected };
  }

  async showMessageBox(options: MessageBoxOptions): Promise<MessageBoxResult> {
    const kind = options.type === 'error' || options.type === 'warning' || options.type === 'info'
      ? options.type
      : 'info';
    const detail = options.detail ? `${options.message}\n\n${options.detail}` : options.message;
    const buttons = options.buttons ?? ['OK'];
    if (buttons.length >= 2) {
      const accepted = await confirm(detail, {
        title: options.title,
        kind,
        okLabel: buttons[0],
        cancelLabel: buttons[1],
      });
      return { response: accepted ? 0 : 1, checkboxChecked: false };
    }
    await message(detail, { title: options.title, kind });
    return { response: 0, checkboxChecked: false };
  }

  async getPlatform(): Promise<string> {
    return invoke<string>('get_platform');
  }

  async showNotification(title: string, body: string): Promise<void> {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    if (granted) sendNotification({ title, body });
  }

  async getEnvironmentVariable(name: string): Promise<string | null> {
    return invoke<string | null>('get_environment_variable', { name });
  }

  async openExternal(url: string): Promise<boolean> {
    try {
      await openUrl(url);
      return true;
    } catch (error) {
      console.error('[TauriAdapter] openExternal failed:', error);
      return false;
    }
  }

  async openInExplorer(filePath: string): Promise<boolean> {
    return invoke<boolean>('open_in_explorer', { request: { path: filePath } });
  }

  async exportEspansoBackup(sourceRoot: string, targetRoot: string): Promise<string> {
    return invoke<string>('export_espanso_backup', { request: { sourceRoot, targetRoot } });
  }

  async importEspansoBackup(backupRoot: string, targetRoot: string, preserveMatches: boolean): Promise<void> {
    await invoke('import_espanso_backup', { request: { backupRoot, targetRoot, preserveMatches } });
  }

  async parseYaml(content: string): Promise<YamlData> {
    // Keep YAML parsing in JS to preserve js-yaml behavior used by the renderer.
    return (yaml.load(content) ?? {}) as YamlData;
  }

  async serializeYaml(data: YamlData): Promise<string> {
    return yaml.dump(data, { noRefs: true, lineWidth: -1 });
  }

  onIpcHandlersReady(callback: () => void): void {
    queueMicrotask(callback);
  }

  async getEspansoStatus(customExecutablePath = ''): Promise<EspansoRuntimeStatus> {
    return invoke<EspansoRuntimeStatus>('get_espanso_status', { customExecutablePath });
  }

  async controlEspanso(action: 'start' | 'stop' | 'restart', customExecutablePath = ''): Promise<EspansoControlResult> {
    return invoke<EspansoControlResult>('control_espanso', { action, customExecutablePath });
  }
}
