<template>
  <Dialog :open="visible" @update:open="requestOpenChange">
    <DialogContent class="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl" @keydown="onShortcut" @interact-outside.prevent>
      <DialogHeader class="shrink-0 border-b px-6 py-4 pr-12">
        <DialogTitle>{{ t('merge.title') }}</DialogTitle>
        <DialogDescription>{{ t('merge.description') }}</DialogDescription>
      </DialogHeader>

      <div class="shrink-0 border-b bg-muted/30 px-6 py-3">
        <div class="mb-1 flex items-center justify-between gap-3">
          <label for="merge-triggers" class="text-sm font-medium">{{ t('merge.sharedTrigger') }}</label>
          <Button type="button" size="sm" variant="ghost" class="h-6 px-2 text-xs" :disabled="saving || !selection.length" @click="resetTriggers">
            {{ t('merge.resetTriggers') }}
          </Button>
        </div>
        <Input id="merge-triggers" v-model="triggerText" :disabled="saving" spellcheck="false" @input="triggersTouched = true" />
        <p class="mt-1 text-xs text-muted-foreground">{{ t('merge.triggerHint') }}</p>
      </div>

      <div class="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_260px] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        <div class="flex min-h-0 flex-col border-b md:border-b-0 md:border-r">
          <div class="flex shrink-0 items-center gap-2 border-b px-4 py-2">
            <Input v-model="search" :disabled="saving" :placeholder="t('merge.searchPlaceholder')" :aria-label="t('merge.search')" class="h-8" />
            <Button type="button" size="sm" variant="ghost" class="h-8 shrink-0" :disabled="saving || !candidates.length" @click="selectAll">
              {{ t('merge.selectAll') }}
            </Button>
            <Button type="button" size="sm" variant="ghost" class="h-8 shrink-0" :disabled="saving || !selectedIds.length" @click="clearAll">
              {{ t('merge.clear') }}
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-2" :aria-label="t('merge.candidates')">
            <p v-if="!candidates.length" class="px-3 py-6 text-center text-sm text-muted-foreground">
              {{ allCandidates.length ? t('merge.noMatch') : t('merge.empty') }}
            </p>
            <div v-for="candidate in candidates" :key="candidate.id"
              class="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
              <Checkbox class="mt-0.5" :model-value="selectedIds.includes(candidate.id)" :disabled="saving"
                :aria-label="candidateName(candidate)" @update:model-value="() => toggle(candidate.id)" />
              <button type="button" class="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :disabled="saving" @click="toggle(candidate.id)">
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">{{ candidateName(candidate) }}</span>
                  <Badge v-if="candidate.id === draftOwnerId" variant="secondary" class="shrink-0 text-[10px]">{{ t('merge.current') }}</Badge>
                </span>
                <span class="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{{ keywordPreview(candidate) }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ choiceContent(candidate) || t('merge.emptyContent') }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex min-h-0 flex-col">
          <div class="flex shrink-0 items-center justify-between border-b px-4 py-3 text-xs text-muted-foreground">
            <span>{{ t('merge.preview') }}</span><span>{{ t('merge.selected', { count: selection.length }) }}</span>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <p v-if="!selection.length" class="px-3 py-6 text-center text-xs text-muted-foreground">{{ t('merge.previewEmpty') }}</p>
            <div v-for="(candidate, index) in selection" :key="candidate.id" class="flex items-start gap-2 rounded-md px-2 py-1.5">
              <span class="mt-0.5 w-4 shrink-0 text-xs text-muted-foreground">{{ index + 1 }}</span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ candidateName(candidate) }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ choiceContent(candidate) || t('merge.emptyContent') }}</span>
              </span>
            </div>
          </div>
          <p v-if="conflicts.length" class="shrink-0 border-t px-4 py-3 text-xs text-destructive" role="alert">
            {{ t('merge.conflict', { list: conflicts.map(candidateName).join('、') }) }}
          </p>
        </div>
      </div>

      <div class="shrink-0 border-t px-6 py-3">
        <p v-if="error" class="mb-3 text-sm text-destructive" role="alert">{{ error }}</p>
        <DialogFooter class="items-center gap-2">
          <span class="mr-auto text-xs text-muted-foreground">{{ t('merge.shortcuts') }}</span>
          <Button type="button" variant="outline" :disabled="saving" @click="requestOpenChange(false)">{{ t('common.cancel') }}</Button>
          <Button type="button" :disabled="saving || selection.length < 2 || !splitTriggers(triggerText).length" @click="save">
            <Loader2 v-if="saving" class="mr-2 h-4 w-4 animate-spin" />{{ saving ? t('merge.saving') : t('merge.confirm') }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEspansoStore } from '@/store/useEspansoStore';
