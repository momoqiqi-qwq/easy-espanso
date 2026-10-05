<template>
  <section class="col-span-2 rounded-lg border p-4 space-y-4">
    <h3 class="font-semibold">{{ t('extensionPreferences.title') }}</h3>
    <p class="text-sm text-muted-foreground">{{ t('extensionPreferences.hint') }}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label v-for="key in toggles" :key="key" class="flex items-center gap-2 text-sm">
        <input type="checkbox" :checked="store.preferences[key]" @change="store.updatePreference(key, ($event.target as HTMLInputElement).checked)" />
        {{ t(`extensionPreferences.${key}`) }}
      </label>
      <label class="space-y-1 text-sm">
        <span class="block">{{ t('extensionPreferences.sort') }}</span>
        <select class="w-full border rounded bg-background px-2 py-2" :value="store.preferences.extensionSort" @change="setSort">
          <option v-for="value in ['source', 'trigger', 'label']" :key="value" :value="value">{{ t(`extensionPreferences.${value}`) }}</option>
        </select>
      </label>
      <label class="space-y-1 text-sm">
        <span class="block">{{ t('extensionPreferences.rowHeight') }}</span>
        <select class="w-full border rounded bg-background px-2 py-2" :value="store.preferences.extensionRowHeight" @change="store.updatePreference('extensionRowHeight', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="value in [28, 34, 42]" :key="value" :value="value">{{ value }} px</option>
        </select>
      </label>
      <label class="space-y-1 text-sm">
        <span class="block">{{ t('extensionPreferences.delay') }}</span>
        <select class="w-full border rounded bg-background px-2 py-2" :value="store.preferences.extensionAutoSaveDelay" @change="store.updatePreference('extensionAutoSaveDelay', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="value in [300, 600, 1200, 2000]" :key="value" :value="value">{{ value }} ms</option>
        </select>
      </label>
    </div>
  </section>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useUserPreferences, type UserPreferences } from '@/store/useUserPreferences';
const store = useUserPreferences();
const { t } = useI18n();
const toggles = ['extensionShowIcons', 'extensionShowLabels', 'extensionShowFileNames', 'extensionShowPreview'] as const;
function setSort(event: Event) {
  store.updatePreference('extensionSort', (event.target as HTMLSelectElement).value as UserPreferences['extensionSort']);
}
</script>
