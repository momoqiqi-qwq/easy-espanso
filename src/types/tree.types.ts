import type { Match } from '@/types/core/espanso.types';

/** Lightweight view model used by the snippets tree. */
export interface TreeNodeItem {
  id: string;
  type: 'folder' | 'file' | 'match';
  name: string;
  children: TreeNodeItem[];
  match?: Match;
  path?: string;
}