import type { Match } from '@/types/core/espanso.types';
import { findFileNode } from '@/utils/configTreeUtils';
import { safeClone } from '@/utils/safeClone';
import { choiceContent, matchTriggers, splitTriggers, toChoiceGroup, unionTriggers } from '@/utils/choiceVariants';

const props = withDefaults(defineProps<{
  open?: boolean;
  filePath: string | null;
  /** Snippets selected when the dialog opens; the first one owns `getCurrentDraft`. */
  presetIds?: string[];
  getCurrentDraft?: () => Partial<Match>;
  busy?: boolean;
}>(), { open: false, presetIds: () => [], busy: false });

const emit = defineEmits<{
  merged: [matches: Match[]];
  'update:open': [open: boolean];
}>();

const { t } = useI18n();
const store = useEspansoStore();

const saving = ref(false);
const error = ref('');
const search = ref('');
const selectedIds = ref<string[]>([]);
const triggerText = ref('');
const triggersTouched = ref(false);
let baseline = { ids: [] as string[], trigger: '' };

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const draftOwnerId = computed(() => props.presetIds[0] || '');
const draft = computed<Partial<Match>>(() => (props.getCurrentDraft ? props.getCurrentDraft() : {}));

const allCandidates = computed<Match[]>(() => {
  const file = props.filePath ? findFileNode(store.state.configTree, props.filePath) : null;
  return file?.matches || [];
});

const candidates = computed<Match[]>(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return allCandidates.value;
  return allCandidates.value.filter(match => [candidateName(match), keywordPreview(match), match.description, choiceContent(match)]
    .filter(Boolean).join(' ').toLowerCase().includes(query));
});

/** Selected snippets in file order, so the merged group keeps a predictable option order. */
const selection = computed<Match[]>(() => allCandidates.value.filter(match => selectedIds.value.includes(match.id)));

const conflicts = computed<Match[]>(() => {
  const triggers = new Set(splitTriggers(triggerText.value));
  if (!triggers.size) return [];
  return allCandidates.value.filter(match => !selectedIds.value.includes(match.id) && matchTriggers(match).some(trigger => triggers.has(trigger)));
});

/** The snippet being edited may hold unsaved edits, so its draft wins over the stored copy. */
function effective(match: Match): Match {
  return match.id === draftOwnerId.value ? { ...safeClone(match), ...safeClone(draft.value) } : safeClone(match);
}

function candidateName(match: Match): string {
  return (match.label || '').trim() || matchTriggers(match)[0] || t('merge.unnamed');
}

function keywordPreview(match: Match): string {
  const triggers = matchTriggers(match);
  return triggers.length ? triggers.join(', ') : '—';
}

function toggle(id: string) {
  if (saving.value) return;
  const index = selectedIds.value.indexOf(id);
  if (index >= 0) selectedIds.value.splice(index, 1);
  else selectedIds.value.push(id);
  if (!triggersTouched.value) resetTriggers();
}

function selectAll() {
  if (saving.value) return;
  selectedIds.value = candidates.value.map(match => match.id);
  if (!triggersTouched.value) resetTriggers();
}

function clearAll() {
  if (saving.value) return;
  selectedIds.value = [];
  if (!triggersTouched.value) resetTriggers();
}

function resetTriggers() {
  triggerText.value = unionTriggers(selection.value.map(effective)).join(', ');
  triggersTouched.value = false;
}

function requestOpenChange(value: boolean) {
  if (value || saving.value) return;
  const changed = triggerText.value !== baseline.trigger || selectedIds.value.join('\n') !== baseline.ids.join('\n');
  if (changed && !window.confirm(t('merge.discard'))) return;
  visible.value = false;
}

function initialize() {
  const known = new Set(allCandidates.value.map(match => match.id));
  selectedIds.value = props.presetIds.filter(id => known.has(id));
  search.value = '';
  error.value = '';
  triggersTouched.value = false;
  resetTriggers();
  baseline = { ids: [...selectedIds.value], trigger: triggerText.value };
}

async function save() {
  if (saving.value || props.busy || !props.filePath) return;
  error.value = '';
  const triggers = splitTriggers(triggerText.value);
  if (!triggers.length) { error.value = t('merge.triggerRequired'); return; }
  if (selection.value.length < 2) { error.value = t('merge.needTwo'); return; }

  const expected = safeClone(selection.value);
  const variants = toChoiceGroup(selection.value.map(effective), triggers);
  saving.value = true;
  try {
    const saved = await store.mergeMatches(props.filePath, expected, variants);
    emit('merged', saved);
    visible.value = false;
    toast.success(t('merge.saved', { count: saved.length }));
  } catch (cause) {
    error.value = t('merge.failed', { error: cause instanceof Error ? cause.message : String(cause) });
  } finally {
    saving.value = false;
  }
}

function onShortcut(event: KeyboardEvent) {
  if (saving.value) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault(); event.stopPropagation(); void save();
  }
}

watch(() => props.open, open => { if (open) initialize(); });
</script>
