import type { ContentType, Match } from '@/types/core/espanso.types';

export function splitTriggers(text: string): string[] {
  return [...new Set(text.split(/[\n,]/).map(value => value.trim()).filter(Boolean))];
}

export function matchTriggers(match: Pick<Match, 'trigger' | 'triggers'>): string[] {
  return [...new Set((match.triggers?.length ? match.triggers : [match.trigger || '']).map(value => value.trim()).filter(Boolean))];
}

/** Only group identical trigger sets, so aliases belonging to other rules remain intact. */
export function sameTriggers(a: Pick<Match, 'trigger' | 'triggers'>, b: Pick<Match, 'trigger' | 'triggers'>): boolean {
  const left = matchTriggers(a).sort();
  const right = matchTriggers(b).sort();
  return left.length > 0 && left.length === right.length && left.every((value, index) => value === right[index]);
}

export function choiceContentType(match: Match): ContentType {
  if (match.contentType) return match.contentType;
  if (match.markdown !== undefined) return 'markdown';
  if (match.html !== undefined) return 'html';
  if (match.image_path !== undefined) return 'image';
  if (match.form !== undefined) return 'form';
  return 'plain';
}

export function choiceContent(match: Match): string {
  if (typeof match.content === 'string') return match.content;
  switch (choiceContentType(match)) {
    case 'markdown': return match.markdown ?? '';
    case 'html': return match.html ?? '';
    case 'image': return match.image_path ?? '';
    default: return match.replace ?? '';
  }
}

export function withChoiceContent(match: Match, contentType: ContentType, content: string): Match {
  const next: Match = { ...match, contentType, content };
  for (const key of ['replace', 'markdown', 'html', 'image_path']) delete next[key];
  const field = contentType === 'markdown' ? 'markdown' : contentType === 'html' ? 'html' : contentType === 'image' ? 'image_path' : 'replace';
  next[field] = content;
  return next;
}

/** Union of every snippet's triggers, first-seen order, duplicates dropped. */
export function unionTriggers(matches: Pick<Match, 'trigger' | 'triggers'>[]): string[] {
  return [...new Set(matches.flatMap(match => matchTriggers(match)))];
}

/** Give a snippet the shared trigger set, keeping only the matching representation. */
export function withTriggers(match: Match, triggers: string[]): Match {
  const next: Match = { ...match };
  if (triggers.length === 1) {
    next.trigger = triggers[0];
    delete next.triggers;
  } else {
    next.triggers = [...triggers];
    delete next.trigger;
  }
  return next;
}

/**
 * Merge snippets into one choice group: the keywords are unioned into a shared trigger set
 * while every snippet keeps its own content and becomes one option, labelled with its own
 * name (falling back to the keyword it was created from).
 */
export function toChoiceGroup(matches: Match[], triggers: string[]): Match[] {
  return matches.map(match => {
    const next = withTriggers(match, triggers);
    next.label = (match.label || '').trim() || matchTriggers(match)[0] || '';
    return next;
  });
}

/** Keep other snippets in their original relative order, placing the group at its first row. */
export function replaceVariants(matches: Match[], originalIds: string[], variants: Match[]): Match[] {
  const ids = new Set(originalIds);
  const foundIds = new Set<string>();
  const remaining: Match[] = [];
  let first = -1;
  // Validate the selection while collecting untouched rows, without scanning the file once per ID.
  for (const match of matches) {
    const id = match.id;
    if (ids.has(id)) {
      if (first < 0) first = remaining.length;
      foundIds.add(id);
    } else {
      remaining.push(match);
    }
  }
  if (first < 0 || foundIds.size !== ids.size) throw new Error('Choice group has changed');
  remaining.splice(first, 0, ...variants);
  return remaining.map((match, index) => ({ ...match, guiOrder: index + 1 }));
}
