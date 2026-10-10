import * as platformService from './platformService'; // 用于文件系统操作
import * as yamlService from './yamlService';         // 用于 YAML 解析/序列化
import * as workspaceService from './workspaceService';     // 用于获取配置路径等

// 核心类型 (假设已移至 types/core/)
import type { Match } from '@/types/core/espanso.types';
import type { GlobalConfig, EspansoMatchYaml } from '@/types/core/espanso-format.types';
import type { ConfigTreeNode } from '@/types/core/ui.types';
import type { YamlData, FileSystemNode } from '@/types/core/preload.types';

// 工具函数 (假设已重构)
import { processMatch, cleanMatchForSaving, resetGuiOrderCounter } from '@/utils/espansoDataUtils';
import { createFileNode, createFolderNode } from '@/utils/configTreeUtils';


/**
 * 加载指定目录的 Espanso 配置。
 * 扫描 match 和 config 子目录, 解析 YAML 文件, 并构建 ConfigTreeNode 树结构。
 * @param configDir Espanso 配置的根目录路径。
 * @returns 返回一个包含 configTree, globalConfig 和 globalConfigPath 的对象。
 * @throws 如果无法读取或解析配置，则抛出错误。
 */
export const loadConfiguration = async (configDir: string): Promise<{
    configTree: ConfigTreeNode[];
    globalConfig: GlobalConfig | null;
    globalConfigPath: string | null;
}> => {
    console.log(`[EspansoService] 开始加载配置: ${configDir}`);
    resetGuiOrderCounter(); // 重置用于排序的内部计数器

    let globalConfig: GlobalConfig | null = null;
    let globalConfigPath: string | null = null;
    const configTree: ConfigTreeNode[] = [];

    const joinPath = platformService.joinPath; // 使用平台服务提供的路径连接

    // --- 1. 加载全局配置 (config/default.yml) ---
    try {
        // 确保使用正确的路径
        const configSubDir = await joinPath(configDir, 'config');
        const defaultGlobalPath = await joinPath(configSubDir, 'default.yml');

        // 打印路径用于调试
        console.log(`[EspansoService] 尝试读取全局配置文件: ${defaultGlobalPath}`);

        if (await platformService.fileExists(defaultGlobalPath)) {
            console.log(`[EspansoService] 发现全局配置文件: ${defaultGlobalPath}`);
            const content = await platformService.readFile(defaultGlobalPath);
            const yaml = await yamlService.parseYaml(content);
            globalConfig = yaml as GlobalConfig; // 类型断言
            globalConfigPath = defaultGlobalPath;
            console.log(`[EspansoService] 全局配置加载成功。`);
            // (全局配置本身不直接放入 configTree, 但其信息已获取)
        } else {
            console.log(`[EspansoService] 未找到全局配置文件 (config/default.yml)。路径: ${defaultGlobalPath}`);
        }
    } catch (err: any) {
        console.warn(`[EspansoService] 加载全局配置时出错: ${err.message}。将继续加载匹配文件。`);
        // 不阻塞加载过程，但记录警告
    }

    // --- 2. 加载匹配文件 (match/**/*.yml) ---
    const matchDir = await joinPath(configDir, 'match');
    let matchFilesFound = false;

    try {
         // 检查 match 目录是否存在
         const matchDirExists = await platformService.directoryExists(matchDir);
         console.log(`[EspansoService] 'match' 目录是否存在: ${matchDirExists}`);

         if (!matchDirExists) {
             console.log(`[EspansoService] 'match' 目录不存在，尝试创建: ${matchDir}`);
             await platformService.createDirectory(matchDir);
             console.log(`[EspansoService] 'match' 目录创建成功`);
         }

        // Keep the Packages root available in the tree even before the first
        // package is created, so users can right-click it and create one.
        const packagesDir = await joinPath(matchDir, 'packages');
        if (!(await platformService.directoryExists(packagesDir))) {
            await platformService.createDirectory(packagesDir);
        }

        let scannedStructure = await platformService.scanDirectory(matchDir); // 假设返回 FileSystemNode[]
        console.log(`[EspansoService] 扫描 'match' 目录结构完成。发现 ${scannedStructure?.length || 0} 个顶级项目`);

        // 确保 scannedStructure 是一个数组
        if (!scannedStructure || !Array.isArray(scannedStructure)) {
            console.warn(`[EspansoService] scanDirectory 返回的不是数组，而是: ${typeof scannedStructure}`);
            // 使用空数组继续处理
            scannedStructure = [] as FileSystemNode[];
        }

        // 并行构建目录树。Promise.all 保持输入顺序，同时避免逐文件串行 IPC/读取。
        const processNode = async (fsNode: FileSystemNode, basePathParts: string[]): Promise<ConfigTreeNode | null> => {
            const isConfigFile = (name: string) => /\.(yml|yaml)$/i.test(name) && !name.startsWith('_');
            const currentPath = await joinPath(...basePathParts, fsNode.name);

            if (fsNode.type === 'file') {
                if (!isConfigFile(fsNode.name)) return null;
                matchFilesFound = true;
                try {
                    const content = await platformService.readFile(currentPath);
                    const yaml = await yamlService.parseYaml(content) as YamlData;
                    const counter = { count: 0 };
                    const fileMatches = (yaml.matches as EspansoMatchYaml[] || [])
                        .map(match => processMatch(match, currentPath, counter));
                    return createFileNode(fsNode.name, currentPath, 'match', yaml, fileMatches);
                } catch (fileError: any) {
                    console.error(`[EspansoService] 处理文件 ${currentPath} 失败: ${fileError.message}`);
                    return null;
                }
            }

            if (fsNode.type === 'directory') {
                // Easy Espanso keeps app-profile-only snippets in a dedicated match
                // directory. They are edited from the application profile dialog and
                // intentionally hidden from the normal/global snippet tree.
                if (fsNode.name.startsWith('.') || fsNode.name === '__easy_espanso_app_only') return null;
                const folderNode = createFolderNode(fsNode.name, currentPath);
                if (fsNode.children?.length) {
                    const nextPathParts = [...basePathParts, fsNode.name];
                    const childNodes = await Promise.all(
                        fsNode.children.map(child => processNode(child, nextPathParts))
                    );
                    folderNode.children.push(
                        ...childNodes.filter((child): child is ConfigTreeNode => child !== null)
                    );
                }
                return folderNode;
            }

            return null;
        };

        const processedNodes = await Promise.all(
            scannedStructure.map(node => processNode(node, [matchDir]))
        );
        configTree.push(...processedNodes.filter((node): node is ConfigTreeNode => node !== null));
        console.log(`[EspansoService] 'match' 目录处理完成。构建的树层级数: ${configTree.length}`);

    } catch (err: any) {
        console.error(`[EspansoService] 加载和处理 'match' 目录时发生严重错误: ${err.message}`);
        throw new Error(`Failed to load match configuration: ${err.message}`); // 抛出错误，由 store 处理
    }

    // --- 3. 如果没有找到任何匹配文件，创建默认文件 ---
    if (!matchFilesFound) {
        console.log(`[EspansoService] 未找到任何匹配文件，将创建默认 'match/base.yml'。`);
        
        // 首先检查是否已经存在默认的base.yml文件
        const defaultBasePath = await joinPath(matchDir, 'base.yml');
        const baseFileExists = await platformService.fileExists(defaultBasePath);
        
        if (baseFileExists) {
            console.log(`[EspansoService] 发现已存在的base.yml文件，正在加载...`);
            try {
                const content = await platformService.readFile(defaultBasePath);
                const yaml = await yamlService.parseYaml(content) as YamlData;
                
                // 创建一个 GUI 排序计数器
                const counter = { count: 0 };
                
                // 处理匹配项
                const fileMatches = (yaml.matches as EspansoMatchYaml[] || [])
                    .map(match => processMatch(match, defaultBasePath, counter));
                
                // 创建文件节点并添加到树中
                const baseFileNode = createFileNode(
                    'base.yml',
                    defaultBasePath,
                    'match',
                    yaml,
                    fileMatches,
                );
                configTree.push(baseFileNode);
                console.log(`[EspansoService] 成功加载已存在的base.yml文件`);
            } catch (err: any) {
                console.error(`[EspansoService] 加载已存在的base.yml文件失败: ${err.message}`);
                // 出错时尝试创建新文件
                await createDefaultBaseFile();
            }
        } else {
            // 不存在base.yml，创建新的默认文件
            await createDefaultBaseFile();
        }
        
        // 创建默认base.yml文件的辅助函数
        async function createDefaultBaseFile() {
            try {
                // 创建一个 GUI 排序计数器
                const counter = { count: 0 };
                const defaultMatch = processMatch({
                    trigger: ':hello',
                    replace: 'Hello from Easy Espanso! 👋',
                    label: '示例片段'
                }, defaultBasePath, counter);

                const defaultYamlData: YamlData = {
                    matches: [cleanMatchForSaving(defaultMatch)] // 保存清理后的版本
                };

                // 创建文件节点并添加到树中
                const defaultFileNode = createFileNode(
                    'base.yml',
                    defaultBasePath,
                    'match',
                    defaultYamlData, // 存储这个默认内容
                    [defaultMatch], // 内部状态包含处理后的 Match
                );
                configTree.push(defaultFileNode);

                // 写入文件系统
                await saveConfigurationFile(defaultBasePath, [defaultMatch], defaultYamlData); // 使用保存函数写入
                console.log(`[EspansoService] 默认 'match/base.yml' 创建成功。`);
            } catch (err: any) {
                console.error(`[EspansoService] 创建默认 'match/base.yml' 失败: ${err.message}`);
                // 不阻塞，但记录错误
            }
        }
    }

    // --- 4. 返回结果 ---
    console.log(`[EspansoService] 配置加载流程结束。找到 ${configTree.length} 个配置节点。`);
    return { configTree, globalConfig, globalConfigPath };
};


