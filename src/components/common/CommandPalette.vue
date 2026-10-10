<template>
  <div v-if="open" class="overlay" @click.self="close">
    <div class="palette">
      <div class="search">
        <SearchIcon />
        <input ref="input" v-model="query" :placeholder="t('commandPalette.placeholder')"
          @keydown.down.prevent="step(1)" @keydown.up.prevent="step(-1)" @keydown.enter.prevent="run(rows[index])" />
      </div>

      <div class="items">
        <template v-for="group in groups" :key="group.kind">
          <div v-if="group.rows.length" class="group-title">{{ t(`commandPalette.groups.${group.kind}`) }}</div>
          <button v-for="row in group.rows" :key="row.id" :class="{ active: row._i === index }" @mouseenter="index = row._i"
            @click="run(row)">
            <component :is="row.icon" />
            <span>
              <strong>{{ row.title }}</strong>
              <small>{{ row.hint }}</small>
            </span>
            <kbd v-if="row.key">{{ row.key }}</kbd>
          </button>
        </template>
        <div v-if="!rows.length" class="none">{{ t('commandPalette.empty') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  AppWindowIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  FileTextIcon,
  FolderOpenIcon,
  Redo2Icon,
  RefreshCwIcon,
  ScissorsIcon,
  SearchIcon,
  SettingsIcon,
  TypeIcon,
  Undo2Icon,
} from 'lucide-vue-next';
import { useEspansoStore } from '@/store/useEspansoStore';
import * as platform from '@/services/platformService';
import { controlEspanso } from '@/services/espansoInstallService';
import type { Match } from '@/types/core/espanso.types';

const router = useRouter();
const store = useEspansoStore();
const { t } = useI18n();

const open = ref(false);
const query = ref('');
const index = ref(0);
const input = ref<HTMLInputElement | null>(null);

type Kind = 'command' | 'match' | 'file';
interface Row {
  id: string;
  kind: Kind;
  title: string;
  hint: string;
  key?: string;
  icon: any;
  disabled?: () => boolean;
  action: () => any;
  /** 扁平列表里的位置，键盘/鼠标共用同一套索引 */
  _i: number;
}

const MAX_MATCHES = 8;
const MAX_FILES = 5;

// ==================== 命令 ====================
const commands = computed<Omit<Row, '_i'>[]>(() => {
  const k = (name: string) => t(`commandPalette.cmd.${name}`);
  return [
    { id: 'snippets', kind: 'command', title: k('snippets'), hint: k('snippetsHint'), icon: ScissorsIcon, action: () => router.push('/snippets') },
    { id: 'apps', kind: 'command', title: k('apps'), hint: k('appsHint'), icon: AppWindowIcon, action: () => router.push('/apps') },
    { id: 'settings', kind: 'command', title: k('settings'), hint: k('settingsHint'), icon: SettingsIcon, action: () => router.push('/settings') },
    {
      id: 'undo', kind: 'command', title: k('undo'), icon: Undo2Icon, key: 'Ctrl+Z',
      hint: store.history.undoStack.at(-1)?.label || k('undoEmpty'),
      disabled: () => !store.history.canUndo, action: () => store.undo(),
    },
    {
      id: 'redo', kind: 'command', title: k('redo'), icon: Redo2Icon, key: 'Ctrl+Y',
      hint: store.history.redoStack.at(-1)?.label || k('redoEmpty'),
      disabled: () => !store.history.canRedo, action: () => store.redo(),
    },
    {
      id: 'open', kind: 'command', title: k('open'), icon: FolderOpenIcon,
      hint: store.state.configRootDir || k('openEmpty'),
      disabled: () => !store.state.configRootDir,
      action: () => platform.openInExplorer(store.state.configRootDir!),
    },
    { id: 'restart', kind: 'command', title: k('restart'), hint: k('restartHint'), icon: RefreshCwIcon, action: () => controlEspanso('restart') },
    { id: 'expand', kind: 'command', title: k('expand'), hint: k('expandHint'), icon: ChevronsUpDownIcon, action: () => store.expandAllNodes() },
    { id: 'collapse', kind: 'command', title: k('collapse'), hint: k('collapseHint'), icon: ChevronsDownUpIcon, action: () => store.collapseAllNodes() },
  ];
});

// ==================== 片段 / 文件检索 ====================
const triggersOf = (m: Match): string[] =>
  m.triggers && m.triggers.length ? m.triggers : m.trigger ? [m.trigger] : [];

const matchedMatches = computed<Omit<Row, '_i'>[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return (store.allMatches || [])
    .filter((m) => {
      const triggers = triggersOf(m);
      return triggers.some((x) => x.toLowerCase().includes(q))
        || (m.label || '').toLowerCase().includes(q)
        || (m.description || '').toLowerCase().includes(q);
    })
    .slice(0, MAX_MATCHES)
    .map((m) => {
      const triggers = triggersOf(m);
      const extra = triggers.length - 1;
      const fileBase = (m.filePath || '').split(/[\\/]/).pop() || '';
      const meta = (m.label || m.description || '').trim();
      return {
        id: `match:${m.id}`,
        kind: 'match' as Kind,
        title: triggers[0] || m.id,
        hint: [meta, extra > 0 ? t('commandPalette.moreTriggers', { n: extra }) : '', fileBase].filter(Boolean).join(' · '),
        icon: TypeIcon,
        action: () => {
          router.push('/snippets');
          store.selectItem(m.id, 'match');
        },
      };
    });
});

