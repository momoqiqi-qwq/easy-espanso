import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as vue from 'vue';

// Load the production composable and exercise its actual Vue dependency tracking.
let dateParses = 0;
class CountedDate extends Date {
  constructor(value) { super(value); dateParses++; }
}
const source = fs.readFileSync(new URL('../src/utils/snippetListUtils.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
new Function('require', 'exports', 'Date', code)(name => {
  if (name === 'vue') return vue;
  throw Error(`Unexpected dependency: ${name}`);
}, exports, CountedDate);
const { useSnippetList } = exports;

let checks = 0;
function check(label, action) {
  action();
  checks++;
  console.log(`PASS ${label}`);
}
const match = (id, fields = {}) => ({ id, type: 'match', ...fields });
function setup(matches) {
  const state = vue.reactive({ matches, query: '', tags: [] });
  const result = useSnippetList(() => state.matches, () => state.query, () => state.tags);
  return { state, result };
}
function readMeasured(result) {
  const originalSort = Array.prototype.sort;
  const parsesBefore = dateParses;
  let sorts = 0;
  Array.prototype.sort = function (...args) {
    sorts++;
    return originalSort.apply(this, args);
  };
  try {
    const value = result.value;
    return { value, sorts, parses: dateParses - parsesBefore };
  } finally {
    Array.prototype.sort = originalSort;
  }
}

// Reference behavior from MiddlePane before the optimization, including the
// filter-then-Map ordering and legacy NaN comparator behavior.
function legacyList(matches, searchQuery, tags) {
  const query = searchQuery.trim().toLowerCase();
  let selected = [...matches];
  if (query || tags.length > 0) {
    const byId = new Map();
    for (const item of matches) {
      let queryMatch = false;
      if (query && item.type === 'match') {
        queryMatch = item.trigger?.toLowerCase().includes(query)
          || item.label?.toLowerCase().includes(query)
          || item.description?.toLowerCase().includes(query)
          || item.replace?.toString().toLowerCase().includes(query)
          || item.tags?.some(tag => tag.toLowerCase().includes(query))
          || item.filePath?.toLowerCase().includes(query)
          || false;
      }
      const tagMatch = tags.length > 0 && item.type === 'match'
        && (item.tags && tags.every(tag => item.tags.includes(tag)));
      if (queryMatch || tagMatch) byId.set(item.id, item);
    }
    selected = Array.from(byId.values());
  }
  return selected.sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    return (a.guiOrder ?? Infinity) - (b.guiOrder ?? Infinity);
  });
}
function assertLegacy(state, result) {
  const expected = legacyList(state.matches, state.query, state.tags);
  assert.equal(result.value.length, expected.length);
  expected.forEach((item, index) => assert.equal(result.value[index], item));
}
const queryCases = ['', '   ', 'ALPHA', 'beta', ' body ', '工作', 'a.yml', 'missing', ':alias'];
const tagCases = [[], ['work'], ['work', 'shared'], ['WORK'], ['missing']];
function assertAllFilters(state, result) {
  for (const query of queryCases) {
    for (const tags of tagCases) {
      state.query = query;
      state.tags = tags;
      assertLegacy(state, result);
    }
  }
}

check('all search fields and query OR all-tags behavior stay equivalent', () => {
  const { state, result } = setup([
    match('trigger', { trigger: ':Alpha', updatedAt: '2026-10-01T00:00:00Z' }),
    match('label', { label: 'Alpha', tags: ['work', 'shared'], guiOrder: 2 }),
    match('description', { description: 'Beta 工作', tags: ['work'], guiOrder: 0 }),
    match('replace', { replace: 'Alpha body', updatedAt: '2026-10-02T00:00:00Z' }),
    match('tags', { tags: ['Alpha', 'shared'] }),
    match('path', { filePath: 'C:/工作/a.yml', tags: ['WORK'] }),
    match('aliases', { triggers: [':alias'] }),
    match('empty'),
  ]);
  assertAllFilters(state, result);
  state.query = ':alias'; state.tags = [];
  assert.deepEqual(result.value, []); // Do not silently expand the searched fields.
});

check('missing dates, timezone equivalents and equal sort keys retain stable ordering', () => {
  const { state, result } = setup([
    match('empty-date', { updatedAt: '', guiOrder: 0 }),
    match('missing-date', { guiOrder: -1 }),
    match('utc', { updatedAt: '2026-10-01T00:00:00Z', guiOrder: 3 }),
    match('offset', { updatedAt: '2026-10-01T08:00:00+08:00', guiOrder: 3 }),
    match('first', { updatedAt: '2026-10-01T00:00:00Z', guiOrder: -2 }),
    match('undefined-order'),
    match('null-order', { guiOrder: null }),
    match('old', { updatedAt: '1969-12-31T00:00:00Z' }),
  ]);
  assertLegacy(state, result);
  assert.deepEqual(result.value.map(item => item.id), [
    'first', 'utc', 'offset', 'missing-date', 'empty-date', 'undefined-order', 'null-order', 'old',
  ]);
});

