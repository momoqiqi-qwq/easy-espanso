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
        <SnippetListItem
          v-for="snippet in model"
          :key="snippet.id"
          :trigger="displayTrigger(snippet)"
          :label="snippet.label"
          :secondary="snippet.description || getContentPreview(snippet)"
          :selected="snippet.id === selectedId"
          @select="selectedId = snippet.id"
        />
        <div v-if="!model.length" class="empty-list">还没有专用片段</div>
      </aside>

      <div class="snippet-form">
        <template v-if="selectedSnippet">
          <!-- 直接复用「片段管理」的编辑界面，持久化交给 persistSnippet -->
          <div class="snippet-editor-host">
            <RuleEditForm
              :key="selectedSnippet.id"
              :rule="selectedSnippet"
              :save-handler="persistSnippet"
            />
          </div>
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
import RuleEditForm from '@/components/forms/RuleEditForm.vue';
import SnippetListItem from '@/components/common/SnippetListItem.vue';
import { getContentPreview } from '@/utils/snippetPreview';
import type { Match } from '@/types/core/espanso.types';

const model = defineModel<Match[]>({ required: true });
const selectedId = ref<string | null>(null);

const selectedSnippet = computed(() => model.value.find((item) => item.id === selectedId.value) || null);

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

/**
 * RuleEditForm 的持久化出口。宿主接管后它不再写全局片段树，
 * 我们只把编辑结果合并回 v-model 里的这一条专用片段。
 */
async function persistSnippet(_id: string | number | undefined, data: Partial<Match>) {
  const targetId = selectedId.value;
  if (!targetId) return;
  model.value = model.value.map((item) =>
    item.id === targetId ? { ...item, ...data, id: targetId, type: item.type || 'match' } : item,
  );
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
.editor-body { display: grid; grid-template-columns: 240px minmax(0, 1fr); align-items: stretch; }
.snippet-list { border-right: 1px solid hsl(var(--border)); padding: 12px; overflow: auto; max-height: 560px; background: hsl(var(--muted) / .16); }
.empty-list { padding: 24px 8px; text-align: center; font-size: 12px; color: hsl(var(--muted-foreground)); }
.snippet-form { min-width: 0; height: 560px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
/* RuleEditForm 的底部工具栏是 absolute bottom-0，需要一个定位上下文把它收在编辑器内 */
.snippet-editor-host { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.editor-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex: 0 0 auto; }
.editor-footer small { color: hsl(var(--muted-foreground)); }
.danger { color: hsl(var(--destructive)); }
.empty-editor { flex: 1; min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; color: hsl(var(--muted-foreground)); }
.empty-editor strong { color: hsl(var(--foreground)); font-size: 13px; }
.empty-editor span { font-size: 12px; }
@media (max-width: 760px) {
  .editor-body { grid-template-columns: 1fr; }
  .snippet-list { border-right: 0; border-bottom: 1px solid hsl(var(--border)); max-height: 150px; }
}
</style>
