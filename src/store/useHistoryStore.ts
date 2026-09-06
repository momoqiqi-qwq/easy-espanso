import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { safeClone } from '@/utils/safeClone';

export interface HistorySnapshot<T = unknown> { label: string; data: T; at: number }

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<HistorySnapshot[]>([]);
  const redoStack = ref<HistorySnapshot[]>([]);
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);
  function push<T>(label: string, data: T, limit = 60) {
    undoStack.value.push({ label, data: safeClone(data), at: Date.now() });
    if (undoStack.value.length > limit) undoStack.value.shift();
    redoStack.value = [];
  }
  function takeUndo<T>(current: T, limit = 60): HistorySnapshot<T> | null {
    const entry = undoStack.value.pop() as HistorySnapshot<T> | undefined;
    if (!entry) return null;
    redoStack.value.push({ label: entry.label, data: safeClone(current), at: Date.now() });
    if (redoStack.value.length > limit) redoStack.value.shift();
    return { ...entry, data: safeClone(entry.data) };
  }
  function takeRedo<T>(current: T, limit = 60): HistorySnapshot<T> | null {
    const entry = redoStack.value.pop() as HistorySnapshot<T> | undefined;
    if (!entry) return null;
    undoStack.value.push({ label: entry.label, data: safeClone(current), at: Date.now() });
    if (undoStack.value.length > limit) undoStack.value.shift();
    return { ...entry, data: safeClone(entry.data) };
  }
  function clear() { undoStack.value = []; redoStack.value = []; }
  return { undoStack, redoStack, canUndo, canRedo, push, takeUndo, takeRedo, clear };
});
