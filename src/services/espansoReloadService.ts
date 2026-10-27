import { toast } from 'vue-sonner';
import i18n from '@/i18n';
import { useUserPreferences } from '@/store/useUserPreferences';
import { controlEspanso, getEspansoStatus } from './espansoInstallService';

/**
 * 片段/配置写入 Espanso 配置目录后，自动重启 Espanso 让改动立即生效。
 * 只有用户在「设置 → 界面偏好」开启 autoReloadEspanso 时才真正执行；默认关闭，不改变既有行为。
 */

/** 写入到重启之间的静默窗口：连续编辑（自动保存、撤销/重做、批量移动）合并成一次重启。 */
export const AUTO_RELOAD_DEBOUNCE_MS = 800;
/** 失败提示冷却时间，避免 Espanso 持续报错时反复弹出通知。 */
const FAILURE_NOTICE_COOLDOWN_MS = 60_000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let reloadInFlight = false;
let reloadPending = false;
let lastFailureNoticeAt = 0;

function translate(key: string, fallback: string): string {
  try {
    return i18n.global.t(key) || fallback;
  } catch {
    return fallback;
  }
}

/** 读取开关状态。Pinia 未就绪（如单测环境）时按关闭处理。 */
export function isAutoReloadEspansoEnabled(): boolean {
  try {
    return useUserPreferences().preferences.autoReloadEspanso === true;
  } catch (error) {
    console.warn('[EspansoReload] 读取自动重载偏好失败:', error);
    return false;
  }
}

function notifyReloadFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // Espanso 未安装/未找到可执行文件：配置本身已写成功，不打扰用户。
  if (/not found|not installed|does not exist|未找到|未安装/i.test(message)) return;
  const now = Date.now();
  if (now - lastFailureNoticeAt < FAILURE_NOTICE_COOLDOWN_MS) return;
  lastFailureNoticeAt = now;
  toast.error(`${translate('settings.interfaceSettings.autoReloadEspansoFailed', '自动重载 Espanso 失败')}: ${message}`);
}

async function performReload(): Promise<void> {
  if (reloadInFlight) {
    // 已有重载在进行：记一次待办，本次结束后补一次，保证最后一次写入一定生效。
    reloadPending = true;
    return;
  }
  reloadInFlight = true;
  try {
    const status = await getEspansoStatus();
    // 只在已安装且正在运行时重启，避免把用户主动停掉的服务意外拉起来。
    if (!status.installed || !status.running) return;
    await controlEspanso('restart');
  } catch (error) {
    notifyReloadFailure(error);
  } finally {
    reloadInFlight = false;
    if (reloadPending) {
      reloadPending = false;
      scheduleEspansoReload();
    }
  }
}

/** 防抖触发自动重载；开关关闭时直接跳过。写入成功后调用，不阻塞写入流程。 */
export function scheduleEspansoReload(): void {
  if (!isAutoReloadEspansoEnabled()) return;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void performReload();
  }, AUTO_RELOAD_DEBOUNCE_MS);
}

/**
 * 手动立即重载（清掉待执行的防抖，忽略开关状态）。给「现在就想生效」的入口用。
 */
export async function reloadEspansoNow(): Promise<void> {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await performReload();
}
