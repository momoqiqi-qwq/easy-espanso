import { computed } from 'vue';
import type { Match } from '@/types/core/espanso.types';

interface SortEntry {
  match: Match;
  timestamp: number;
  order: number;
}

function compareEntries(a: SortEntry, b: SortEntry): number {
  if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
  return a.order - b.order;
}

function matchesFilters(match: Match, query: string, tags: readonly string[]): boolean {
  if (match.type !== 'match') return false;

  const queryMatch = query && (
    match.trigger?.toLowerCase().includes(query) ||
    match.label?.toLowerCase().includes(query) ||
    match.description?.toLowerCase().includes(query) ||
    match.replace?.toString().toLowerCase().includes(query) ||
    match.tags?.some(tag => tag.toLowerCase().includes(query)) ||
    match.filePath?.toLowerCase().includes(query)
  );
  const tagMatch = tags.length > 0 && tags.every(tag => match.tags?.includes(tag));
  return !!(queryMatch || tagMatch);
}

/** Cache ordering separately so typing a query only filters the sorted matches. */
export function useSnippetList(
  getMatches: () => readonly Match[],
  getQuery: () => string,
  getTags: () => readonly string[],
) {
  const ordering = computed(() => {
    const ids = new Set<string>();
    let needsLegacySort = false;
    const entries = getMatches().map(match => {
      const updatedAt = match.updatedAt;
      const timestamp = updatedAt ? new Date(updatedAt).getTime() : 0;
      const order = match.guiOrder ?? Infinity;
      if (ids.has(match.id) || Number.isNaN(timestamp) || Number.isNaN(order)) {
        needsLegacySort = true;
      }
      ids.add(match.id);
      return { match, timestamp, order };
    });

    // Duplicate IDs keep the last matching item in the original input order.
    // NaN sort keys also require filtering first to preserve the old comparator.
    return { entries, sorted: needsLegacySort ? null : entries.slice().sort(compareEntries) };
  });

  return computed(() => {
    const query = getQuery().trim().toLowerCase();
    const tags = getTags();
    const { entries, sorted } = ordering.value;
    const hasFilters = !!query || tags.length > 0;

    if (sorted) {
      return sorted
        .filter(entry => !hasFilters || matchesFilters(entry.match, query, tags))
        .map(entry => entry.match);
    }

    // Compatibility path for malformed/duplicate data; timestamps stay cached.
    let selected = entries;
    if (hasFilters) {
      const byId = new Map<string, SortEntry>();
      for (const entry of entries) {
        if (matchesFilters(entry.match, query, tags)) byId.set(entry.match.id, entry);
      }
      selected = Array.from(byId.values());
    }
    return selected.slice().sort(compareEntries).map(entry => entry.match);
  });
}
