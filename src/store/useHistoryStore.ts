import { defineStore } from 'pinia';
import { computed, markRaw, shallowRef } from 'vue';

export interface HistorySnapshot<T = unknown> { label: string; data: T; at: number }
/** push 返回的句柄：写盘失败时用 discard 撤回这一条，并恢复被清空的重做栈。 */
export interface HistoryToken { entry: HistorySnapshot; redo: HistorySnapshot[] }

/**
 * 撤销/重做栈。
 * - 快照是整棵配置树：栈用 shallowRef + markRaw 保存，避免 Vue 为历史数据建立深度响应式代理。
 * - push/take 接管传入数据的所有权（调用方必须传入独立副本，如 _snapshot() 的结果），不再重复深拷贝；
 *   弹出的条目已离开栈，直接交给调用方使用。每次编辑/撤销因此只做一次整树拷贝（原先 3~4 次）。
 */
export const useHistoryStore = defineStore('history', () => {
  const undoStack = shallowRef<HistorySnapshot[]>([]);
  const redoStack = shallowRef<HistorySnapshot[]>([]);
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);
  const entry = <T>(label: string, data: T): HistorySnapshot<T> => markRaw({ label, data, at: Date.now() });
  const bounded = (stack: HistorySnapshot[], item: HistorySnapshot, limit: number) => {
    const next = [...stack, item];
    return next.length > limit ? next.slice(next.length - Math.max(0, limit)) : next;
  };
  function push<T>(label: string, data: T, limit = 60): HistoryToken {
    const item = entry(label, data);
    const redo = redoStack.value;
    undoStack.value = bounded(undoStack.value, item, limit);
    redoStack.value = [];
    return { entry: item, redo };
  }
  /** 撤回最近一次 push（仅当它仍在栈顶时），用于「先记录、后写盘、写盘失败」的场景。 */
  function discard(token: HistoryToken): boolean {
    const stack = undoStack.value;
    if (stack[stack.length - 1] !== token.entry) return false;
    undoStack.value = stack.slice(0, -1);
    if (!redoStack.value.length) redoStack.value = token.redo;
    return true;
  }
  function takeUndo<T>(current: T, limit = 60): HistorySnapshot<T> | null {
    const stack = undoStack.value;
    const item = stack[stack.length - 1] as HistorySnapshot<T> | undefined;
    if (!item) return null;
    undoStack.value = stack.slice(0, -1);
    redoStack.value = bounded(redoStack.value, entry(item.label, current), limit);
    return item;
  }
  function takeRedo<T>(current: T, limit = 60): HistorySnapshot<T> | null {
    const stack = redoStack.value;
    const item = stack[stack.length - 1] as HistorySnapshot<T> | undefined;
    if (!item) return null;
    redoStack.value = stack.slice(0, -1);
    undoStack.value = bounded(undoStack.value, entry(item.label, current), limit);
    return item;
  }
  function clear() { undoStack.value = []; redoStack.value = []; }
  return { undoStack, redoStack, canUndo, canRedo, push, discard, takeUndo, takeRedo, clear };
});
