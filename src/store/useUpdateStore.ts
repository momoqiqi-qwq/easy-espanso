import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  currentVersion, downloadUpdateAsset, installUpdate, isNewerVersion, isVersionSkipped,
  latestRelease, pickInstallerAsset, type Release, type ReleaseAsset,
} from '@/services/updateService';
import { useUserPreferences } from '@/store/useUserPreferences';

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
  /** 本次会话内被关掉的提醒（不写偏好，下次启动仍会提醒）。 */
  const dismissed = ref(false);

  const skippedVersion = computed(() => preferences.preferences.skippedUpdateVersion ?? '');
  const skipped = computed(() => isVersionSkipped(release.value?.tag_name ?? '', skippedVersion.value));
  const installer = computed<ReleaseAsset | null>(() => (release.value ? pickInstallerAsset(release.value) : null));
  /** 启动提醒条件：有新版本 + 未被「不再提醒」忽略 + 本次会话未关闭。 */
  const shouldPrompt = computed(() => available.value && !!release.value && !skipped.value && !dismissed.value);

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

  /** 自动更新：原生下载安装包 → 启动安装程序（应用随即退出）。 */
  async function updateNow() {
    if (downloading.value || installing.value) return;
    const asset = installer.value;
    if (!asset) throw new Error('no-installer');
    error.value = '';
    downloading.value = true;
    try {
      const path = await downloadUpdateAsset(asset);
      if (path) {
        installing.value = true;
        await installUpdate(path);
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      throw cause;
    } finally {
      downloading.value = false;
      installing.value = false;
    }
  }

  return {
    checking, checked, current, release, available, error, downloading, installing, dismissed,
    skippedVersion, skipped, installer, shouldPrompt,
    check, skipVersion, resumeReminders, dismiss, updateNow,
  };
});
