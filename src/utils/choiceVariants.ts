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

/** Keep other snippets in their original relative order, placing the group at its first row. */
export function replaceVariants(matches: Match[], originalIds: string[], variants: Match[]): Match[] {
  const ids = new Set(originalIds);
  const first = matches.findIndex(match => ids.has(match.id));
  if (first < 0 || originalIds.some(id => !matches.some(match => match.id === id))) throw new Error('Choice group has changed');
  const remaining = matches.filter(match => !ids.has(match.id));
  remaining.splice(first, 0, ...variants);
  return remaining.map((match, index) => ({ ...match, guiOrder: index + 1 }));
}
