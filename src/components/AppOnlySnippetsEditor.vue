<template>
  <section class="app-snippet-editor">
    <div class="editor-heading">
      <div>
        <h3>仅此软件可用的片段</h3>
        <p>在这里创建的片段只会在当前应用规则命中时加载，不会作为全局片段启用。</p>
      </div>
      <Button type="button" size="sm" variant="outline" @click="addSnippet">
        <Plus class="w-4 h-4 mr-1" />新建片段
      </Button>
    </div>

    <div class="editor-body">
      <aside class="snippet-list">
        <button
          v-for="snippet in model"
          :key="snippet.id"
          type="button"
          class="snippet-row"
          :class="{ active: snippet.id === selectedId }"
          @click="selectedId = snippet.id"
        >
          <span class="snippet-trigger">{{ displayTrigger(snippet) }}</span>
          <span class="snippet-label">{{ snippet.label || '未命名片段' }}</span>
        </button>
        <div v-if="!model.length" class="empty-list">还没有专用片段</div>
      </aside>

      <div class="snippet-form">
        <template v-if="selectedSnippet">
          <div class="top-fields">
            <label>
              <span>触发词</span>
              <input
                :value="selectedSnippet.trigger || ''"
                placeholder=":example"
                spellcheck="false"
                @input="updateFieldFromEvent('trigger', $event)"
              />
            </label>
            <label>
              <span>名称</span>
              <input
                :value="selectedSnippet.label || ''"
                placeholder="片段名称"
                @input="updateFieldFromEvent('label', $event)"
              />
            </label>
          </div>

          <div class="content-heading">
            <span>替换内容</span>
            <div class="content-tabs" role="tablist" aria-label="内容类型">
              <button
                v-for="option in contentTypes"
                :key="option.value"
                type="button"
                :class="{ active: currentContentType === option.value }"
                @click="setContentType(option.value)"
              >{{ option.label }}</button>
            </div>
          </div>

          <textarea
            class="content-editor"
            :value="currentContent"
            :placeholder="contentPlaceholder"
            spellcheck="false"
            @input="setContentFromEvent"
          ></textarea>

          <div class="editor-footer">
            <small>共 {{ model.length }} 个专用片段</small>
            <Button type="button" size="sm" variant="ghost" class="danger" @click="removeSelected">
              <Trash2 class="w-4 h-4 mr-1" />删除片段
            </Button>
          </div>
        </template>
        <div v-else class="empty-editor">
          <FileText class="w-9 h-9" />
          <strong>新建一个专用片段开始编辑</strong>
          <span>它会保存到 Easy Espanso 管理的应用专用 match 文件中。</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FileText, Plus, Trash2 } from 'lucide-vue-next';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import type { ContentType, Match } from '@/types/core/espanso.types';

const model = defineModel<Match[]>({ required: true });
const selectedId = ref<string | null>(null);