/** 配置树里的 match 文件，供"跳到某个 yml"用 */
const fileNodes = computed<{ id: string; name: string; path: string }[]>(() => {
  const out: { id: string; name: string; path: string }[] = [];
  const walk = (nodes: any[] | undefined) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'file' && n.path) out.push({ id: n.id, name: n.name || String(n.path).split(/[\\/]/).pop() || '', path: n.path });
      else if (n.type === 'folder' && n.children) walk(n.children);
    });
  };
  walk(store.state.configTree as any);
  return out;
});

const matchedFiles = computed<Omit<Row, '_i'>[]>(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return fileNodes.value
    .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    .slice(0, MAX_FILES)
    .map((f) => ({
      id: `file:${f.id}`,
      kind: 'file' as Kind,
      title: f.name,
      hint: f.path,
      icon: FileTextIcon,
      action: () => {
        router.push('/snippets');
        store.selectItem(f.id, 'file');
      },
    }));
});

// ==================== 扁平列表 + 分组渲染 ====================
const rows = computed<Row[]>(() => {
  const q = query.value.trim().toLowerCase();
  const enabled = commands.value.filter((c) => !c.disabled?.());
  const cmds = q
    ? enabled.filter((c) => `${c.title} ${c.hint}`.toLowerCase().includes(q))
    : enabled;
  return [...cmds, ...matchedMatches.value, ...matchedFiles.value].map((r, i) => ({ ...r, _i: i }));
});

const groups = computed(() => {
  const by = (kind: Kind) => rows.value.filter((r) => r.kind === kind);
  return [
    { kind: 'command' as Kind, rows: by('command') },
    { kind: 'match' as Kind, rows: by('match') },
    { kind: 'file' as Kind, rows: by('file') },
  ];
});

function close() { open.value = false; }
function show() {
  open.value = true;
  query.value = '';
  index.value = 0;
  nextTick(() => input.value?.focus());
}
function run(row?: Row) {
  if (!row) return;
  close();
  row.action();
}
function step(d: number) {
  if (rows.value.length) index.value = (index.value + d + rows.value.length) % rows.value.length;
}

function keys(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    open.value ? close() : show();
  } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) {
    e.preventDefault();
    store.undo();
  } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !typing) {
    e.preventDefault();
    store.redo();
  } else if (e.key === 'Escape' && open.value) {
    close();
  }
}

onMounted(() => window.addEventListener('keydown', keys));
onBeforeUnmount(() => window.removeEventListener('keydown', keys));
watch(rows, () => { index.value = 0; });
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: #0008; z-index: 1000; display: flex; justify-content: center; padding-top: 12vh }
.palette { width: min(640px, 90vw); height: max-content; max-height: 68vh; background: hsl(var(--popover)); border: 1px solid hsl(var(--border)); border-radius: 14px; box-shadow: 0 20px 60px #0006; overflow: hidden }
.search { display: flex; align-items: center; gap: 10px; padding: 14px; border-bottom: 1px solid hsl(var(--border)) }
.search svg { width: 20px }
.search input { flex: 1; background: transparent; outline: 0; font-size: 16px }
.items { padding: 7px; max-height: 55vh; overflow: auto }
.items button { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; padding: 10px; border-radius: 8px }
.items button.active { background: hsl(var(--accent)) }
.items button > svg { width: 19px }
.items span { display: grid; flex: 1 }
.items small { color: hsl(var(--muted-foreground)) }
.items kbd { font-size: 11px; border: 1px solid hsl(var(--border)); padding: 2px 5px; border-radius: 5px }
.group-title { padding: 10px 10px 4px; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: hsl(var(--muted-foreground)) }
.none { padding: 25px; text-align: center; color: hsl(var(--muted-foreground)) }
</style>