/**
 * 将指定文件路径的内容保存到文件系统。
 * 它会清理传入的 Match 对象 (移除内部字段)，与现有 YAML 数据合并 (保留非 matches 键)，
 * 然后序列化并写入文件。
 * @param filePath 要保存的文件的完整路径。
 * @param itemsToSave 该文件中包含的 Match 对象数组 (直接来自 configTree 的引用)。
 * @param existingYamlData 可选的，该文件原始解析的 YAML 数据，用于保留未被管理的顶层键。
 * @throws 如果序列化或写入文件失败，则抛出错误。
 */
export interface ConfigurationWrite {
    filePath: string;
    itemsToSave: Match[];
    existingYamlData?: YamlData;
}

let saveQueue: Promise<void> = Promise.resolve();

/** Prepare every file before writing, and restore completed writes if a later write fails. */
export function saveConfigurationFiles(files: ConfigurationWrite[]): Promise<void> {
    // Capture the caller's data now, before another edit can mutate reactive state.
    const prepared = files.map(file => {
        const data: YamlData = Object.fromEntries(Object.entries(file.existingYamlData || {}).filter(([key]) => key !== 'matches'));
        data.matches = file.itemsToSave.map(item => {
            if (item.filePath !== file.filePath) throw new Error(`Match ${item.id} belongs to another file`);
            return cleanMatchForSaving(item);
        });
        return { filePath: file.filePath, yaml: yamlService.serializeYaml(data) };
    });
    // Attach handlers immediately so queued validation failures cannot become unhandled rejections.
    const serialized = Promise.all(prepared.map(async file => ({ filePath: file.filePath, content: await file.yaml })));
    void serialized.catch(() => {});
    const save = saveQueue.then(async () => {
        const writes = await serialized;
        if (new Set(writes.map(file => file.filePath)).size !== writes.length) throw new Error('Duplicate configuration write');
        const originals = new Map<string, string | null>();
        for (const file of writes) {
            await workspaceService.validateYamlText(file.content);
            originals.set(file.filePath, await platformService.fileExists(file.filePath) ? await platformService.readFile(file.filePath) : null);
            await workspaceService.backupFile(file.filePath);
        }
        const completed: string[] = [];
        try {
            for (const file of writes) {
                await platformService.writeFile(file.filePath, file.content);
                completed.push(file.filePath);
            }
        } catch (cause) {
            const failures: string[] = [];
            for (const path of completed.reverse()) {
                try {
                    const original = originals.get(path);
                    if (original == null) await platformService.deleteFile(path);
                    else await platformService.writeFile(path, original);
                } catch (error) {
                    failures.push(`${path}: ${String(error)}`);
                }
            }
            const message = cause instanceof Error ? cause.message : String(cause);
            throw new Error(failures.length ? `${message}; rollback failed: ${failures.join('; ')}` : message);
        }
    });
    saveQueue = save.catch(() => {});
    return save;
}

