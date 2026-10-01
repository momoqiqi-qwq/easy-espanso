import { defineStore } from 'pinia';
import { ref } from 'vue';
import { currentVersion, latestRelease, isNewerVersion, type Release } from '@/services/updateService';

export const useUpdateStore = defineStore('updates', () => {
  const checking = ref(false);
  const checked = ref(false);
  const current = ref('');
  const release = ref<Release | null>(null);
  const available = ref(false);
  const error = ref('');
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
  return { checking, checked, current, release, available, error, check };
});
