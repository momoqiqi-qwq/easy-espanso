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

      <div class="flex-1 overflow-y-auto middle-pane-scrollbar p-3">
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

        <!-- 列表项（片段列表卡片同款样式） -->
        <template v-else>
        <div v-for="item in listItems" :key="item.id"
          :class="[
            'group cursor-pointer border-l-2 rounded-md mb-2.5 transition-all bg-card shadow-xs border border-border/30',
            item.id === editingId && !isCreating
              ? 'border-l-primary shadow-sm bg-accent/10 border-primary/20'
              : 'border-l-transparent hover:border-l-primary/40 hover:shadow-sm hover:bg-accent/5 hover:border-border/60'
          ]"
          @click="selectItem(item)">
          <div class="py-2.5 px-3">
            <div class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm font-medium m-0"
                    :class="item.id === editingId && !isCreating ? 'text-primary' : 'text-foreground'">
                    {{ item.trigger }}
                  </h3>
                  <div v-if="item.label" class="text-xs px-1.5 rounded truncate max-w-[120px]"
                    :class="item.id === editingId && !isCreating
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'">
                    {{ item.label }}
                  </div>
                </div>
                <div class="text-xs truncate"
                  :class="item.id === editingId && !isCreating ? 'text-foreground/90' : 'text-muted-foreground'">
                  {{ previewOf(item.match) }}
                </div>
              </div>
              <div class="flex gap-1 flex-shrink-0">
                <Badge variant="outline" class="text-xs border-0 bg-muted/50 px-1.5 py-0 whitespace-nowrap">
                  {{ item.fileBase }}
                </Badge>
              </div>
            </div>
          </div>
        </div>
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
                <Input id="ext-trigger" v-model="form.trigger" :placeholder="t('extensions.form.triggerPlaceholder')" />
                <p class="text-xs text-muted-foreground">{{ t('extensions.form.triggerHint') }}</p>
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
                <Input id="ext-program" v-model="form.program" :placeholder="t('extensions.form.programPlaceholder')" />
              </div>
              <div v-if="form.mode === 'file'" class="space-y-1.5 md:col-span-2">
                <Label for="ext-path">{{ t('extensions.form.scriptPath') }} *</Label>
                <Input id="ext-path" v-model="form.scriptPath" :placeholder="t('extensions.form.scriptPathPlaceholder')" />
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
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
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
} from 'lucide-vue-next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
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
import type { Match } from '../types/core/espanso.types';

const { t } = useI18n();
const store = useEspansoStore();
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

