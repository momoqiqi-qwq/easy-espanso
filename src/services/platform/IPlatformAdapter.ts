// src/services/platform/IPlatformAdapter.ts

import type {
  FileInfo,
  FileSystemNode,
  YamlData,
  OpenDialogOptions,
  OpenDialogResult,
  SaveDialogOptions,
  SaveDialogResult,
  MessageBoxOptions,
  MessageBoxResult,
  EspansoRuntimeStatus,
  EspansoControlResult
} from '@/types/core/preload.types'; // 确保从核心类型导入

/**
* 平台适配器接口 - 定义所有平台必须实现的方法
* 用于抽象 Electron preload API 或 Web fallback 的具体实现。
*/
export interface IPlatformAdapter {
  // --- 文件系统操作 ---
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  fileExists(filePath: string): Promise<boolean>;
  directoryExists(dirPath: string): Promise<boolean>;       // 确认需要
  createDirectory(dirPath: string): Promise<void>;        // 确认需要
  listFiles(dirPath: string): Promise<FileInfo[]>;
  scanDirectory(dirPath: string): Promise<FileSystemNode[]>; // 确认需要
  deleteFile(filePath: string): Promise<void>;              // 确认需要
  deleteDirectory(dirPath: string): Promise<void>;           // 确认需要
  renameFileOrDirectory(oldPath: string, newPath: string): Promise<void>; // 确认需要

  // --- 路径操作 ---
  joinPath(...paths: string[]): Promise<string>; // 确认需要 (设为 Promise 以兼容 Electron IPC)

  // --- 对话框 ---
  showOpenDialog(options: OpenDialogOptions): Promise<OpenDialogResult>;
  showSaveDialog(options: SaveDialogOptions): Promise<SaveDialogResult>;
  showMessageBox(options: MessageBoxOptions): Promise<MessageBoxResult>;

  // --- 系统操作 ---
  getPlatform(): Promise<string>; // 返回 'win32', 'darwin', 'linux', 'web', 'unknown' 等
  showNotification(title: string, body: string): Promise<void>;
  getEnvironmentVariable(name: string): Promise<string | null>; // 获取环境变量
  openExternal(url: string): Promise<boolean>; // 在默认浏览器中打开外部链接
  openInExplorer(filePath: string): Promise<boolean>; // 在文件管理器中打开文件或文件夹
  exportEspansoBackup(sourceRoot: string, targetRoot: string): Promise<string>;
  importEspansoBackup(backupRoot: string, targetRoot: string, preserveMatches: boolean): Promise<void>;

  // --- YAML 操作 ---
  parseYaml(content: string): Promise<YamlData>;
  serializeYaml(data: YamlData): Promise<string>;

  // --- IPC (可选，如果需要) ---
  onIpcHandlersReady(callback: () => void): void; // 用于监听平台后端是否准备就绪

  // --- Espanso ---
  getEspansoStatus?(customExecutablePath?: string): Promise<EspansoRuntimeStatus>;
  controlEspanso?(action: 'start' | 'stop' | 'restart', customExecutablePath?: string): Promise<EspansoControlResult>;
}