const contentTypes: Array<{ value: ContentType; label: string }> = [
  { value: 'plain', label: '文本' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
  { value: 'image', label: '图片路径' },
  { value: 'form', label: '表单' },
];

const selectedSnippet = computed(() => model.value.find((item) => item.id === selectedId.value) || null);
const currentContentType = computed<ContentType>(() => selectedSnippet.value?.contentType || inferContentType(selectedSnippet.value));
const currentContent = computed(() => readContent(selectedSnippet.value));
const contentPlaceholder = computed(() => {
  if (currentContentType.value === 'image') return '输入图片文件路径…';
  if (currentContentType.value === 'form') return '输入 Espanso 表单定义…';
  return '输入替换内容…';
});

watch(
  () => model.value.map((item) => item.id).join('|'),
  () => {
    if (!model.value.length) {
      selectedId.value = null;
      return;
    }
    if (!selectedId.value || !model.value.some((item) => item.id === selectedId.value)) {
      selectedId.value = model.value[0].id;
    }
  },
  { immediate: true },
);

function inferContentType(snippet: Match | null): ContentType {
  if (!snippet) return 'plain';
  if (snippet.markdown !== undefined) return 'markdown';
  if (snippet.html !== undefined) return 'html';
  if (snippet.image_path !== undefined) return 'image';
  if (snippet.form !== undefined) return 'form';
  return 'plain';
}

function readContent(snippet: Match | null): string {
  if (!snippet) return '';
  if (typeof snippet.content === 'string') return snippet.content;
  switch (snippet.contentType || inferContentType(snippet)) {
    case 'markdown': return String(snippet.markdown ?? '');
    case 'html': return String(snippet.html ?? '');
    case 'image': return String(snippet.image_path ?? '');
    case 'form': return typeof snippet.form === 'string' ? snippet.form : '';
    default: return String(snippet.replace ?? '');
  }
}

function replaceSelected(mutator: (snippet: Match) => Match) {
  const id = selectedId.value;
  if (!id) return;
  model.value = model.value.map((item) => item.id === id ? mutator({ ...item }) : item);
}

function updateField(field: 'trigger' | 'label', value: string) {
  replaceSelected((snippet) => field === 'trigger'
    ? { ...snippet, trigger: value, triggers: undefined }
    : { ...snippet, label: value });
}

function updateFieldFromEvent(field: 'trigger' | 'label', event: Event) {
  updateField(field, (event.target as HTMLInputElement).value);
}

function setContent(value: string) {
  replaceSelected((snippet) => {
    const contentType = snippet.contentType || inferContentType(snippet);
    const next: Match = { ...snippet, contentType, content: value };
    if (contentType === 'plain') next.replace = value;
    if (contentType === 'markdown') next.markdown = value;
    if (contentType === 'html') next.html = value;
    if (contentType === 'image') next.image_path = value;
    if (contentType === 'form') next.form = value;
    return next;
  });
}

function setContentFromEvent(event: Event) {
  setContent((event.target as HTMLTextAreaElement).value);
}

function setContentType(contentType: ContentType) {
  const content = currentContent.value;
  replaceSelected((snippet) => ({ ...snippet, contentType, content }));
}

function addSnippet() {
  const id = uuidv4();
  model.value = [
    ...model.value,
    {
      id,
      type: 'match',
      trigger: ':new',
      label: '新片段',
      replace: '',
      content: '',
      contentType: 'plain',
    },
  ];
  selectedId.value = id;
}

function removeSelected() {
  const id = selectedId.value;
  if (!id) return;
  const index = model.value.findIndex((item) => item.id === id);
  if (index < 0) return;
  model.value = model.value.filter((item) => item.id !== id);
  selectedId.value = model.value[Math.min(index, model.value.length - 1)]?.id || null;
}

function displayTrigger(snippet: Match): string {
  return snippet.trigger || snippet.triggers?.[0] || '（无触发词）';
}
</script>

<style scoped>
.app-snippet-editor {
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  overflow: hidden;
  background: hsl(var(--card));
}
.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / .2);
}
.editor-heading h3 { margin: 0; font-size: 13px; font-weight: 650; }
.editor-heading p { margin: 3px 0 0; font-size: 12px; color: hsl(var(--muted-foreground)); }
.editor-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 350px; }
.snippet-list { border-right: 1px solid hsl(var(--border)); padding: 8px; overflow: auto; max-height: 410px; background: hsl(var(--muted) / .16); }
.snippet-row { width: 100%; text-align: left; display: grid; gap: 2px; padding: 9px 10px; border-radius: 7px; border: 1px solid transparent; }
.snippet-row:hover { background: hsl(var(--accent)); }
.snippet-row.active { border-color: hsl(var(--primary) / .28); background: hsl(var(--primary) / .09); }
.snippet-trigger { font-size: 12px; font-weight: 650; color: hsl(var(--foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snippet-label { font-size: 11px; color: hsl(var(--muted-foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-list { padding: 24px 8px; text-align: center; font-size: 12px; color: hsl(var(--muted-foreground)); }
.snippet-form { min-width: 0; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.top-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.top-fields label { display: grid; gap: 6px; font-size: 12px; font-weight: 550; }
.top-fields input { width: 100%; border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 8px 9px; background: hsl(var(--background)); color: hsl(var(--foreground)); }
.content-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; font-weight: 550; }
.content-tabs { display: flex; border: 1px solid hsl(var(--border)); border-radius: 7px; overflow: hidden; }
.content-tabs button { padding: 5px 8px; font-size: 11px; color: hsl(var(--muted-foreground)); border-left: 1px solid hsl(var(--border)); }
.content-tabs button:first-child { border-left: 0; }
.content-tabs button:hover { background: hsl(var(--accent)); color: hsl(var(--foreground)); }
.content-tabs button.active { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.content-editor { flex: 1; min-height: 210px; width: 100%; resize: vertical; border: 1px solid hsl(var(--border)); border-radius: 8px; padding: 10px; background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.55; }
.content-editor:focus, .top-fields input:focus { outline: none; border-color: hsl(var(--primary)); box-shadow: 0 0 0 2px hsl(var(--primary) / .12); }
.editor-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.editor-footer small { color: hsl(var(--muted-foreground)); }
.danger { color: hsl(var(--destructive)); }
.empty-editor { flex: 1; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; color: hsl(var(--muted-foreground)); }
.empty-editor strong { color: hsl(var(--foreground)); font-size: 13px; }
.empty-editor span { font-size: 12px; }
@media (max-width: 760px) {
  .editor-body { grid-template-columns: 1fr; }
  .snippet-list { border-right: 0; border-bottom: 1px solid hsl(var(--border)); max-height: 150px; }
  .top-fields { grid-template-columns: 1fr; }
  .content-heading { align-items: flex-start; flex-direction: column; }
  .content-tabs { flex-wrap: wrap; }
}
</style>
