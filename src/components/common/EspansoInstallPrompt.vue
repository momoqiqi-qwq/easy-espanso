<template>
  <div class="espanso-install-prompt">
    <Card class="w-full max-w-xl overflow-hidden border bg-card shadow-xl">
      <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
        <div class="flex items-center gap-3">
          <div class="rounded-full bg-white/15 p-2">
            <RefreshCwIcon v-if="isChecking" class="h-6 w-6 animate-spin" />
            <AlertTriangleIcon v-else class="h-6 w-6" />
          </div>
          <div>
            <h2 class="text-xl font-semibold">{{ panelTitle }}</h2>
            <p class="mt-1 text-sm text-white/80">{{ panelSubtitle }}</p>
          </div>
        </div>
      </div>

      <CardContent class="space-y-5 p-6">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border bg-muted/40 p-3">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <ComputerIcon class="h-4 w-4" />
              {{ t('installation.detectedOS') }}
            </div>
            <div class="mt-1 font-medium">{{ osName }}</div>
          </div>

          <div class="rounded-lg border bg-muted/40 p-3">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <ActivityIcon class="h-4 w-4" />
              {{ t('installation.runtimeStatus') }}
            </div>
            <div class="mt-1 font-medium">{{ runtimeLabel }}</div>
          </div>
        </div>

        <div v-if="status.executablePath" class="rounded-lg border bg-muted/25 p-3">
          <div class="text-xs text-muted-foreground">{{ t('installation.detectedExecutable') }}</div>
          <div class="mt-1 break-all font-mono text-xs">{{ status.executablePath }}</div>
          <div v-if="status.version" class="mt-2 text-xs text-muted-foreground">{{ status.version }}</div>
        </div>

        <div v-if="diagnosticMessage" class="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div class="flex items-start gap-2">
            <AlertCircleIcon class="mt-0.5 h-4 w-4 flex-none text-destructive" />
            <div>
              <p class="text-sm font-medium text-destructive">{{ diagnosticMessage }}</p>
              <p class="mt-1 text-xs text-muted-foreground">{{ t('installation.pathHint') }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <Button v-if="status.installed && !status.running" @click="runAction('start')" :disabled="isChecking">
            <PlayIcon class="mr-2 h-4 w-4" />
            {{ t('installation.startService') }}
          </Button>

          <Button v-else @click="selectExecutable" :disabled="isChecking">
            <FileSearchIcon class="mr-2 h-4 w-4" />
            {{ t('installation.locateExecutable') }}
          </Button>

          <Button variant="outline" @click="checkAgain" :disabled="isChecking">
            <RefreshCwIcon class="mr-2 h-4 w-4" :class="{ 'animate-spin': isChecking }" />
            {{ t('installation.checkAgain') }}
          </Button>

          <Button variant="outline" @click="openInstallGuide">
            <ExternalLinkIcon class="mr-2 h-4 w-4" />
            {{ t('installation.viewInstallGuide') }}
          </Button>

          <Button variant="secondary" @click="continueWithoutEspanso">
            <FileEditIcon class="mr-2 h-4 w-4" />
            {{ t('installation.editOnlyMode') }}
          </Button>
        </div>

        <p class="text-center text-xs text-muted-foreground">
          {{ t('installation.editOnlyHint') }}
        </p>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import {
  ActivityIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  ComputerIcon,
  ExternalLinkIcon,
  FileEditIcon,
  FileSearchIcon,
  PlayIcon,
  RefreshCwIcon,
} from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  controlEspanso,
  getEspansoStatus,
  getInstallGuideLink,
  getOSType,
  saveEspansoExecutable,
} from '@/services/espansoInstallService';
import { openExternalLink, showOpenDialog } from '@/services/platformService';
import type { EspansoRuntimeStatus } from '@/types/core/preload.types';

const emit = defineEmits<{
  (event: 'check-complete', installed: boolean): void;
  (event: 'continue-without-espanso'): void;
}>();

const { t } = useI18n();
const isChecking = ref(false);
const status = ref<EspansoRuntimeStatus>({
  installed: false,
  running: false,
  state: 'not-found',
  executablePath: null,
  source: null,
  version: '',
  message: '',
});

const osType = getOSType();
const osName = computed(() => ({ windows: 'Windows', macos: 'macOS', linux: 'Linux' }[osType] || t('common.unknown')));
const runtimeLabel = computed(() => {
  if (isChecking.value) return t('installation.checking');
  if (!status.value.installed) return t('installation.notInstalled');
  if (status.value.running) return t('installation.running');
  if (status.value.state === 'stopped') return t('installation.stopped');
  return t('installation.installedStatusUnknown');
});
const panelTitle = computed(() => status.value.installed ? t('installation.installedDetected') : t('installation.notDetected'));
const panelSubtitle = computed(() => status.value.installed
  ? t('installation.installedDetectedDescription')
  : t('installation.description'));
const diagnosticMessage = computed(() => {
  if (status.value.installed && status.value.state === 'stopped') return t('installation.serviceNotRunning');
  if (!status.value.installed) return t('installation.espansoNotFound');
  if (status.value.state === 'unknown' && status.value.message) return status.value.message;
  return '';
});

const refreshStatus = async (emitResult = false) => {
  isChecking.value = true;
  try {
    status.value = await getEspansoStatus();
    if (emitResult && status.value.installed) emit('check-complete', true);
    return status.value;
  } finally {
    isChecking.value = false;
  }
};

const checkAgain = async () => {
  toast.info(t('installation.checking'));
  const nextStatus = await refreshStatus(true);
  if (nextStatus.installed) {
    toast.success(t('installation.installed'));
  } else {
    toast.error(t('installation.espansoNotFound'));
  }
};

const selectExecutable = async () => {
  const result = await showOpenDialog({
    title: t('installation.locateExecutable'),
    properties: ['openFile'],
    filters: osType === 'windows'
      ? [{ name: 'Espanso', extensions: ['exe'] }]
      : undefined,
  });
  if (result.canceled || !result.filePaths?.[0]) return;

  const selectedPath = result.filePaths[0];
  saveEspansoExecutable(selectedPath);
  const nextStatus = await refreshStatus(false);
  if (nextStatus.installed) {
    toast.success(t('installation.executableSaved'));
    emit('check-complete', true);
  } else {
    saveEspansoExecutable('');
    toast.error(t('installation.invalidExecutable'));
  }
};

const runAction = async (action: 'start' | 'stop' | 'restart') => {
  isChecking.value = true;
  try {
    await controlEspanso(action);
    toast.success(t('installation.serviceStarted'));
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    const nextStatus = await refreshStatus(false);
    if (nextStatus.installed) emit('check-complete', true);
  } catch (error) {
    console.error('Espanso service action failed:', error);
    toast.error(t('installation.startFailed'));
  } finally {
    isChecking.value = false;
  }
};

const openInstallGuide = async () => {
  const link = getInstallGuideLink();
  if (!(await openExternalLink(link))) {
    toast.error(t('installation.openLinkFailed', '无法打开链接，请手动访问：') + link);
  }
};

const continueWithoutEspanso = () => emit('continue-without-espanso');

onMounted(async () => {
  const initialStatus = await refreshStatus(false);
  if (initialStatus.installed) emit('check-complete', true);
});
</script>

<style scoped>
.espanso-install-prompt {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 20% 10%, hsl(var(--primary) / 0.09), transparent 35%),
    hsl(var(--background));
}
</style>