// 识别"打开网页/打开文件夹"类片段：shell 变量的 cmd 以 start ""/explorer 开头
function detectOpenKind(m: Match): 'web' | 'folder' | null {
  const v: any = (m.vars || []).find((x: any) => x && x.type === 'shell');
  if (!v) return null;
  const cmd = String(v.params?.cmd ?? '').trim();
  if (/^start\s+""\s+"/i.test(cmd)) return 'web';
  if (/^explorer\s+"/i.test(cmd)) return 'folder';
  return null;
}

// ==================== 列表 ====================
interface ListItem {
  id: string;
  trigger: string;
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
    .map((m) => ({
      id: m.id,
      trigger: m.trigger || (m.triggers ? m.triggers[0] : '') || '',
      label: m.label || '',
      filePath: m.filePath || '',
      fileBase: (m.filePath || '').split(/[\\/]/).pop() || '',
      match: m,
    })),
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

const editingItem = computed(() =>
  editingId.value ? listItems.value.find((i) => i.id === editingId.value)?.match ?? null : null,
);

const varNameError = computed(() => !/^[A-Za-z0-9_]+$/.test(form.value.varName || ''));

const replaceHint = computed(() =>
  t('extensions.form.replaceHint', { varName: `{{${form.value.varName || 'output'}}}` }),
);

// 网页/文件夹参考文档里实时展示生成的 YAML（整段放在计算属性里，避免模板花括号转义问题）
const openYamlPreview = computed(() => {
  const trigger = form.value.trigger || (isWeb.value ? ':yt' : ':dl');
  const varName = form.value.varName || 'output';
  const cmd = isWeb.value
    ? `start "" "${form.value.target || 'https://www.youtube.com/'}"`
    : `explorer "${form.value.target || '%USERPROFILE%\\Downloads'}"`;
  return [
    `- trigger: ${trigger}`,
    `  replace: "{{${varName}}}"`,
    '  vars:',
    `    - name: ${varName}`,
    '      type: shell',
    '      params:',
    '        shell: cmd',
    `        cmd: ${cmd}`,
  ].join('\n');
});

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
    const m2 = cmd.match(/^start\s+""\s+"(.*)"$/i) ?? cmd.match(/^explorer\s+"(.*)"$/i);
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
watch(form, () => { hasEditedAnyField.value = true; }, { deep: true });

// 切换页面（shell <-> script）时重置状态；两个路由共用组件
watch(extType, () => {
  isCreating.value = false;
  editingId.value = null;
  form.value = emptyForm();
  hasEditedAnyField.value = false;
});

function selectItem(item: ListItem) {
  isCreating.value = false;
  confirmingDelete.value = false;
  editingId.value = item.id;
  form.value = formFromMatch(item.match);
}

function startCreate() {
  editingId.value = null;
  isCreating.value = true;
  hasEditedAnyField.value = false;
  confirmingDelete.value = false;
  form.value = emptyForm();
  if (matchFiles.value.length) {
    const base = matchFiles.value.find((f) => /base\.ya?ml$/i.test(f.path));
    form.value.targetFileId = (base ?? matchFiles.value[0]).id;
  }
}

function cancelEdit() {
  isCreating.value = false;
  editingId.value = null;
  confirmingDelete.value = false;
  form.value = emptyForm();
}

function formFromMatch(m: Match): ExtFormState {
  const f = emptyForm();
  f.trigger = m.trigger || (m.triggers ? m.triggers[0] : '') || '';
  f.label = m.label || '';
  f.replace = m.replace || '{{output}}';

  const vars: any[] = (m.vars || []) as any[];

  // 网页/文件夹：从 shell 变量的 cmd 里反解目标
  if (isOpenType.value) {
    const v: any = vars.find((x) => x && x.type === 'shell') ?? {};
    f.varName = v.name || 'output';
    const cmd = String(v.params?.cmd ?? '').trim();
    const webMatch = cmd.match(/^start\s+""\s+"(.*)"$/i);
    const folderMatch = cmd.match(/^explorer\s+"(.*)"$/i);
    f.target = webMatch?.[1] ?? folderMatch?.[1] ?? '';
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
function buildVar(): Record<string, any> {
  const f = form.value;
  if (isWeb.value) {
    // 去掉内嵌引号与结尾反斜杠，避免破坏 cmd 引号配对（如 D:\ → \" 转义问题）
    const target = f.target.trim().replace(/"+/g, '').replace(/[\\]+$/, '');
    return { name: f.varName, type: 'shell', params: { shell: 'cmd', cmd: `start "" "${target}"` } };
  }
  if (isFolder.value) {
    const target = f.target.trim().replace(/"+/g, '').replace(/[\\]+$/, '');
    return { name: f.varName, type: 'shell', params: { shell: 'cmd', cmd: `explorer "${target}"` } };
  }
  if (isShell.value) {
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

function validate(): string | null {
  const f = form.value;
  if (!f.trigger.trim()) return t('extensions.form.required', { field: t('extensions.form.trigger') });
  if (isWeb.value && !f.target.trim()) return t('extensions.form.required', { field: t('extensions.form.url') });
  if (isFolder.value && !f.target.trim()) return t('extensions.form.required', { field: t('extensions.form.folderPath') });
  if (isShell.value && !f.cmd.trim()) return t('extensions.form.required', { field: t('extensions.form.cmd') });
  if (isScript.value) {
    if (!f.program.trim()) return t('extensions.form.required', { field: t('extensions.form.program') });
    if (f.mode === 'file' && !f.scriptPath.trim()) return t('extensions.form.required', { field: t('extensions.form.scriptPath') });
    if (f.mode === 'inline' && !f.inlineCode.trim()) return t('extensions.form.required', { field: t('extensions.form.inlineCode') });
  }
  return null;
}

async function onSave() {
  const err = validate();
  if (err) {
    toast.error(err);
    return;
  }
  try {
    if (!isCreating.value && editingItem.value) {
      await store.updateMatch(editingItem.value.id, {
        trigger: form.value.trigger.trim(),
        label: form.value.label.trim() || undefined,
        replace: form.value.replace,
        vars: [buildVar()],
      } as any);
      toast.success(`${form.value.trigger.trim()} ✓`);
      form.value = formFromMatch(editingItem.value.match);
    } else {
      const target = matchFiles.value.find((f) => f.id === form.value.targetFileId);
      const created = await store.addItem(
        {
          trigger: form.value.trigger.trim(),
          triggers: [],
          label: form.value.label.trim() || undefined,
          description: '',
          replace: form.value.replace,
          contentType: 'plain',
          word: false,
          propagateCase: false,
          uppercaseStyle: '',
          forceMode: '',
          apps: [],
          exclude_apps: [],
          search_terms: [],
          priority: 0,
          hotkey: '',
          image_path: '',
          vars: [buildVar()],
        } as any,
        'match',
        target?.id ?? null,
        -1,
        isShell.value ? '新建命令行扩展' : '新建脚本扩展',
      );
      if (created) {
        toast.success(`${form.value.trigger.trim()} ✓`);
        isCreating.value = false;
        hasEditedAnyField.value = false;
        editingId.value = created.id;
        form.value = formFromMatch(created);
      }
    }
  } catch (e: any) {
    toast.error(e?.message || String(e));
  }
}

function onDeleteClick() {
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
  try {
    await store.deleteItem(item.id, 'match');
    toast.success(`${item.trigger} ✓`);
    cancelEdit();
  } catch (e: any) {
    toast.error(e?.message || String(e));
  }
}
</script>
