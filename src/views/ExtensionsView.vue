<template>
  <div class="h-full flex overflow-hidden">
    <!-- 左栏：扩展片段列表（与片段列表页同款布局） -->
    <aside class="ext-list-pane flex flex-col h-full bg-muted border-r border-border shrink-0">
      <div class="flex flex-col py-2 px-4 border-b">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <h3 class="text-lg font-semibold text-foreground m-0">{{ extTypeLabel }}</h3>
            <Badge variant="outline" class="ml-2">{{ listItems.length }} 项</Badge>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" class="h-8 px-2 border-none focus:ring-0 focus:ring-offset-0"
              @click="startCreate">
              <PlusIcon class="h-4 w-4 mr-1" />
              {{ t('extensions.new') }}
            </Button>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto middle-pane-scrollbar py-1">
        <!-- 空状态（与片段页同款居中样式） -->
        <div v-if="listItems.length === 0"
          class="flex flex-col justify-center items-center h-full text-muted-foreground text-center p-8">
          <component :is="typeIcon" class="h-12 w-12 mb-4" />
          <h4 class="text-xl font-semibold text-foreground m-0 mb-2">
            {{ t('extensions.empty.title', { type: extTypeLabel }) }}
          </h4>
          <p class="mb-6 text-muted-foreground max-w-md">{{ t('extensions.empty.hint') }}</p>
          <Button variant="outline" size="sm" @click="startCreate">
            <PlusIcon class="h-4 w-4 mr-1" />
            {{ t('extensions.new') }}
          </Button>
        </div>

        <!-- 紧凑单行列表：图标、触发词、标签 -->
        <template v-else>
          <ExtensionContextMenu v-for="item in listItems" :key="item.id" @action="handleMenuAction(item, $event)">
          <button type="button"
            class="ext-list-row w-full flex items-center gap-1.5 px-3 py-1.5 text-left transition-colors"
            :style="{ minHeight: `${userPreferences.preferences.extensionRowHeight}px` }"
            :class="item.id === editingId && !isCreating
              ? 'bg-[linear-gradient(135deg,#2b5876,#4e4376)] text-white'
              : 'bg-card text-foreground hover:bg-accent hover:text-accent-foreground'"
            :aria-pressed="item.id === editingId && !isCreating"
            :title="[item.trigger, item.label, previewOf(item.match), item.fileBase].filter(Boolean).join('\n')"
            @click="selectItem(item)">
            <component v-if="userPreferences.preferences.extensionShowIcons" :is="typeIcon" class="h-4 w-4 shrink-0"
              :class="item.id === editingId && !isCreating ? 'text-white' : 'text-primary'" />
            <span class="flex-1 min-w-0">
              <span class="block truncate text-sm">{{ item.trigger }}</span>
              <span v-if="userPreferences.preferences.extensionShowPreview" class="block truncate text-xs opacity-70">{{ previewOf(item.match) }}</span>
            </span>
            <span v-if="item.extraTriggers > 0" class="shrink-0 text-xs opacity-80">+{{ item.extraTriggers }}</span>
            <span v-if="userPreferences.preferences.extensionShowLabels && item.label" class="min-w-0 max-w-[40%] shrink-0 truncate text-xs px-1.5 rounded"
              :class="item.id === editingId && !isCreating ? 'bg-white/15 text-white' : 'bg-accent/50 text-muted-foreground'"
              :title="item.label || item.fileBase">
              {{ item.label }}
            </span>
            <span v-if="userPreferences.preferences.extensionShowFileNames && (!item.label || !userPreferences.preferences.extensionShowLabels)" class="max-w-[40%] shrink-0 truncate text-xs opacity-70" :title="item.filePath">{{ item.fileBase }}</span>
          </button>
          </ExtensionContextMenu>
        </template>
      </div>
    </aside>

    <!-- 右栏：编辑区 -->
    <section class="flex-1 flex flex-col h-full bg-card min-w-0">
      <div class="py-2 px-4 border-b shrink-0">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold text-foreground m-0">
            {{ paneTitle }}
            <span v-if="currentTrigger" class="ml-2 text-sm text-muted-foreground">{{ currentTrigger }}</span>
          </h3>
          <Button v-if="!isCreating && editingItem" size="sm" variant="outline" class="h-8 px-2 py-0 justify-center"
            :class="confirmingDelete ? 'border-destructive text-destructive' : ''" @click="onDeleteClick">
            <TrashIcon class="h-4 w-4 mr-1" />
            {{ confirmingDelete ? t('extensions.form.delete') + '?' : t('extensions.form.delete') }}
          </Button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <!-- 未选择任何项 -->
        <div v-if="!isCreating && !editingItem"
          class="flex flex-col justify-center items-center h-full text-muted-foreground text-center p-8">
          <div class="text-5xl mb-4">👈</div>
          <h4 class="text-xl font-semibold text-foreground m-0 mb-2">{{ t('common.noSelection') }}</h4>
          <p class="m-0 max-w-md">{{ t('extensions.empty.hint') }}</p>
        </div>

        <div v-else>
        <!-- 模板选择（仅新建时） -->
        <div v-if="isCreating && !hasEditedAnyField" class="mb-4">
          <h2 class="text-sm font-medium mb-2">{{ t('extensions.templates.title') }}</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            <button v-for="tpl in templates" :key="tpl.key" type="button"
              class="text-left p-3 rounded-md border border-border/30 bg-card shadow-xs hover:border-primary/40 hover:bg-accent/5 transition-all"
              @click="applyTemplate(tpl)">
              <div class="text-sm font-medium">{{ t(tpl.nameKey) }}</div>
              <div class="text-xs text-muted-foreground mt-1">{{ t(tpl.descKey) }}</div>
              <div class="text-xs text-primary mt-2 font-mono">{{ tpl.preview }}</div>
            </button>
          </div>
        </div>

        <!-- 表单 -->
        <form v-if="isCreating || editingItem" class="space-y-5" @submit.prevent="onSave">

          <!-- 基本信息 -->
          <div class="space-y-3 bg-muted/10 p-4 rounded-lg border">
            <h3 class="text-sm font-medium">{{ t('extensions.form.basic') }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <div class="flex items-center">
                  <Label for="ext-trigger" class="mr-2">{{ t('extensions.form.trigger') }} *</Label>
                </div>
                <Textarea id="ext-trigger" v-model="form.trigger" rows="2" />
                <p class="text-xs text-muted-foreground">{{ t('extensions.form.triggerMultiHint') }}</p>
              </div>
              <div class="space-y-1.5">
                <Label for="ext-label">{{ t('extensions.form.label') }}</Label>
                <Input id="ext-label" v-model="form.label" :placeholder="t('extensions.form.labelPlaceholder')" />
              </div>
            </div>
            <div class="space-y-1.5">
              <Label for="ext-replace">{{ t('extensions.form.replace') }}</Label>
              <Textarea id="ext-replace" v-model="form.replace" rows="2" />
              <p class="text-xs text-muted-foreground">{{ replaceHint }}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <Label for="ext-varname">{{ t('extensions.form.varName') }}</Label>
                <Input id="ext-varname" v-model="form.varName" placeholder="output" />
                <p v-if="varNameError" class="text-xs text-destructive">{{ t('extensions.form.varNameInvalid') }}</p>
              </div>
            </div>
          </div>

          <!-- Shell 专属 -->
          <div v-if="isShell" class="space-y-3 bg-muted/10 p-4 rounded-lg border">
            <div class="space-y-1.5">
              <Label for="ext-cmd">{{ t('extensions.form.cmd') }} *</Label>
              <Textarea id="ext-cmd" v-model="form.cmd" rows="4" spellcheck="false"
                class="font-mono text-sm" :placeholder="t('extensions.form.cmdPlaceholder')" />
              <p class="text-xs text-muted-foreground">{{ t('extensions.form.cmdHint') }}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <Label>{{ t('extensions.form.shell') }}</Label>
                <Select v-model="form.shellChoice">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">{{ t('extensions.form.shellDefault') }}</SelectItem>
                    <SelectItem value="powershell">{{ t('extensions.form.shellPowershell') }}</SelectItem>
                    <SelectItem value="cmd">{{ t('extensions.form.shellCmd') }}</SelectItem>
                    <SelectItem value="wsl">{{ t('extensions.form.shellWsl') }}</SelectItem>
                    <SelectItem value="bash">{{ t('extensions.form.shellBash') }}</SelectItem>
                    <SelectItem value="sh">{{ t('extensions.form.shellSh') }}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex items-center space-x-2 mt-6">
                <Checkbox id="ext-trim" v-model="form.trim" />
                <Label for="ext-trim">{{ t('extensions.form.trim') }}</Label>
              </div>
            </div>
          </div>

          <!-- 网页/文件夹专属 -->
          <div v-else-if="isOpenType" class="space-y-3 bg-muted/10 p-4 rounded-lg border">
            <div class="space-y-1.5">
              <Label for="ext-target">{{ isWeb ? t('extensions.form.url') : t('extensions.form.folderPath') }} *</Label>
              <div class="flex gap-2">
                <Input id="ext-target" v-model="form.target" spellcheck="false"
                  :placeholder="isWeb ? t('extensions.form.urlPlaceholder') : t('extensions.form.folderPathPlaceholder')" />
                <Button v-if="isFolder" type="button" variant="outline" class="shrink-0" @click="browseFolder">
                  <FolderOpenIcon class="h-4 w-4 mr-1" />
                  {{ t('extensions.form.browse') }}
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ isWeb ? t('extensions.form.urlHint') : t('extensions.form.folderPathHint') }}
              </p>
            </div>
          </div>

          <!-- Script 专属 -->
          <div v-else-if="isScript" class="space-y-3 bg-muted/10 p-4 rounded-lg border">
            <div class="space-y-1.5">
              <Label>{{ t('extensions.form.mode') }}</Label>
              <div class="flex gap-2">
                <Button type="button" size="sm" variant="outline"
                  :class="{ 'border-primary text-primary': form.mode === 'file' }"
                  @click="form.mode = 'file'">
                  {{ t('extensions.form.modeFile') }}
                </Button>
                <Button type="button" size="sm" variant="outline"
                  :class="{ 'border-primary text-primary': form.mode === 'inline' }"
                  @click="form.mode = 'inline'">
                  {{ t('extensions.form.modeInline') }}
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div class="space-y-1.5">
                <Label for="ext-program">{{ t('extensions.form.program') }} *</Label>
                <div ref="programMenuRoot" class="relative">
                  <Input id="ext-program" v-model="form.program" autocomplete="off" spellcheck="false"
                    class="pr-8" :placeholder="t('extensions.form.programPlaceholder')"
                    @focus="programMenuOpen = true"
                    @input="programMenuOpen = true"
                    @keydown.esc="programMenuOpen = false" />
                  <button type="button" tabindex="-1" :aria-label="t('extensions.form.programMenuLabel')"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground focus:outline-none"
                    @click.stop="toggleProgramMenu">
                    <ChevronDownIcon class="h-4 w-4 transition-transform" :class="programMenuOpen ? 'rotate-180' : ''" />
                  </button>
                  <!-- 常用解释器下拉 -->
                  <div v-if="programMenuOpen"
                    class="absolute z-30 left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1">
                    <button v-for="r in filteredRunners" :key="r.value" type="button"
                      class="w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 hover:bg-accent focus:bg-accent focus:outline-none"
                      :class="form.program === r.value ? 'bg-accent/60' : ''"
                      @mousedown.prevent @click="pickProgram(r.value)">
                      <span class="font-mono">{{ r.value }}</span>
                      <span class="text-xs text-muted-foreground shrink-0">{{ r.hint }}</span>
                    </button>
                    <div v-if="filteredRunners.length === 0"
                      class="px-3 py-2 text-xs text-muted-foreground">{{ t('extensions.form.programNoMatch') }}</div>
                  </div>
                </div>
              </div>
              <div v-if="form.mode === 'file'" class="space-y-1.5 md:col-span-2">
                <Label for="ext-path">{{ t('extensions.form.scriptPath') }} *</Label>
                <div class="flex gap-2">
                  <Input id="ext-path" v-model="form.scriptPath" spellcheck="false" class="flex-1 min-w-0"
                    :placeholder="t('extensions.form.scriptPathPlaceholder')" />
                  <Button type="button" variant="outline" class="shrink-0" @click="browseScriptFile">
                    <FileCodeIcon class="h-4 w-4 mr-1" />
                    {{ t('extensions.form.browse') }}
                  </Button>
                </div>
                <p class="text-xs text-muted-foreground">{{ t('extensions.form.scriptPathHint') }}</p>
              </div>
            </div>

            <div v-if="form.mode === 'file'" class="space-y-1.5">
              <Label for="ext-args">{{ t('extensions.form.extraArgs') }}</Label>
              <Textarea id="ext-args" v-model="form.extraArgs" rows="2" class="font-mono text-sm" />
            </div>

            <div v-if="form.mode === 'inline'" class="space-y-1.5">
              <Label for="ext-code">{{ t('extensions.form.inlineCode') }} *</Label>
              <Textarea id="ext-code" v-model="form.inlineCode" rows="6" spellcheck="false"
                class="font-mono text-sm" />
              <p class="text-xs text-muted-foreground">{{ t('extensions.form.inlineCodeHint') }}</p>
            </div>
          </div>

          <!-- 目标文件（仅新建） -->
          <div v-if="isCreating" class="space-y-1.5 max-w-md">
            <Label>{{ t('extensions.form.targetFile') }}</Label>
            <Select v-model="form.targetFileId">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="f in matchFiles" :key="f.id" :value="f.id">{{ f.path }}</SelectItem>
              </SelectContent>
            </Select>
            <p v-if="!isCreating && !editingItem" class="text-xs text-muted-foreground">{{ t('extensions.movedHint') }}</p>
          </div>
          <p v-else class="text-xs text-muted-foreground max-w-md">{{ t('extensions.movedHint') }}</p>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2">
            <Button type="submit" :disabled="!!varNameError">
              <SaveIcon class="h-4 w-4 mr-1" />
              {{ t('extensions.form.save') }}
            </Button>
            <Button type="button" variant="outline" @click="cancelEdit">
              {{ t('extensions.form.cancel') }}
            </Button>
          </div>
        </form>

        <!-- 参考文档 -->
        <details class="mb-6 rounded-lg border bg-muted/10 open:pb-4" :open="isCreating">
          <summary class="px-4 py-3 text-sm font-medium cursor-pointer select-none">
            {{ t('extensions.docs.title') }}
          </summary>

          <!-- 网页/文件夹专属说明 -->
          <div v-if="isOpenType" class="px-4 space-y-4 text-sm">
            <div>
              <div class="font-medium">{{ t('extensions.docs.openHow') }}</div>
              <p class="text-muted-foreground mt-1">
                {{ isWeb ? t('extensions.docs.openHowWeb') : t('extensions.docs.openHowFolder') }}
              </p>
              <pre class="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto leading-relaxed"><code>{{ openYamlPreview }}</code></pre>
            </div>
            <div>
              <div class="font-medium">{{ t('extensions.docs.perf') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.openPerf') }}</p>
            </div>
            <div>
              <div class="font-medium">{{ t('extensions.docs.openCrossPlatform') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.openCrossPlatformDesc') }}</p>
            </div>
          </div>

          <!-- 通用说明（命令行/脚本） -->
          <div v-else class="px-4 space-y-4 text-sm">
            <div>
              <div class="font-medium">{{ t('extensions.docs.config') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.configDesc') }}</p>
            </div>
            <div>
              <div class="font-medium">{{ t('extensions.docs.perf') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.perfDesc') }}</p>
            </div>
            <div>
              <div class="font-medium">{{ t('extensions.docs.utf8') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.utf8Desc') }}</p>
              <pre class="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto leading-relaxed"><code># Python
import sys
sys.stdout.reconfigure(encoding='utf-8')

# PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Bash
export LANG='zh_CN.UTF-8'</code></pre>
            </div>
            <div>
              <div class="font-medium">{{ t('extensions.docs.globalVars') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.globalVarsDesc') }}</p>
              <pre class="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto leading-relaxed"><code>global_vars:
  - name: pscript
    type: echo
    params:
      echo: |
        fruits = ["apple", "banana", "cherry"]
        for x in fruits:
            print(x)

matches:
  - trigger: :test
    replace: "{{output}}"
    vars:
      - name: output
        type: script
        params:
          args: [python, -c, "{{pscript}}"]</code></pre>
            </div>
            <div>
              <div class="font-medium">{{ t('extensions.docs.anchors') }}</div>
              <p class="text-muted-foreground mt-1">{{ t('extensions.docs.anchorsDesc') }}</p>
              <pre class="mt-2 p-3 rounded-md bg-muted text-xs overflow-x-auto leading-relaxed"><code>anchors:
  script1: &amp;script1 |
    print("hello")

matches:
  - trigger: :testt
    replace: "{{output}}"
    vars:
      - name: output
        type: script
        params:
          args: [python, -c, *script1]</code></pre>
            </div>
          </div>
        </details>
        </div>
        </div>
      </section>
  </div>
</template>

<style scoped>
.ext-list-pane {
  width: var(--easy-middle-pane-width, 350px);
  min-width: var(--easy-middle-pane-width, 350px);
}
</style>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import {
  TerminalIcon,
  FileCodeIcon,
  GlobeIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  ChevronDownIcon,
} from 'lucide-vue-next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import * as platformService from '@/services/platformService';
import ExtensionContextMenu, { type ExtensionMenuAction } from '@/components/ExtensionContextMenu.vue';
import { useContextMenu } from '@/hooks/useContextMenu';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useEspansoStore } from '../store/useEspansoStore';
import { useUserPreferences } from '../store/useUserPreferences';
import type { Match } from '../types/core/espanso.types';

const { t } = useI18n();
const store = useEspansoStore();
const userPreferences = useUserPreferences();
const route = useRoute();

// 四个路由共用本组件：/shell、/scripts、/web、/folders
type ExtType = 'shell' | 'script' | 'web' | 'folder';
const extType = computed<ExtType>(() => (route.meta.extType as ExtType) ?? 'shell');
const isShell = computed(() => extType.value === 'shell');
const isScript = computed(() => extType.value === 'script');
const isWeb = computed(() => extType.value === 'web');
const isFolder = computed(() => extType.value === 'folder');
const isOpenType = computed(() => isWeb.value || isFolder.value);
const extTypeLabel = computed(() =>
  isShell.value ? t('extensions.shellTitle')
    : isScript.value ? t('extensions.scriptTitle')
      : isWeb.value ? t('extensions.webTitle')
        : t('extensions.folderTitle'),
);
const typeIcon = computed(() =>
  isShell.value ? TerminalIcon
    : isScript.value ? FileCodeIcon
      : isWeb.value ? GlobeIcon
        : FolderIcon,
);

// 文件夹页：调用系统目录选择器
async function browseFolder() {
  try {
    const sel = await openDialog({ directory: true, multiple: false, title: t('extensions.form.browse') });
    if (typeof sel === 'string' && sel) form.value.target = sel;
  } catch {
    // 用户取消或对话框不可用
  }
}

// ==================== 常用解释程序下拉 ====================
// 值会写进 program 字段；用户仍可手动输入任意命令
const COMMON_RUNNERS: { value: string; hint: string }[] = [
  { value: 'python', hint: '.py' },
  { value: 'python3', hint: '.py' },
  { value: 'py', hint: '.py (Windows)' },
  { value: 'pwsh', hint: '.ps1' },
  { value: 'powershell', hint: '.ps1' },
  { value: 'cmd', hint: '.bat / .cmd' },
  { value: 'bash', hint: '.sh' },
  { value: 'sh', hint: '.sh' },
  { value: 'node', hint: '.js / .mjs' },
  { value: 'deno', hint: '.ts / .js' },
  { value: 'ruby', hint: '.rb' },
  { value: 'perl', hint: '.pl' },
  { value: 'php', hint: '.php' },
  { value: 'lua', hint: '.lua' },
];

const programMenuRoot = ref<HTMLElement | null>(null);
const programMenuOpen = ref(false);

// 输入内容过滤：只显示与当前输入匹配的常用项；为空则全列出
const filteredRunners = computed(() => {
  const q = form.value.program.trim().toLowerCase();
  if (!q) return COMMON_RUNNERS;
  return COMMON_RUNNERS.filter(
    (r) => r.value.toLowerCase().includes(q) || r.hint.toLowerCase().includes(q),
  );
});

function toggleProgramMenu() {
  programMenuOpen.value = !programMenuOpen.value;
}

function pickProgram(value: string) {
  form.value.program = value;
  programMenuOpen.value = false;
}

// 点击组件外部时关闭下拉
function onProgramMenuPointerDown(e: PointerEvent) {
  if (!programMenuRoot.value?.contains(e.target as Node)) {
    programMenuOpen.value = false;
  }
}

// 仅在菜单打开期间挂全局监听，避免关闭状态下每次 pointerdown 都做命中判断
watch(programMenuOpen, (open) => {
  if (open) document.addEventListener('pointerdown', onProgramMenuPointerDown);
  else document.removeEventListener('pointerdown', onProgramMenuPointerDown);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onProgramMenuPointerDown);
});

// ==================== 脚本文件浏览 ====================
// 选择脚本文件；位于 espanso 配置目录内时自动写成 %CONFIG%/… 相对形式
async function browseScriptFile() {
  try {
    const configRoot = store.state.configRootDir;
    let defaultDir: string | undefined;
    if (configRoot) {
      // 优先默认到配置目录的 scripts 子目录（若已存在）
      const scriptsDir = await platformService.joinPath(configRoot, 'scripts');
      if (await platformService.directoryExists(scriptsDir)) defaultDir = scriptsDir;
      else defaultDir = configRoot;
    }
    const sel = await openDialog({
      directory: false,
      multiple: false,
      title: t('extensions.form.browse'),
      defaultPath: defaultDir,
      filters: [
        {
          name: t('extensions.form.scriptFiles'),
          extensions: ['py', 'pyw', 'ps1', 'bat', 'cmd', 'sh', 'bash', 'zsh', 'js', 'mjs', 'cjs', 'ts', 'rb', 'pl', 'php', 'lua'],
        },
      ],
    });
    if (typeof sel === 'string' && sel) {
      form.value.scriptPath = toConfigRelativePath(sel, configRoot);
    }
  } catch {
    // 用户取消或对话框不可用
  }
}

// 绝对路径 → %CONFIG%/相对路径（仅当位于配置目录内），否则原样返回（统一为 / 分隔）
function toConfigRelativePath(absPath: string, configRoot: string | null | undefined): string {
  if (!configRoot) return absPath;
  const norm = (p: string) => p.replace(/[\\/]+/g, '/').replace(/\/+$/, '');
  const root = norm(configRoot);
  const file = norm(absPath);
  if (!file || file === root) return absPath;
  const lowerRoot = root.toLowerCase();
  const lowerFile = file.toLowerCase();
  if (lowerFile.startsWith(lowerRoot + '/')) {
    const rel = file.slice(root.length).replace(/^\/+/, '');
    return `%CONFIG%/${rel}`;
  }
  return absPath;
}

// 识别"打开网页/打开文件夹"类片段：shell 变量的 cmd 以 start ""/explorer/Start-Process 开头
function detectOpenKind(m: Match): 'web' | 'folder' | null {
  const v: any = (m.vars || []).find((x: any) => x && x.type === 'shell');
  if (!v) return null;
  const cmd = String(v.params?.cmd ?? '').trim();
  if (/^start\s+""\s+"/i.test(cmd)) return 'web';
  if (/^explorer\s+"/i.test(cmd)) return 'folder';
  const sp = cmd.match(/^Start-Process\s+(.+)$/);
  if (sp) {
    // 网址 → 网页；其余路径 → 文件夹
    const target = sp[1].trim().replace(/^['"]|['"]$/g, '');
    return /^https?:\/\//i.test(target) || /^www\./i.test(target) ? 'web' : 'folder';
  }
  return null;
}

// ==================== 列表 ====================
interface ListItem {
  id: string;
  trigger: string;
  extraTriggers: number;
  label: string;
  filePath: string;
  fileBase: string;
  match: Match;
}

const listItems = computed<ListItem[]>(() =>
  (store.allMatches || [])
    .filter((m) => {
      if (isWeb.value) return detectOpenKind(m) === 'web';
      if (isFolder.value) return detectOpenKind(m) === 'folder';
      // 命令行/脚本页排除"打开网页/文件夹"类片段
      return (m.vars || []).some((v: any) => v && v.type === extType.value) && !detectOpenKind(m);
    })
    .map((m) => {
      const triggerList = m.triggers && m.triggers.length ? m.triggers : [m.trigger || ''];
      return {
        id: m.id,
        trigger: triggerList[0] || '',
        extraTriggers: triggerList.length - 1,
        label: m.label || '',
        filePath: m.filePath || '',
        fileBase: (m.filePath || '').split(/[\\/]/).pop() || '',
        match: m,
      };
    }).sort((a, b) => {
      const sort = userPreferences.preferences.extensionSort;
      return sort === 'source' ? 0 : (sort === 'trigger' ? a.trigger.localeCompare(b.trigger) : a.label.localeCompare(b.label));
    }),
);

// configTree 中的 match 文件，用于"保存到"选择
const matchFiles = computed<{ id: string; path: string }[]>(() => {
  const out: { id: string; path: string }[] = [];
  const walk = (nodes: any[] | undefined) => {
    (nodes || []).forEach((n) => {
      if (n.type === 'file' && n.fileType === 'match' && n.path) {
        out.push({ id: n.id, path: n.path });
      } else if (n.type === 'folder' && n.children) {
        walk(n.children);
      }
    });
  };
  walk(store.state.configTree as any);
  return out;
});

// ==================== 表单 ====================
interface ExtFormState {
  trigger: string;
  label: string;
  replace: string;
  varName: string;
  // shell
  cmd: string;
  shellChoice: string;
  trim: boolean;
  // script
  mode: 'file' | 'inline';
  program: string;
  scriptPath: string;
  extraArgs: string;
  inlineCode: string;
  // web / folder
  target: string;
  // 新建时的目标文件节点 id
  targetFileId: string;
}

const emptyForm = (): ExtFormState => ({
  trigger: '',
  label: '',
  replace: '{{output}}',
  varName: 'output',
  cmd: '',
  shellChoice: 'default',
  trim: true,
  mode: 'file',
  program: 'python',
  scriptPath: '',
  extraArgs: '',
  inlineCode: '',
  target: '',
  targetFileId: '',
});

const form = ref<ExtFormState>(emptyForm());
const isCreating = ref(false);
const editingId = ref<string | null>(null);
const hasEditedAnyField = ref(false);
const confirmingDelete = ref(false);
let deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let savePromise: Promise<boolean> | null = null;
let savedForm = '';

function clearAutoSaveTimer() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
}

function setForm(value: ExtFormState) {
  clearAutoSaveTimer();
  form.value = value;
  savedForm = JSON.stringify(value);
}

const editingItem = computed(() =>
  editingId.value ? listItems.value.find((i) => i.id === editingId.value)?.match ?? null : null,
);

const varNameError = computed(() => !/^[A-Za-z0-9_]+$/.test(form.value.varName || ''));

const replaceHint = computed(() =>
  t('extensions.form.replaceHint', { varName: `{{${form.value.varName || 'output'}}}` }),
);

// 网页/文件夹参考文档里实时展示生成的 YAML（整段放在计算属性里，避免模板花括号转义问题）
const openYamlPreview = computed(() => {
  const lines = triggerLines.value;
  const varName = form.value.varName || 'output';
  const built = buildOpenVar(form.value);
  const cmd = String(built.params?.cmd ?? '');
  const triggerPart = lines.length > 1
    ? `triggers: [${lines.join(', ')}]`
    : `trigger: ${lines[0] ?? ':yt'}`;
  return [
    `- ${triggerPart}`,
    `  replace: "{{${varName}}}"`,
    '  vars:',
    `    - name: ${varName}`,
    '      type: shell',
    '      params:',
    `        shell: ${built.params?.shell}`,
    `        cmd: ${cmd}`,
  ].join('\n');
});

// 多行触发词：每行一个（映射到 espanso 的 triggers 列表）
const triggerLines = computed(() =>
  form.value.trigger.split('\n').map((s) => s.trim()).filter(Boolean),
);

// 右栏标题（同片段页：编辑片段 + 触发词副标题）
const paneTitle = computed(() => {
  if (isCreating.value) return t('extensions.form.newTitle', { type: extTypeLabel.value });
  if (editingItem.value) return t('extensions.form.editTitle', { type: extTypeLabel.value });
  return extTypeLabel.value;
});
const currentTrigger = computed(() => {
  if (isCreating.value) return form.value.trigger.trim();
  return editingItem.value?.trigger || '';
});

// 列表项第二行：命令/脚本内容预览
function previewOf(m: Match): string {
  const vars: any[] = (m.vars || []) as any[];
  // 网页/文件夹：直接展示打开的目标
  if (isOpenType.value) {
    const v: any = vars.find((x) => x && x.type === 'shell') ?? {};
    const cmd = String(v.params?.cmd ?? '');
    const m2 = cmd.match(/^start\s+""\s+"(.*)"$/i)
      ?? cmd.match(/^explorer\s+"(.*)"$/i)
      ?? cmd.match(/^Start-Process\s+'(.*)'$/)
      ?? cmd.match(/^Start-Process\s+"(.*)"$/);
    return m2?.[1] || cmd || '-';
  }
  const v = vars.find((x) => x && x.type === extType.value) ?? {};
  const p = v.params || {};
  if (isShell.value) {
    return String(p.cmd ?? '').split('\n')[0] || '-';
  }
  const args: string[] = Array.isArray(p.args) ? p.args.map(String) : [];
  if (args.length >= 2 && args[1] === '-c') {
    return `${args[0]} -c ${args.slice(2).join(' ').split('\n')[0]}`;
  }
  return args.join(' ') || '-';
}

// 变量名变化时，同步"替换内容"里对旧变量名的引用
watch(
  () => form.value.varName,
  (name, oldName) => {
    const oldRef = `{{${oldName}}}`;
    if (form.value.replace.trim() === oldRef && name) {
      form.value.replace = `{{${name}}}`;
    }
  },
);

// 输入过任何字段后不再自动套模板视图（避免打断编辑）
watch(form, () => {
  if (JSON.stringify(form.value) === savedForm) return;
  hasEditedAnyField.value = true;
  if ((!isCreating.value && !editingId.value) || !userPreferences.preferences.autoSave) return;
  clearAutoSaveTimer();
  if (JSON.stringify(form.value) !== savedForm && !validate() && !varNameError.value) {
    autoSaveTimer = setTimeout(() => { void saveCurrent(false); }, userPreferences.preferences.extensionAutoSaveDelay);
  }
}, { deep: true });

// 路由复用同一个组件；离开前提交旧页面的数据，避免用新页面类型构造变量。
onBeforeRouteUpdate(async () => await saveCurrent(false, true));
onBeforeRouteLeave(async () => await saveCurrent(false, true));
onBeforeUnmount(clearAutoSaveTimer);

// 切换页面（shell <-> script）时重置状态；两个路由共用组件
watch(extType, () => {
  isCreating.value = false;
  editingId.value = null;
  setForm(emptyForm());
  hasEditedAnyField.value = false;
  // 解释器下拉只在脚本页存在，切页后组件不卸载，需一并收起
  programMenuOpen.value = false;
});

async function selectItem(item: ListItem) {
  if (editingId.value === item.id && !isCreating.value) return;
  if (!await saveCurrent(false, true)) return;
  isCreating.value = false;
  confirmingDelete.value = false;
  editingId.value = item.id;
  setForm(formFromMatch(item.match));
}

const menuTarget = ref<ListItem | null>(null);
const menuActions = useContextMenu({ getNode: () => {
  const item = menuTarget.value;
  if (!item) return null;
  const match = store.allMatches.find(m => m.id === item.id) || item.match;
  return { id: item.id, type: 'match', name: item.trigger, children: [], match };
} });

async function handleMenuAction(item: ListItem, action: ExtensionMenuAction) {
  // Flush the editor before clipboard or destructive operations; invalid edits keep the current selection.
  if (!await saveCurrent(false, true)) return;
  menuTarget.value = item;
  try {
    if (action === 'new') { await startCreate(); return; }
    if (action === 'edit') { await selectItem(item); return; }
    if (action === 'copy') { menuActions.handleCopyItem(); return; }
    if (action === 'cut') { menuActions.handleCutItem(); return; }
    if (action === 'path') { await menuActions.handleCopyNodePath(); return; }
    if (action === 'paste') {
      await menuActions.handlePasteItem();
      const selected = listItems.value.find(m => m.id === editingId.value);
      if (selected) setForm(formFromMatch(selected.match));
      else if (editingId.value) await cancelEdit();
      return;
    }
    if (action === 'delete') {
      await selectItem(item);
      if (editingId.value !== item.id) return;
      if (userPreferences.preferences.confirmBeforeDelete) {
        const result = await platformService.showMessageBox({ type: 'question', title: t('extensions.form.delete'), message: t('extensionMenu.confirm', { trigger: item.trigger }), buttons: [t('common.cancel'), t('extensions.form.delete')], defaultId: 0, cancelId: 0 });
        if (result.response !== 1) return;
      }
      await removeSelected();
    }
  } catch (error) { toast.error(String(error)); }
}

watch(() => userPreferences.preferences.autoSave, enabled => {
  clearAutoSaveTimer();
  if (enabled && JSON.stringify(form.value) !== savedForm && !validate()) {
    autoSaveTimer = setTimeout(() => { void saveCurrent(false); }, userPreferences.preferences.extensionAutoSaveDelay);
  }
});

async function startCreate() {
  if (!await saveCurrent(false, true)) return;
  editingId.value = null;
  isCreating.value = true;
  confirmingDelete.value = false;
  const nextForm = emptyForm();
  if (matchFiles.value.length) {
    const base = matchFiles.value.find((f) => /base\.ya?ml$/i.test(f.path));
    nextForm.targetFileId = (base ?? matchFiles.value[0]).id;
  }
  setForm(nextForm);
  hasEditedAnyField.value = false;
}

async function cancelEdit() {
  clearAutoSaveTimer();
  if (savePromise) await savePromise;
  isCreating.value = false;
  editingId.value = null;
  confirmingDelete.value = false;
  setForm(emptyForm());
}

function formFromMatch(m: Match): ExtFormState {
  const f = emptyForm();
  // 多触发词以换行展示（每行一个）
  const triggerList = m.triggers && m.triggers.length ? m.triggers : (m.trigger ? [m.trigger] : []);
  f.trigger = triggerList.join('\n');
  f.label = m.label || '';
  f.replace = m.replace || '{{output}}';

  const vars: any[] = (m.vars || []) as any[];

  // 网页/文件夹：从 shell 变量的 cmd 里反解目标
  if (isOpenType.value) {
    const v: any = vars.find((x) => x && x.type === 'shell') ?? {};
    f.varName = v.name || 'output';
    const cmd = String(v.params?.cmd ?? '').trim();
    const m2 = cmd.match(/^start\s+""\s+"(.*)"$/i)
      ?? cmd.match(/^explorer\s+"(.*)"$/i)
      ?? cmd.match(/^Start-Process\s+'(.*)'$/)
      ?? cmd.match(/^Start-Process\s+"(.*)"$/);
    f.target = m2?.[1] ?? '';
    return f;
  }

  const v = vars.find((x) => x && x.type === extType.value) ?? vars[0] ?? {};
  f.varName = v.name || 'output';
  const params = v.params || {};

  if (isShell.value) {
    f.cmd = typeof params.cmd === 'string' ? params.cmd : '';
    f.shellChoice = typeof params.shell === 'string' ? params.shell : 'default';
    f.trim = params.trim !== false;
  } else {
    const args: string[] = Array.isArray(params.args) ? params.args.map(String) : [];
    if (args.length >= 2 && args[1] === '-c') {
      f.mode = 'inline';
      f.program = args[0] || 'python';
      f.inlineCode = args.slice(2).join('\n');
    } else {
      f.mode = 'file';
      f.program = args[0] || 'python';
      f.scriptPath = args[1] || '';
      f.extraArgs = args.slice(2).join('\n');
    }
  }
  return f;
}

// ==================== 模板 ====================
interface TemplateDef {
  key: string;
  nameKey: string;
  descKey: string;
  preview: string;
  apply: (f: ExtFormState) => void;
}

const templates = computed<TemplateDef[]>(() => {
  if (isWeb.value) {
    return [
      {
        key: 'youtube',
        nameKey: 'extensions.templates.youtube',
        descKey: 'extensions.templates.youtubeDesc',
        preview: ':yt',
        apply: (f) => {
          f.trigger = ':yt';
          f.label = t('extensions.templates.youtube');
          f.target = 'https://www.youtube.com/';
        },
      },
      {
        key: 'bilibili',
        nameKey: 'extensions.templates.bilibili',
        descKey: 'extensions.templates.bilibiliDesc',
        preview: ':bili',
        apply: (f) => {
          f.trigger = ':bili';
          f.label = t('extensions.templates.bilibili');
          f.target = 'https://www.bilibili.com/';
        },
      },
      {
        key: 'github',
        nameKey: 'extensions.templates.github',
        descKey: 'extensions.templates.githubDesc',
        preview: ':gh',
        apply: (f) => {
          f.trigger = ':gh';
          f.label = t('extensions.templates.github');
          f.target = 'https://github.com/';
        },
      },
    ];
  }
  if (isFolder.value) {
    return [
      {
        key: 'downloads',
        nameKey: 'extensions.templates.downloads',
        descKey: 'extensions.templates.downloadsDesc',
        preview: ':dl',
        apply: (f) => {
          f.trigger = ':dl';
          f.label = t('extensions.templates.downloads');
          f.target = '%USERPROFILE%\\Downloads';
        },
      },
      {
        key: 'desktop',
        nameKey: 'extensions.templates.desktop',
        descKey: 'extensions.templates.desktopDesc',
        preview: ':desk',
        apply: (f) => {
          f.trigger = ':desk';
          f.label = t('extensions.templates.desktop');
          f.target = '%USERPROFILE%\\Desktop';
        },
      },
    ];
  }
  if (isShell.value) {
    return [
      {
        key: 'ip',
        nameKey: 'extensions.templates.ip',
        descKey: 'extensions.templates.ipDesc',
        preview: ':ip',
        apply: (f) => {
          f.trigger = ':ip';
          f.label = t('extensions.templates.ip');
          f.cmd = "curl 'https://api.ipify.org'";
        },
      },
      {
        key: 'psTime',
        nameKey: 'extensions.templates.psTime',
        descKey: 'extensions.templates.psTimeDesc',
        preview: ':now',
        apply: (f) => {
          f.trigger = ':now';
          f.label = t('extensions.templates.psTime');
          f.shellChoice = 'powershell';
          f.cmd = 'Get-Date -Format "yyyy-MM-dd HH:mm:ss"';
        },
      },
    ];
  }
  return [
    {
      key: 'pyInline',
      nameKey: 'extensions.templates.pyInline',
      descKey: 'extensions.templates.pyInlineDesc',
      preview: ':pyscript',
      apply: (f) => {
        f.trigger = ':pyscript';
        f.mode = 'inline';
        f.program = 'python';
        f.inlineCode = 'fruits = ["apple", "banana", "cherry"]\nfor x in fruits:\n    print(x)';
      },
    },
    {
      key: 'pyFile',
      nameKey: 'extensions.templates.pyFile',
      descKey: 'extensions.templates.pyFileDesc',
      preview: ':pyscript',
      apply: (f) => {
        f.trigger = ':pyscript';
        f.mode = 'file';
        f.program = 'python';
        f.scriptPath = '%CONFIG%/scripts/script.py';
      },
    },
  ];
});

function applyTemplate(tpl: TemplateDef) {
  if (!isCreating.value) startCreate();
  tpl.apply(form.value);
}

// ==================== 保存/删除 ====================
// %VAR% → $env:VAR（espanso 的 powershell 扩展不展开 cmd 风格环境变量）
function toPsPath(path: string): string {
  return path.replace(/%([^%]+)%/g, (_, name) => `$env:${name}`);
}

function buildOpenVar(f: ExtFormState): Record<string, any> {
  // 去掉内嵌引号与结尾反斜杠，避免破坏引号配对（如 D:\ → \" 转义问题）
  let target = f.target.trim().replace(/"+/g, '').replace(/[\\]+$/, '');
  let quoted: string;
  if (/%([^%]+)%/.test(target)) {
    // 含环境变量的路径用双引号，PowerShell 运行时展开；路径含空格也安全
    quoted = `"${toPsPath(target)}"`;
  } else {
    quoted = `'${target}'`;
  }
  // Start-Process 立即返回且由系统默认程序处理网址/文件夹，不会像 start 那样阻塞 shell 扩展
  return { name: f.varName, type: 'shell', params: { shell: 'powershell', cmd: `Start-Process ${quoted}` } };
}

function buildVar(f: ExtFormState = form.value, type: ExtType = extType.value): Record<string, any> {
  if (type === 'web' || type === 'folder') {
    return buildOpenVar(f);
  }
  if (type === 'shell') {
    const params: Record<string, any> = { cmd: f.cmd, trim: f.trim };
    if (f.shellChoice && f.shellChoice !== 'default') params.shell = f.shellChoice;
    return { name: f.varName, type: 'shell', params };
  }
  if (f.mode === 'inline') {
    return { name: f.varName, type: 'script', params: { args: [f.program, '-c', f.inlineCode] } };
  }
  const args = [f.program, f.scriptPath, ...f.extraArgs.split('\n').map((s) => s.trim()).filter(Boolean)];
  return { name: f.varName, type: 'script', params: { args } };
}

function validate(f: ExtFormState = form.value, type: ExtType = extType.value): string | null {
  if (!f.trigger.split('\n').some((s) => s.trim())) return t('extensions.form.required', { field: t('extensions.form.trigger') });
  if (type === 'web' && !f.target.trim()) return t('extensions.form.required', { field: t('extensions.form.url') });
  if (type === 'folder' && !f.target.trim()) return t('extensions.form.required', { field: t('extensions.form.folderPath') });
  if (type === 'shell' && !f.cmd.trim()) return t('extensions.form.required', { field: t('extensions.form.cmd') });
  if (type === 'script') {
    if (!f.program.trim()) return t('extensions.form.required', { field: t('extensions.form.program') });
    if (f.mode === 'file' && !f.scriptPath.trim()) return t('extensions.form.required', { field: t('extensions.form.scriptPath') });
    if (f.mode === 'inline' && !f.inlineCode.trim()) return t('extensions.form.required', { field: t('extensions.form.inlineCode') });
  }
  return null;
}

async function saveCurrent(showToast: boolean, notifyInvalid = false): Promise<boolean> {
  clearAutoSaveTimer();
  if (savePromise) await savePromise;
  const itemId = editingId.value;
  if (!itemId && !isCreating.value) return true;
  if (isCreating.value && !showToast && !form.value.trigger.trim() && !form.value.label.trim()
    && !form.value.target.trim() && !form.value.cmd.trim()
    && !form.value.scriptPath.trim() && !form.value.inlineCode.trim()) return true;
  const snapshot = JSON.stringify(form.value);
  if (!isCreating.value && snapshot === savedForm) return true;
  const data: ExtFormState = JSON.parse(snapshot);
  const type = extType.value;
  const error = validate(data, type);
  if (error || !/^[A-Za-z0-9_]+$/.test(data.varName)) {
    // 不完整的草稿不写盘；显式保存或切换时告知原因。
    if (showToast || notifyInvalid) toast.error(error || t('extensions.form.varNameInvalid'));
    return false;
  }
  const lines = data.trigger.split('\n').map((s) => s.trim()).filter(Boolean);
  savePromise = (async () => {
    try {
      if (isCreating.value) {
        const target = matchFiles.value.find((f) => f.id === data.targetFileId);
        const created = await store.addItem({
          trigger: lines[0], triggers: lines, label: data.label.trim() || undefined,
          description: '', replace: data.replace, contentType: 'plain', word: false,
          propagateCase: false, uppercaseStyle: '', forceMode: '', apps: [], exclude_apps: [],
          search_terms: [], priority: 0, hotkey: '', image_path: '',
          vars: [buildVar(data, type)],
        } as any, 'match', target?.id ?? null, -1, `新建${extTypeLabel.value}`);
        if (!created) {
          toast.error(store.state.error || t('common.error'));
          return false;
        }
        editingId.value = created.id;
        isCreating.value = false;
        hasEditedAnyField.value = false;
      } else if (itemId) {
        await store.updateMatch(itemId, {
          trigger: lines[0], triggers: lines, label: data.label.trim() || undefined,
          replace: data.replace, vars: [buildVar(data, type)],
        } as any);
      }
      savedForm = snapshot;
      if (showToast) toast.success(`${lines[0]} ✓`);
      return true;
    } catch (e: any) {
      toast.error(e?.message || String(e));
      return false;
    }
  })();
  const success = await savePromise;
  savePromise = null;
  if (success && JSON.stringify(form.value) !== savedForm && userPreferences.preferences.autoSave) {
    autoSaveTimer = setTimeout(() => { void saveCurrent(false); }, userPreferences.preferences.extensionAutoSaveDelay);
  }
  return success;
}

async function onSave() {
  await saveCurrent(true);
}

function onDeleteClick() {
  if (!userPreferences.preferences.confirmBeforeDelete) { void removeSelected(); return; }
  if (!confirmingDelete.value) {
    confirmingDelete.value = true;
    if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
    deleteConfirmTimer = setTimeout(() => { confirmingDelete.value = false; }, 3000);
    return;
  }
  confirmingDelete.value = false;
  if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
  removeSelected();
}

async function removeSelected() {
  const item = editingItem.value;
  if (!item) return;
  clearAutoSaveTimer();
  if (savePromise) await savePromise;
  try {
    await store.deleteItem(item.id, 'match');
    toast.success(`${item.trigger} ✓`);
    cancelEdit();
  } catch (e: any) {
    toast.error(e?.message || String(e));
  }
}
</script>
