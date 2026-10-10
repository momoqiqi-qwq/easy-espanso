<template>
  <div class="flex flex-wrap items-center gap-2 border-b pb-3 text-sm">
    <ListChecks class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    <span class="font-medium">{{ t('choices.title') }}</span>
    <span class="text-muted-foreground">{{ t('choices.count', { count: variantsCount }) }}</span>
    <Button type="button" size="sm" variant="outline" class="ml-auto h-7" :disabled="busy" @mousedown.prevent @click="openEditor('edit')">
      {{ t('choices.edit') }}
    </Button>
    <Button type="button" size="sm" variant="ghost" class="h-7" :disabled="busy" @mousedown.prevent @click="openEditor('add')">
      <Plus class="mr-1 h-3.5 w-3.5" aria-hidden="true" />{{ t('choices.add') }}
    </Button>
  </div>

  <Dialog :open="open" @update:open="requestOpenChange">
    <DialogContent class="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl" @keydown="onShortcut" @interact-outside.prevent>
      <DialogHeader class="shrink-0 border-b px-6 py-4 pr-12">
        <DialogTitle>{{ t('choices.title') }}</DialogTitle>
        <DialogDescription>{{ t('choices.description') }}</DialogDescription>
      </DialogHeader>

      <div class="shrink-0 border-b bg-muted/30 px-6 py-3">
        <label for="choice-triggers" class="mb-1 block text-sm font-medium">{{ t('choices.sharedTrigger') }}</label>
        <Input id="choice-triggers" v-model="triggerText" :disabled="saving" spellcheck="false" />
        <p class="mt-1 text-xs text-muted-foreground">{{ t('choices.triggerHint') }}</p>
      </div>

      <div class="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        <div class="flex min-h-0 flex-col border-b bg-muted/10 md:border-b-0 md:border-r">
          <div class="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span>{{ t('choices.order') }}</span><span>Alt + 1…9</span>
          </div>
          <div class="max-h-48 overflow-y-auto px-2 pb-2 md:max-h-none md:flex-1" :aria-label="t('choices.options')">
            <button v-for="(choice, index) in drafts" :key="choice.id" type="button"
              class="flex w-full items-start gap-2 rounded-md border border-transparent px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="choice.id === activeId ? 'border-primary/30 bg-primary/10' : 'hover:bg-accent'"
              :aria-pressed="choice.id === activeId" :disabled="saving" @click="activeId = choice.id">
              <span class="mt-0.5 w-5 shrink-0 text-xs text-muted-foreground">{{ index + 1 }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ choice.label || t('choices.unnamed', { index: index + 1 }) }}</span>
                <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ choiceContent(choice) || t('choices.emptyContent') }}</span>
              </span>
            </button>
          </div>
          <div class="flex flex-wrap gap-1 border-t px-3 py-2">
            <Button type="button" size="sm" variant="ghost" :disabled="saving" @click="addChoice()"><Plus class="mr-1 h-3.5 w-3.5" />{{ t('choices.add') }}</Button>
            <Button type="button" size="sm" variant="ghost" :disabled="saving || !active" @click="addChoice(true)"><Copy class="mr-1 h-3.5 w-3.5" />{{ t('choices.duplicate') }}</Button>
          </div>
        </div>

        <div v-if="active" class="min-h-0 space-y-4 px-5 py-4 md:overflow-y-auto">
          <div class="flex items-center gap-1">
            <h3 class="mr-auto text-sm font-medium">{{ t('choices.optionNumber', { index: activeIndex + 1 }) }}</h3>
            <Button type="button" size="icon" variant="ghost" class="h-7 w-7" :disabled="saving || activeIndex === 0" :title="t('choices.moveUp')" :aria-label="t('choices.moveUp')" @click="move(-1)"><ArrowUp class="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" class="h-7 w-7" :disabled="saving || activeIndex === drafts.length - 1" :title="t('choices.moveDown')" :aria-label="t('choices.moveDown')" @click="move(1)"><ArrowDown class="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" class="h-7 w-7 text-destructive" :disabled="saving || drafts.length <= 1" :title="t('choices.remove')" :aria-label="t('choices.remove')" @click="removeChoice"><Trash2 class="h-4 w-4" /></Button>
          </div>
          <div class="space-y-1.5">
            <label for="choice-label" class="block text-sm font-medium">{{ t('choices.name') }}</label>
            <Input id="choice-label" v-model="active.label" :disabled="saving" :placeholder="t('choices.namePlaceholder')" />
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center justify-between gap-3">
              <label for="choice-content" class="shrink-0 text-sm font-medium">{{ t('choices.content') }}</label>
              <select :value="choiceContentType(active)" :disabled="saving || choiceContentType(active) === 'form'" :aria-label="t('choices.contentType')"
                class="w-auto max-w-[50%] rounded-md border bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" @change="changeContentType">
                <option value="plain">{{ t('snippets.contentTypes.plain') }}</option>
                <option value="markdown">Markdown</option><option value="html">HTML</option>
                <option value="image">{{ t('snippets.contentTypes.image') }}</option>
                <option v-if="choiceContentType(active) === 'form'" value="form">{{ t('snippets.contentTypes.form') }}</option>
              </select>
            </div>
            <Textarea id="choice-content" :model-value="choiceContent(active)" :disabled="saving || choiceContentType(active) === 'form'"
              rows="8" class="min-h-40 resize-y font-mono text-sm" spellcheck="false" :placeholder="t('choices.contentPlaceholder')"
              @update:model-value="updateContent(String($event))" />
            <p class="text-xs text-muted-foreground">{{ t('choices.advancedHint') }}</p>
          </div>
          <details class="border-t pt-3">
            <summary class="cursor-pointer text-sm font-medium">{{ t('choices.batchAdd') }}</summary>
            <p id="choice-batch-hint" class="my-2 text-xs text-muted-foreground">{{ t('choices.batchHint') }}</p>
            <Textarea v-model="batchText" :disabled="saving" rows="3" :aria-label="t('choices.batchAdd')" aria-describedby="choice-batch-hint" :placeholder="t('choices.batchPlaceholder')" />
            <Button type="button" size="sm" variant="outline" class="mt-2" :disabled="saving || !batchText.trim()" @click="addBatch">{{ t('choices.addBatch') }}</Button>
          </details>
        </div>
      </div>

      <div class="shrink-0 border-t px-6 py-3">
        <p v-if="error" class="mb-3 text-sm text-destructive" role="alert">{{ error }}</p>
        <DialogFooter class="items-center gap-2">
          <span class="mr-auto text-xs text-muted-foreground">{{ t('choices.shortcuts') }}</span>
          <Button type="button" variant="outline" :disabled="saving" @click="requestOpenChange(false)">{{ t('common.cancel') }}</Button>
          <Button type="button" :disabled="saving || !splitTriggers(triggerText).length" @click="save">
            <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />{{ saving ? t('choices.saving') : t('choices.saveAll') }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { v4 as uuidv4 } from 'uuid';
import { ArrowDown, ArrowUp, Copy, ListChecks, Loader2, Plus, Trash2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEspansoStore } from '@/store/useEspansoStore';
import type { ContentType, Match } from '@/types/core/espanso.types';
import { findFileNode } from '@/utils/configTreeUtils';
import { safeClone } from '@/utils/safeClone';
import { choiceContent, choiceContentType, matchTriggers, sameTriggers, splitTriggers, withChoiceContent } from '@/utils/choiceVariants';
import { isEqual } from 'lodash-es';

const props = defineProps<{ rule: Match; getCurrentDraft: () => Partial<Match>; busy?: boolean }>();
const emit = defineEmits<{ saved: [match: Match]; 'update:open': [open: boolean] }>();
const { t } = useI18n();
const store = useEspansoStore();
const open = ref(false);
const saving = ref(false);
const drafts = ref<Match[]>([]);
const activeId = ref('');
const triggerText = ref('');
const batchText = ref('');
const error = ref('');
let expected: Match[] = [];
let baseline: { drafts: Match[]; trigger: string };
const group = computed(() => {
  const file = props.rule.filePath ? findFileNode(store.state.configTree, props.rule.filePath) : null;
  return (file?.matches || []).filter(match => match.id === props.rule.id || sameTriggers(match, props.rule));
});
const variantsCount = computed(() => group.value.length || 1);
const activeIndex = computed(() => drafts.value.findIndex(match => match.id === activeId.value));
const active = computed(() => drafts.value[activeIndex.value]);

function openEditor(mode: 'edit' | 'add') {
  if (props.busy || !props.rule.filePath || !group.value.length) return;
  expected = safeClone(group.value);
  const currentDraft = { ...safeClone(props.rule), ...safeClone(props.getCurrentDraft()) };
  drafts.value = expected.map(match => match.id === props.rule.id ? currentDraft : safeClone(match));
  triggerText.value = matchTriggers(currentDraft).join(', ');
  activeId.value = props.rule.id;
  batchText.value = '';
  error.value = '';
  baseline = { drafts: safeClone(drafts.value), trigger: triggerText.value };
  open.value = true;
  emit('update:open', true);
  if (mode === 'add') addChoice();
}

function requestOpenChange(value: boolean) {
  if (value || saving.value) return;
  const changed = !isEqual(drafts.value, baseline?.drafts) || triggerText.value !== baseline?.trigger || !!batchText.value.trim();
  if (changed && !window.confirm(t('choices.discard'))) return;
  open.value = false;
  emit('update:open', false);
}

function addChoice(duplicate = false) {
  if (saving.value || !active.value) return;
  const source = safeClone(active.value);
  const choice: Match = { ...source, id: `match-${uuidv4()}`, label: duplicate ? source.label : '', createdAt: new Date().toISOString() };
  const next: Match = duplicate ? choice : withChoiceContent(choice, 'plain', '');
  if (!duplicate) {
    // A fresh option needs plain text; copied options retain their variables and advanced settings.
    delete next.vars;
    delete next.form;
  }
  drafts.value.splice(activeIndex.value + 1, 0, next);
  activeId.value = next.id;
  void nextTick(() => document.getElementById('choice-label')?.focus());
}

function updateContent(content: string) {
  if (!active.value || saving.value) return;
  drafts.value[activeIndex.value] = withChoiceContent(active.value, choiceContentType(active.value), content);
}

function changeContentType(event: Event) {
  if (!active.value || saving.value) return;
  const type = (event.target as HTMLSelectElement).value as ContentType;
  drafts.value[activeIndex.value] = withChoiceContent(active.value, type, choiceContent(active.value));
}

function move(offset: number) {
  const index = activeIndex.value;
  const target = index + offset;
  if (saving.value || index < 0 || target < 0 || target >= drafts.value.length) return;
  const [choice] = drafts.value.splice(index, 1);
  drafts.value.splice(target, 0, choice);
}

function removeChoice() {
  if (saving.value || drafts.value.length <= 1) return;
  const index = activeIndex.value;
  drafts.value.splice(index, 1);
  activeId.value = drafts.value[Math.min(index, drafts.value.length - 1)].id;
}

function addBatch() {
  if (!active.value || saving.value) return;
  const source = safeClone(active.value);
  const additions = batchText.value.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const tab = line.indexOf('\t');
    const label = tab < 0 ? '' : line.slice(0, tab).trim();
    const content = tab < 0 ? line : line.slice(tab + 1);
    const choice = withChoiceContent({ ...source, id: `match-${uuidv4()}`, label }, 'plain', content);
    delete choice.vars;
    delete choice.form;
    return choice;
  });
  drafts.value.push(...additions);
  activeId.value = additions[0]?.id || activeId.value;
  batchText.value = '';
}

