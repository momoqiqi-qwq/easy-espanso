<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ t('updates.dialogTitle', { version: release?.tag_name || '' }) }}</DialogTitle>
        <DialogDescription>
          {{ t('updates.dialogBody', { current: updates.current, version: release?.tag_name || '' }) }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <pre v-if="release?.body"
          class="max-h-44 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap font-sans">{{ release.body }}</pre>
        <p v-if="!updates.installer" class="text-sm text-muted-foreground">{{ t('updates.noInstaller') }}</p>
        <p v-if="updates.error" class="text-sm text-destructive">{{ t('updates.failed') }}: {{ updates.error }}</p>
        <p class="text-xs text-muted-foreground">{{ t('updates.skipHint') }}</p>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <Button type="button" variant="outline" data-testid="update-skip" :disabled="busy" @click="handleSkip">
          {{ t('updates.skipVersion') }}
        </Button>
        <Button type="button" data-testid="update-now" :disabled="busy || !updates.installer" @click="handleUpdateNow">
          {{ t(updates.downloading ? 'updates.downloading' : updates.installing ? 'updates.installing' : 'updates.updateNow') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUpdateStore } from '@/store/useUpdateStore';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const { t } = useI18n();
const updates = useUpdateStore();
const release = computed(() => updates.release);
const busy = computed(() => updates.downloading || updates.installing);

/** 关掉弹窗只是本次会话不再显示，「不再提醒」才写入偏好。 */
function handleOpenChange(value: boolean) {
  if (!value) updates.dismiss();
  emit('update:open', value);
}

function handleSkip() {
  updates.skipVersion();
  toast.info(t('updates.skipped', { version: release.value?.tag_name || '' }));
  emit('update:open', false);
}

async function handleUpdateNow() {
  try {
    await updates.updateNow();
    toast.info(t('updates.updated'));
    emit('update:open', false);
  } catch (cause) {
    toast.error(t('updates.failed'), { description: String(cause) });
  }
}
</script>
