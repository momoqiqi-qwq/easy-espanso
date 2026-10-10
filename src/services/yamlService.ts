/**
 * YAML 服务 (Yaml Service)
 *
 * 职责: 提供 YAML 字符串与 JavaScript 对象之间相互转换的功能。
 * 实现: 将调用委托给 PlatformAdapterFactory 获取的当前平台适配器。
 */
import { PlatformAdapterFactory } from './platform/PlatformAdapterFactory';
import type { IPlatformAdapter } from './platform/IPlatformAdapter';
import type { YamlData } from '@/types/core/preload.types'; // 假设类型已移动

/**
 * 解析 YAML 字符串。
 * @param yamlString 包含 YAML 格式内容的字符串。
 * @returns 解析后的 JavaScript 对象/数据结构 (YamlData)。
 * @throws 如果解析失败，则可能抛出错误 (取决于适配器的实现)。
 */
export async function parseYaml(yamlString: string): Promise<YamlData> {
    const adapter: IPlatformAdapter = PlatformAdapterFactory.getInstance();
    console.log("[YamlService] 调用适配器 parseYaml"); // 调试日志
    try {
        const result = await adapter.parseYaml(yamlString);
        // 可以在这里添加对结果的验证或处理（如果需要）
        return result;
    } catch (error) {
        console.error("[YamlService] 解析 YAML 失败:", error);
        // 可以选择向上抛出错误，或返回一个默认/空对象
        throw error; // 让调用者 (espansoService) 处理错误
        // return {}; // 或者返回空对象
    }
}

/**
 * 将 JavaScript 对象/数据结构序列化为 YAML 格式的字符串。
 * @param data 要序列化的 JavaScript 对象/数据结构 (符合 YamlData 结构)。
 * @returns YAML 格式的字符串。
 * @throws 如果序列化失败，则可能抛出错误 (取决于适配器的实现)。
 */
export async function serializeYaml(data: YamlData): Promise<string> {
    const adapter: IPlatformAdapter = PlatformAdapterFactory.getInstance();
    console.log("[YamlService] 调用适配器 serializeYaml"); // 调试日志

    try {
        // 预处理数据，移除循环引用和不可序列化的属性
        const cleanData = removeCircularReferences(data);
        
        // 使用适配器序列化清理后的数据
        const result = await adapter.serializeYaml(cleanData as YamlData);
        return result;
    } catch (error) {
        console.error("[YamlService] 序列化 YAML 失败:", error);
        throw error; // 让调用者 (espansoService) 处理错误
    }
}

/** Shared YAML aliases are valid; only references to an ancestor are cycles. */
function removeCircularReferences(obj: unknown): unknown {
    const ancestors = new WeakSet<object>();
    function clean(value: unknown, path: string): unknown {
        if (value === null || typeof value !== 'object') return value;
        if (ancestors.has(value)) throw new Error(`Circular YAML reference at ${path}`);
        // Keep scalars such as YAML timestamps intact.
        if (value instanceof Date) return new Date(value.getTime());
        ancestors.add(value);
        try {
            if (Array.isArray(value)) return value.map((item, index) => clean(item, `${path}[${index}]`));
            return Object.fromEntries(Object.entries(value)
                .filter(([, item]) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
                .map(([key, item]) => [key, clean(item, `${path}.${key}`)]));
        } finally {
            ancestors.delete(value);
        }
    }
    return clean(obj, 'root');
}
