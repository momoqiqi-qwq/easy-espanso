<template>
  <div class="space-y-1.5" data-testid="update-progress">
    <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span class="truncate">{{ headline }}</span>
      <span class="shrink-0 tabular-nums">{{ sizeText }}</span>
    </div>
    <div
      class="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="indeterminate ? undefined : percent"
      :aria-valuetext="indeterminate ? headline : `${percent}%`"
    >
      <div v-if="indeterminate" class="h-full w-1/3 animate-pulse rounded-full bg-primary" />
      <div
        v-else
        class="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
        :style="{ width: `${percent}%` }"
      />
    </div>
    <div class="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span class="tabular-nums">{{ speedText }}</span>
      <span class="tabular-nums">{{ remainingText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatBytes, formatDuration } from '@/services/updateService';

const props = defineProps<{
  percent: number;
  downloaded: number;
  total: number;
  /** 字节/秒；0 表示还测不出来 */
  speed: number;
  /** 剩余秒数；0 表示未知 */
  remaining: number;
  /** 总长度未知：走不确定态进度条 */
  indeterminate: boolean;
}>();

const { t } = useI18n();

const headline = computed(() => (props.indeterminate
  ? t('updates.downloading')
  : t('updates.downloadingPercent', { percent: props.percent })));

const sizeText = computed(() => (props.total > 0
  ? `${formatBytes(props.downloaded)} / ${formatBytes(props.total)}`
  : formatBytes(props.downloaded)));

const speedText = computed(() => (props.speed > 0 ? `${formatBytes(props.speed)}/s` : ''));

const remainingText = computed(() => {
  const time = formatDuration(props.remaining);
  return time ? t('updates.remaining', { time }) : '';
});
</script>