async function save() {
  if (saving.value || !props.rule.filePath) return;
  error.value = '';
  if (batchText.value.trim()) { error.value = t('choices.pendingBatch'); return; }
  const triggers = splitTriggers(triggerText.value);
  if (!triggers.length) { error.value = t('choices.triggerRequired'); return; }
  const variants = safeClone(drafts.value).map(match => ({
    ...match, trigger: triggers.length === 1 ? triggers[0] : undefined,
    triggers: triggers.length > 1 ? [...triggers] : undefined,
  }));
  saving.value = true;
  try {
    const saved = await store.saveChoiceVariants(props.rule.filePath, expected, variants);
    emit('saved', saved.find(match => match.id === props.rule.id) || saved[0]);
    open.value = false;
    emit('update:open', false);
    toast.success(t('choices.saved', { count: saved.length }));
  } catch (cause) {
    error.value = t('choices.saveFailed', { error: cause instanceof Error ? cause.message : String(cause) });
  } finally {
    saving.value = false;
  }
}

function onShortcut(event: KeyboardEvent) {
  if (saving.value) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault(); event.stopPropagation(); void save();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault(); event.stopPropagation(); addChoice(true);
  } else if (event.altKey && /^[1-9]$/.test(event.key)) {
    const choice = drafts.value[Number(event.key) - 1];
    if (choice) { event.preventDefault(); event.stopPropagation(); activeId.value = choice.id; }
  }
}
</script>
