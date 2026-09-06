<template>
  <div class="space-y-5">
    <div class="rounded-xl border bg-muted/20 p-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="status-dot" :class="statusClass"></span>
            <h3 class="font-semibold">{{ statusTitle }}</h3>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">{{ statusDescription }}</p>
        </div>
        <Button variant="outline" size="sm" @click="refresh" :disabled="busy">
          <RefreshCw class="mr-2 h-4 w-4" :class="{ 'animate-spin': busy }" />
          {{ t('settings.espansoTools.refresh') }}
        </Button>
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        <div class="rounded-lg border bg-background/70 p-3">
          <div class="text-xs text-muted-foreground">{{ t('settings.espansoTools.executablePath') }}</div>
          <div class="mt-1 break-all font-mono text-xs">{{ status.executablePath || t('settings.espansoTools.notFound') }}</div>
        </div>
        <div class="rounded-lg border bg-background/70 p-3">
          <div class="text-xs text-muted-foreground">{{ t('settings.espansoTools.version') }}</div>
          <div class="mt-1 text-sm">{{ status.version || '—' }}</div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Button v-if="status.installed && !status.running" @click="runAction('start')" :disabled="busy">
        <Play class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.start') }}
      </Button>
      <Button v-if="status.installed" variant="outline" @click="runAction('restart')" :disabled="busy">
        <RotateCw class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.restart') }}
      </Button>
      <Button v-if="status.installed && status.running" variant="outline" @click="runAction('stop')" :disabled="busy">
        <Square class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.stop') }}
      </Button>
      <Button variant="outline" @click="selectExecutable" :disabled="busy">
        <FileSearch class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.selectExecutable') }}
      </Button>
      <Button variant="outline" @click="openConfigFolder" :disabled="!configRootDir">
        <FolderOpen class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.openConfigFolder') }}
      </Button>
      <Button variant="outline" @click="openGuide">
        <ExternalLink class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.installGuide') }}
      </Button>
      <Button v-if="savedExecutable" variant="ghost" @click="clearExecutable" :disabled="busy">
        <X class="mr-2 h-4 w-4" />
        {{ t('settings.espansoTools.clearCustomPath') }}
      </Button>
    </div>

    <p class="text-xs text-muted-foreground">{{ t('settings.espansoTools.securityHint') }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { ExternalLink, FileSearch, FolderOpen, Play, RefreshCw, RotateCw, Square, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { useEspansoStore } from '@/store/useEspansoStore';
import {
  controlEspanso,
  getEspansoStatus,
  getInstallGuideLink,
  getOSType,
  getSavedEspansoExecutable,
  saveEspansoExecutable,
} from '@/services/espansoInstallService';
import { openExternalLink, openInExplorer, showOpenDialog } from '@/services/platformService';
import type { EspansoRuntimeStatus } from '@/types/core/preload.types';

const { t } = useI18n();
const store = useEspansoStore();
const busy = ref(false);
const savedExecutable = ref(getSavedEspansoExecutable());
const status = ref<EspansoRuntimeStatus>({
  installed: false,
  running: false,
  state: 'not-found',
  executablePath: null,
  source: null,
  version: '',
  message: '',
});

const configRootDir = computed(() => store.state.configRootDir || '');
const statusTitle = computed(() => {
  if (!status.value.installed) return t('settings.espansoTools.statusNotFound');
  if (status.value.running) return t('settings.espansoTools.statusRunning');
  if (status.value.state === 'stopped') return t('settings.espansoTools.statusStopped');
  return t('settings.espansoTools.statusUnknown');
});
const statusDescription = computed(() => status.value.message || t('settings.espansoTools.statusHint'));
const statusClass = computed(() => ({
  'is-running': status.value.running,
  'is-stopped': status.value.installed && !status.value.running,
  'is-missing': !status.value.installed,
}));

const refresh = async () => {
  busy.value = true;
  try {
    status.value = await getEspansoStatus();
  } finally {
    busy.value = false;
  }
};

const runAction = async (action: 'start' | 'stop' | 'restart') => {
  busy.value = true;
  try {
    await controlEspanso(action);
    toast.success(t(`settings.espansoTools.${action}Success`));
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    status.value = await getEspansoStatus();
  } catch (error: any) {
    toast.error(error?.message || t('settings.espansoTools.actionFailed'));
  } finally {
    busy.value = false;
  }
};

const selectExecutable = async () => {
  const osType = getOSType();
  const result = await showOpenDialog({
    title: t('settings.espansoTools.selectExecutable'),
    properties: ['openFile'],
    filters: osType === 'windows' ? [{ name: 'Espanso', extensions: ['exe'] }] : undefined,
  });
  if (result.canceled || !result.filePaths?.[0]) return;

  saveEspansoExecutable(result.filePaths[0]);
  savedExecutable.value = result.filePaths[0];
  await refresh();
  if (status.value.installed) {
    toast.success(t('settings.espansoTools.pathSaved'));
  } else {
    saveEspansoExecutable('');
    savedExecutable.value = '';
    toast.error(t('settings.espansoTools.invalidExecutable'));
  }
};

const clearExecutable = async () => {
  saveEspansoExecutable('');
  savedExecutable.value = '';
  await refresh();
  toast.info(t('settings.espansoTools.pathCleared'));
};

const openConfigFolder = async () => {
  if (!configRootDir.value) return;
  if (!(await openInExplorer(configRootDir.value))) {
    toast.error(t('settings.espansoTools.openFolderFailed'));
  }
};

const openGuide = () => openExternalLink(getInstallGuideLink());

onMounted(refresh);
</script>

<style scoped>
.status-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 9999px;
  background: hsl(var(--muted-foreground));
  box-shadow: 0 0 0 3px hsl(var(--muted) / 0.6);
}
.status-dot.is-running { background: #22c55e; }
.status-dot.is-stopped { background: #f59e0b; }
.status-dot.is-missing { background: #ef4444; }
</style>