export function saveConfigurationFile(filePath: string, itemsToSave: Match[], existingYamlData: YamlData = {}): Promise<void> {
    return saveConfigurationFiles([{ filePath, itemsToSave, existingYamlData }]);
}

/**
 * 保存全局配置对象到其对应的文件路径。
 * @param filePath 全局配置文件的完整路径 (通常是 config/default.yml)。
 * @param configData 要保存的 GlobalConfig 对象。
 * @throws 如果序列化或写入文件失败，则抛出错误。
 */
export const saveGlobalConfig = async (filePath: string, configData: GlobalConfig): Promise<void> => {
    console.log(`[EspansoService] 准备保存全局配置: ${filePath}`);
    try {
        const yamlContent = await yamlService.serializeYaml(configData as YamlData); // 类型转换
        await workspaceService.validateYamlText(yamlContent);
        await workspaceService.backupFile(filePath);
        await platformService.writeFile(filePath, yamlContent);
        console.log(`[EspansoService] 全局配置保存成功: ${filePath}`);
    } catch (err: any) {
        console.error(`[EspansoService] 保存全局配置 ${filePath} 失败: ${err.message}`);
        throw new Error(`Failed to save global config ${filePath}: ${err.message}`);
    }
};

/**
 * 在指定文件夹下创建一个新的、包含默认内容的 Espanso 配置文件 (.yml)。
 * @param folderPath 要创建文件的目标文件夹路径。
 * @param fileName 新文件的名称 (应包含 .yml 后缀)。
 * @returns 创建成功后的新文件的完整路径。
 * @throws 如果文件名无效、文件已存在、序列化或写入失败，则抛出错误。
 */
