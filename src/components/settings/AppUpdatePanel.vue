<template>
  <section class="rounded-lg border p-4 mb-4 space-y-3" aria-live="polite">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="font-semibold">{{ t('updates.title') }}</h2>
        <p class="text-sm text-muted-foreground">{{ t('updates.current', { version: updates.current || version }) }}</p>
      </div>
      <Button variant="outline" :disabled="updates.checking" @click="updates.check()">
        {{ t(updates.checking ? 'updates.checking' : 'updates.check') }}
      </Button>
    </div>
    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" :checked="preferences.preferences.checkUpdatesOnStartup"
        @change="preferences.updatePreference('checkUpdatesOnStartup', ($event.target as HTMLInputElement).checked)" />
      {{ t('updates.automatic') }}
    </label>
    <p v-if="updates.error" class="text-sm text-destructive">{{ t('updates.failed') }}: {{ updates.error }}</p>
    <template v-else-if="updates.checked">
      <p class="text-sm">{{ updates.available ? t('updates.available', { version: updates.release?.tag_name }) : t(updates.release ? 'updates.latest' : 'updates.noRelease') }}</p>
    </template>
    <template v-if="updates.release && updates.available">
      <pre v-if="updates.release.body" class="text-sm whitespace-pre-wrap max-h-40 overflow-auto font-sans">{{ updates.release.body }}</pre>
      <div class="flex flex-wrap gap-2">
        <Button v-for="asset in assets" :key="asset.browser_download_url" variant="outline" @click="open(asset.browser_download_url)">
          {{ t('updates.download') }} {{ asset.name }} ({{ (asset.size / 1048576).toFixed(1) }} MB)
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">{{ t(assets.length ? 'updates.downloadHint' : 'updates.noAssets') }}</p>
    </template>
    <button class="text-sm text-primary underline" @click="open(RELEASES_URL)">{{ t('updates.releases') }}</button>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { useUpdateStore } from '@/store/useUpdateStore';
import { useUserPreferences } from '@/store/useUserPreferences';
import { downloadableAssets, openReleaseUrl, RELEASES_URL } from '@/services/updateService';
import { version } from '../../../package.json';
const { t } = useI18n();
const updates = useUpdateStore();
const preferences = useUserPreferences();
const assets = computed(() => updates.release ? downloadableAssets(updates.release) : []);
async function open(url: string) {
  try { await openReleaseUrl(url); }
  catch (error) { toast.error(t('updates.failed'), { description: String(error) }); }
}
</script>