check('duplicate IDs retain the last matching object and first matching tie position', () => {
  const { state, result } = setup([
    match('same', { trigger: 'alpha', guiOrder: 1 }),
    match('other', { trigger: 'alpha beta', guiOrder: 1 }),
    match('same', { trigger: 'beta', guiOrder: 1 }),
    match('newer', { trigger: 'alpha', updatedAt: '2026-10-01T00:00:00Z' }),
  ]);
  assertAllFilters(state, result);
  state.query = ''; state.tags = [];
  assert.equal(result.value.length, 4); // No-filter branch never deduplicated.
  state.query = 'beta';
  assert.equal(result.value.at(-1), state.matches[2]);
});

check('invalid dates and NaN orders preserve filter-before-sort compatibility', () => {
  const { state, result } = setup([
    match('new', { trigger: 'alpha', updatedAt: '2026-10-03T00:00:00Z' }),
    match('invalid', { trigger: 'beta', updatedAt: 'not-a-date', guiOrder: -5 }),
    match('old', { trigger: 'alpha', updatedAt: '2026-10-01T00:00:00Z' }),
    match('middle', { trigger: 'alpha beta', updatedAt: '2026-10-02T00:00:00Z' }),
    match('nan-order', { trigger: 'alpha', guiOrder: NaN }),
    match('missing', { tags: ['work', 'shared'] }),
  ]);
  assertAllFilters(state, result);
});

check('repeated search/tag changes do not sort or parse dates again', () => {
  const { state, result } = setup(Array.from({ length: 1000 }, (_, index) => match(String(index), {
    trigger: `:alpha-${index}`, tags: index % 2 ? ['work'] : ['shared'],
    updatedAt: `2026-10-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    guiOrder: index,
  })));
  const initial = readMeasured(result);
  assert.equal(initial.sorts, 1);
  assert.equal(initial.parses, state.matches.length);
  for (let index = 0; index < 25; index++) {
    state.query = `alpha-${index}`;
    state.tags = index % 2 ? ['work'] : [];
    const next = readMeasured(result);
    assert.equal(next.sorts, 0);
    assert.equal(next.parses, 0);
    assertLegacy(state, result);
  }
  console.log('  1,000 snippets: initial 1 sort / 1,000 date parses; 25 searches: 0 / 0');
});

check('updatedAt and guiOrder mutations invalidate ordering and immediately reorder', () => {
  const { state, result } = setup([
    match('a', { trigger: 'alpha', updatedAt: '2026-10-01T00:00:00Z', guiOrder: 1 }),
    match('b', { trigger: 'beta', updatedAt: '2026-10-01T00:00:00Z', guiOrder: 2 }),
  ]);
  assertLegacy(state, result);
  state.matches[1].guiOrder = 0;
  assert.equal(readMeasured(result).sorts, 1);
  assert.equal(result.value[0].id, 'b');
  state.matches[0].updatedAt = '2026-10-02T00:00:00Z';
  const reordered = readMeasured(result);
  assert.equal(reordered.sorts, 1);
  assert.equal(reordered.parses, 2);
  assert.equal(result.value[0].id, 'a');
  assertLegacy(state, result);
});

check('search-field edits update results without invalidating ordering', () => {
  const { state, result } = setup([match('a', { trigger: 'alpha', tags: [], updatedAt: '2026-10-01T00:00:00Z' })]);
  state.query = 'beta';
  assert.deepEqual(result.value, []);
  state.matches[0].trigger = 'beta';
  const edited = readMeasured(result);
  assert.equal(edited.value.length, 1);
  assert.equal(edited.sorts, 0);
  assert.equal(edited.parses, 0);
  state.query = ''; state.tags = ['work'];
  assert.deepEqual(result.value, []);
  state.matches[0].tags.push('work');
  const tagged = readMeasured(result);
  assert.equal(tagged.value.length, 1);
  assert.equal(tagged.sorts, 0);
  assert.equal(tagged.parses, 0);
});

check('insertions, removals, replacements and ID edits invalidate the right cache', () => {
  const { state, result } = setup([match('a', { trigger: 'alpha' })]);
  assertLegacy(state, result);
  state.matches.push(match('b', { trigger: 'alpha', updatedAt: '2026-10-02T00:00:00Z' }));
  assert.equal(readMeasured(result).sorts, 1);
  assertLegacy(state, result);
  state.matches[1].id = 'a'; state.query = 'alpha';
  assertLegacy(state, result);
  assert.equal(result.value.length, 1);
  state.matches.splice(0, 1);
  assertLegacy(state, result);
  state.matches = [];
  assert.deepEqual(result.value, []);
});

console.log(`\n${checks} snippet list checks passed.`);