export const createAndSaveEmptyConfigFile = async (folderPath: string, fileName: string): Promise<string> => {
    console.log(`[EspansoService] 准备创建新配置文件: ${fileName} 在 ${folderPath}`);

    // 验证文件名
    if (!fileName || !fileName.toLowerCase().endsWith('.yml')) {
         throw new Error("Invalid file name. Must end with .yml");
    }
    if (fileName.includes('/') || fileName.includes('\\')) {
        throw new Error("Invalid file name. Cannot contain path separators.");
    }

    const newFilePath = await platformService.joinPath(folderPath, fileName);

    // 检查文件是否已存在
    if (await platformService.fileExists(newFilePath)) {
        throw new Error(`File already exists: ${newFilePath}`);
    }

    // 创建默认内容 (例如一个空的 matches 列表或一个示例)
    const defaultContent: YamlData = {
         matches: [
             { // 使用 Espanso YAML 格式的字段
                 trigger: ':newtrigger',
                 replace: 'Your new snippet!',
                 label: '新创建的片段'
             }
         ]
        // 或者仅: matches: []
    };

    try {
        console.log(`[EspansoService] 序列化默认内容用于: ${newFilePath}`);
        const yamlContent = await yamlService.serializeYaml(defaultContent);

        console.log(`[EspansoService] 写入新文件: ${newFilePath}`);
        await platformService.writeFile(newFilePath, yamlContent);

        console.log(`[EspansoService] 新配置文件创建成功: ${newFilePath}`);
        return newFilePath; // 返回新文件的路径

    } catch (err: any) {
        console.error(`[EspansoService] 创建新配置文件 ${newFilePath} 失败: ${err.message}`);
        throw new Error(`Failed to create config file ${fileName}: ${err.message}`);
    }
};