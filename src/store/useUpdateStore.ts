import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  currentVersion, downloadPercent, downloadUpdateAsset, installUpdate, isNewerVersion, isVersionSkipped,
  latestRelease, pickInstallerAsset, type Release, type ReleaseAsset, type UpdateDownloadProgress,
} from '@/services/updateService';
import { useUserPreferences } from '@/store/useUserPreferences';

/** 速度/剩余时间的采样间隔：太密会抖，太疏会看不出变化。 */
const SPEED_SAMPLE_MS = 400;

export const useUpdateStore = defineStore('updates', () => {
  const preferences = useUserPreferences();
  const checking = ref(false);
  const checked = ref(false);
  const current = ref('');
  const release = ref<Release | null>(null);
  const available = ref(false);
  const error = ref('');
  const downloading = ref(false);
  const installing = ref(false);
  /** 下载进度；null 表示当前没有进行中的下载。 */
  const progress = ref<UpdateDownloadProgress | null>(null);
  /** 瞬时下载速度（字节/秒），0 表示还测不出来。 */
  const speed = ref(0);
  /** 预计剩余秒数，0 表示未知（总长未知或刚起步）。 */
  const remaining = ref(0);
  /** 本次会话内被关掉的提醒（不写偏好，下次启动仍会提醒）。 */
  const dismissed = ref(false);

  const skippedVersion = computed(() => preferences.preferences.skippedUpdateVersion ?? '');
  const skipped = computed(() => isVersionSkipped(release.value?.tag_name ?? '', skippedVersion.value));
  const installer = computed<ReleaseAsset | null>(() => (release.value ? pickInstallerAsset(release.value) : null));
  /** 启动提醒条件：有新版本 + 未被「不再提醒」忽略 + 本次会话未关闭。 */
  const shouldPrompt = computed(() => available.value && !!release.value && !skipped.value && !dismissed.value);
  /** 进度条宽度（%）；总长度未知时 0，前端改用不确定态。 */
  const percent = computed(() => progress.value?.percent ?? 0);
  const total = computed(() => progress.value?.total ?? 0);
  const downloaded = computed(() => progress.value?.downloaded ?? 0);
  /** 总长度未知时进度条走"不确定"动画。 */
  const indeterminate = computed(() => downloading.value && total.value <= 0);

  async function check() {
    if (checking.value) return;
    checking.value = true;
    error.value = '';
    try {
      current.value = await currentVersion();
      const result = await latestRelease();
      const newer = result ? isNewerVersion(result.tag_name, current.value) : false;
      release.value = result;
      available.value = newer;
      checked.value = true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
    } finally {
      checking.value = false;
    }
  }

  /** 「不再提醒」：只忽略当前这个版本，出现更高版本仍会提醒。 */
  function skipVersion() {
    preferences.updatePreference('skippedUpdateVersion', release.value?.tag_name ?? '');
    dismissed.value = true;
  }

  function resumeReminders() {
    preferences.updatePreference('skippedUpdateVersion', '');
  }

  function dismiss() {
    dismissed.value = true;
  }

  function resetProgress() {
    progress.value = null;
    speed.value = 0;
    remaining.value = 0;
  }

  /** 自动更新：原生下载安装包（带进度）→ 启动安装程序（应用随即退出）。 */
  async function updateNow() {
    if (downloading.value || installing.value) return;
    const asset = installer.value;
    if (!asset) throw new Error('no-installer');
    error.value = '';
    downloading.value = true;
    progress.value = { downloaded: 0, total: asset.size || 0, percent: 0 };
    speed.value = 0;
    remaining.value = 0;
    let sampledAt = 0;
    let sampledBytes = 0;
    try {
      const path = await downloadUpdateAsset(asset, (event) => {
        const size = event.total || asset.size || 0;
        progress.value = {
          downloaded: event.downloaded,
          total: size,
          percent: event.percent || downloadPercent(event.downloaded, size),
        };
        const now = Date.now();
        if (!sampledAt) {
          sampledAt = now;
          sampledBytes = event.downloaded;
          return;
        }
        const elapsed = now - sampledAt;
        if (elapsed < SPEED_SAMPLE_MS) return;
        const rate = ((event.downloaded - sampledBytes) * 1000) / elapsed;
        sampledAt = now;
        sampledBytes = event.downloaded;
        if (rate > 0) {
          speed.value = rate;
          remaining.value = size > event.downloaded ? (size - event.downloaded) / rate : 0;
        }
      });
      if (path) {
        progress.value = { downloaded: progress.value?.downloaded ?? 0, total: progress.value?.total ?? 0, percent: 100 };
        installing.value = true;
        await installUpdate(path);
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    } finally {
      downloading.value = false;
      installing.value = false;
      resetProgress();
    }
  }

  return {
    checking, checked, current, release, available, error, downloading, installing, dismissed,
    progress, percent, total, downloaded, speed, remaining, indeterminate,
    skippedVersion, skipped, installer, shouldPrompt,
    check, skipVersion, resumeReminders, dismiss, updateNow,
  };
});
