import { toRaw } from 'vue';
import { cloneDeep } from 'lodash-es';

/**
 * Deep-clone application state without passing Vue reactive proxies to
 * structuredClone. History snapshots are stored inside Pinia refs, so values
 * can become reactive again when they are read back; always unwrap the root
 * before cloning.
 */
export function safeClone<T>(value: T): T {
  return cloneDeep(toRaw(value));
}
