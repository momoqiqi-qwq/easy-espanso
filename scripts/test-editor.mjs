import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import yaml from 'js-yaml';
import * as vue from 'vue';
import * as pinia from 'pinia';
import * as lodash from 'lodash-es';
import { v4 } from 'uuid';

// Exercise production service/store code with an in-memory filesystem. No user configuration is touched.
let checks = 0;
const check = async (label, action) => { await action(); checks++; console.log(`PASS ${label}`); };
const quiet = { log() {}, warn() {}, error() {} };
const cache = new Map();
const files = new Map();
const writes = [];
let failWrite = '';
let failBackup = '';
const platform = {
  fileExists: async path => files.has(path),
  readFile: async path => { if (!files.has(path)) throw Error('Missing file'); return files.get(path); },
  writeFile: async (path, text) => { if (path === failWrite) throw Error(`write failed: ${path}`); files.set(path, text); writes.push(path); },
  deleteFile: async path => { files.delete(path); },
};
const adapter = { parseYaml: async text => yaml.load(text) || {}, serializeYaml: async data => yaml.dump(data, { noRefs: true, lineWidth: -1 }) };
const history = {
  undoStack: [],
  push(label, data) { const entry = { label, data: lodash.cloneDeep(vue.toRaw(data)) }; this.undoStack.push(entry); return { entry }; },
  discard(token) { if (this.undoStack[this.undoStack.length - 1] !== token.entry) return false; this.undoStack.pop(); return true; },
};
const mocked = {
  vue, pinia, 'lodash-es': lodash, uuid: { v4 }, 'vue-sonner': { toast: { error() {}, success() {} } },
  './platformService': platform, '@/services/platformService': platform,
  './platform/PlatformAdapterFactory': { PlatformAdapterFactory: { getInstance: () => adapter } },
  '@/store/useUserPreferences': { useUserPreferences: () => ({ preferences: { historyLimit: 60, rememberTreeState: false } }) },
  '@/store/useHistoryStore': { useHistoryStore: () => history },
  '@/services/configService': {},
  './workspaceService': {
    validateYamlText: async text => { yaml.load(text); },
    backupFile: async path => { if (path === failBackup) throw Error('backup failed'); },
  },
  '@/services/workspaceService': {},
  // Auto-reload is a no-op here: this suite only asserts what gets written to disk.
  './espansoReloadService': { scheduleEspansoReload() {}, reloadEspansoNow: async () => {} },
  '@/services/espansoReloadService': { scheduleEspansoReload() {}, reloadEspansoNow: async () => {} },
};
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  cache.set(path, exports);
  const source = fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const require = name => {
    if (name in mocked) return mocked[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    if (name === './yamlService') return load('src/services/yamlService.ts');
    if (name === './configService') return {};
    throw Error(`Missing boundary stub: ${name}`);
  };
  new Function('require', 'exports', 'console', code)(require, exports, quiet);
  return exports;
}
const yamlService = load('src/services/yamlService.ts');
const service = load('src/services/espansoService.ts');
const utils = load('src/utils/espansoDataUtils.ts');
const choices = load('src/utils/choiceVariants.ts');
const tree = load('src/utils/configTreeUtils.ts');
const match = (id, filePath, trigger = ':hu') => ({ id, filePath, type: 'match', trigger, replace: id, contentType: 'plain' });
const reset = () => { writes.length = 0; files.clear(); failBackup = ''; failWrite = ''; history.undoStack.length = 0; };

await check('shared YAML anchors survive serialization', async () => {
  const data = yaml.load('a: &shared\n  answer: 42\nb: *shared\n');
  assert.deepEqual(yaml.load(await yamlService.serializeYaml(data)), { a: { answer: 42 }, b: { answer: 42 } });
});
await check('shared arrays survive serialization', async () => {
  const array = ['one', 'two'];
  assert.deepEqual(yaml.load(await yamlService.serializeYaml({ a: array, b: array })), { a: array, b: array });
});
await check('cyclic YAML rejects instead of silently erasing fields', async () => {
  const cycle = {}; cycle.child = cycle;
  await assert.rejects(yamlService.serializeYaml(cycle), /Circular YAML reference/);
});
await check('dates and custom underscore keys survive serialization', async () => {
  const date = new Date('2026-10-07T00:00:00Z');
  const result = yaml.load(await yamlService.serializeYaml({ date, _custom: 'retained' }));
  assert.equal(result.date.toISOString(), date.toISOString());
  assert.equal(result._custom, 'retained');
});
await check('same basenames in different folders have distinct IDs', () => {
  assert.notEqual(utils.generateMatchId({ trigger: ':hu' }, 'match/a/base.yml', 1), utils.generateMatchId({ trigger: ':hu' }, 'match/b/base.yml', 1));
});
await check('punctuation and Unicode do not collapse snippet identities', () => {
  const ids = [':a-b', ':a_b', ':你好', ':您好'].map(trigger => utils.generateMatchId({ trigger }, 'match/base.yml', 1));
  assert.equal(new Set(ids).size, ids.length);
});
await check('path separator normalization keeps IDs deterministic', () => {
  assert.equal(utils.generateMatchId({ trigger: ':hu' }, 'C:\\config\\base.yml', 1), utils.generateMatchId({ trigger: ':hu' }, 'C:/config/base.yml', 1));
});
await check('unexposed match settings survive load/edit/save', () => {
  const processed = utils.processMatch({ trigger: ':hu', replace: 'hugger', regex: 'h.*', max_delay: 1000, vars: [{ name: 'v', type: 'echo', params: { echo: 'value' } }] }, 'a.yml', { count: 0 });
  const result = utils.cleanMatchForSaving(processed);
  assert.equal(result.regex, 'h.*'); assert.equal(result.max_delay, 1000); assert.equal(result.vars[0].params.echo, 'value');
  assert.equal(result.id, undefined); assert.equal(result.filePath, undefined);
});
await check('backup failure never overwrites the original', async () => {
  reset(); files.set('a.yml', 'original'); failBackup = 'a.yml';
  await assert.rejects(service.saveConfigurationFile('a.yml', [match('first', 'a.yml')]), /backup failed/);
  assert.equal(files.get('a.yml'), 'original'); assert.deepEqual(writes, []);
});
await check('multi-file preflight failure writes nothing', async () => {
  reset(); files.set('a.yml', 'a original'); files.set('b.yml', 'b original'); failBackup = 'b.yml';
  await assert.rejects(service.saveConfigurationFiles(['a.yml', 'b.yml'].map(filePath => ({ filePath, itemsToSave: [match(filePath, filePath)] }))), /backup failed/);
  assert.deepEqual(writes, []);
});
await check('second write failure restores the first file exactly', async () => {
  reset(); files.set('a.yml', '# comment\nmatches: []\n'); files.set('b.yml', 'b original'); failWrite = 'b.yml';
  await assert.rejects(service.saveConfigurationFiles(['a.yml', 'b.yml'].map(filePath => ({ filePath, itemsToSave: [match(filePath, filePath)] }))), /write failed/);
  assert.equal(files.get('a.yml'), '# comment\nmatches: []\n'); assert.equal(files.get('b.yml'), 'b original');
});
await check('failed group save removes a newly created first file', async () => {
  reset(); files.set('b.yml', 'b original'); failWrite = 'b.yml';
  await assert.rejects(service.saveConfigurationFiles(['a.yml', 'b.yml'].map(filePath => ({ filePath, itemsToSave: [match(filePath, filePath)] }))));
  assert.equal(files.has('a.yml'), false);
});
await check('empty matches remain an explicit empty array and keep globals', async () => {
  reset(); await service.saveConfigurationFile('a.yml', [], { global_vars: [{ name: 'x', type: 'echo' }] });
  assert.deepEqual(yaml.load(files.get('a.yml')), { global_vars: [{ name: 'x', type: 'echo' }], matches: [] });
});
await check('failed save does not poison the queue', async () => {
  reset(); failWrite = 'a.yml'; await assert.rejects(service.saveConfigurationFile('a.yml', []));
  failWrite = ''; await service.saveConfigurationFile('a.yml', [match('recovered', 'a.yml')]);
  assert.equal(yaml.load(files.get('a.yml')).matches[0].replace, 'recovered');
});
await check('full trigger sets group together regardless of alias order', () => {
  assert.equal(choices.sameTriggers({ triggers: [':a', ':b'] }, { triggers: [':b', ':a'] }), true);
  assert.equal(choices.sameTriggers({ trigger: ':a' }, { triggers: [':a', ':b'] }), false);
  assert.equal(choices.sameTriggers({ trigger: '' }, { trigger: '' }), false);
});
await check('bulk trigger normalization deduplicates entries', () => {
  assert.deepEqual(choices.splitTriggers(':a, :b\n:a\n'), [':a', ':b']);
});
await check('group replacement preserves unrelated snippet order', () => {
  const before = ['first', 'other', 'second', 'last'].map(id => match(id, 'a.yml'));
  const after = choices.replaceVariants(before, ['first', 'second'], [match('new', 'a.yml')]);
  assert.deepEqual(after.map(m => m.id), ['new', 'other', 'last']);
  assert.deepEqual(after.map(m => m.guiOrder), [1, 2, 3]);
});
await check('group replacement rejects empty or missing selections', () => {
  const before = ['first', 'second'].map(id => match(id, 'a.yml'));
  for (const ids of [[], ['missing'], ['first', 'missing'], ['missing', 'second']]) {
    assert.throws(() => choices.replaceVariants(before, ids, [match('new', 'a.yml')]), /Choice group has changed/);
  }
  assert.throws(() => choices.replaceVariants([], ['first'], []), /Choice group has changed/);
  assert.deepEqual(before.map(m => m.id), ['first', 'second']);
});
await check('group replacement accepts repeated selected IDs and removes every matching row', () => {
  const before = ['start', 'selected', 'middle', 'selected', 'last'].map(id => match(id, 'a.yml'));
  const after = choices.replaceVariants(before, ['selected', 'selected'], [match('new', 'a.yml')]);
  assert.deepEqual(after.map(m => m.id), ['start', 'new', 'middle', 'last']);
  assert.deepEqual(after.map(m => m.guiOrder), [1, 2, 3, 4]);
  const removed = choices.replaceVariants(before, ['selected'], []);
  assert.deepEqual(removed.map(m => m.id), ['start', 'middle', 'last']);
  assert.deepEqual(removed.map(m => m.guiOrder), [1, 2, 3]);
});
await check('group replacement returns fresh rows without changing frozen inputs', () => {
  const before = Object.freeze(['start', 'first', 'middle', 'second', 'last'].map((id, index) => Object.freeze({ ...match(id, 'a.yml'), guiOrder: index + 10 })));
  const ids = Object.freeze(['second', 'first']);
  const variants = Object.freeze([Object.freeze({ ...match('new', 'a.yml'), guiOrder: 99 })]);
  const after = choices.replaceVariants(before, ids, variants);
  assert.deepEqual(after.map(m => m.id), ['start', 'new', 'middle', 'last']);
  assert.deepEqual(after.map(m => m.guiOrder), [1, 2, 3, 4]);
  assert.notEqual(after, before);
  assert.notEqual(after[0], before[0]);
  assert.notEqual(after[1], variants[0]);
  assert.deepEqual(before.map(m => m.guiOrder), [10, 11, 12, 13, 14]);
  assert.equal(variants[0].guiOrder, 99);
});
await check('large group replacement keeps identity reads linear', () => {
  const count = 6000;
  const ids = Array.from({ length: count }, (_, index) => `selected-${index}`);
  let identityReads = 0;
  const before = ids.map(id => ({
    ...match(id, 'a.yml'),
    get id() { identityReads++; return id; },
  }));
  const after = choices.replaceVariants(before, ids, [match('new', 'a.yml')]);
  assert.deepEqual(after.map(m => m.id), ['new']);
  assert.equal(after[0].guiOrder, 1);
  // Count accesses instead of timing the machine: repeated full-file scans grow quadratically.
  assert.ok(identityReads <= count * 4, `${identityReads} identity reads for ${count} selected snippets`);
});
await check('changing choice type removes incompatible content and retains advanced fields', () => {
  const result = choices.withChoiceContent({ ...match('first', 'a.yml'), vars: [{ name: 'v' }], word: true }, 'html', '<b>hugger</b>');
  assert.equal(result.replace, undefined); assert.equal(result.html, '<b>hugger</b>'); assert.equal(result.word, true); assert.equal(result.vars[0].name, 'v');
});

pinia.setActivePinia(pinia.createPinia());
const store = load('src/store/useEspansoStore.ts').useEspansoStore();
const setupStore = () => {
  reset();
  const a = tree.createFileNode('a.yml', 'a.yml', 'match', {}, [match('first', 'a.yml'), match('other', 'a.yml', ':other'), match('second', 'a.yml')]);
  const b = tree.createFileNode('b.yml', 'b.yml', 'match', {}, []);
  store.state.configTree = [a, b]; store.state.selectedItemId = 'first'; store.state.selectedItemType = 'match'; store.state.error = null;
  files.set('a.yml', 'a original'); files.set('b.yml', 'b original');
  return store.state.configTree;
};
await check('batch choice save writes once and records one undo operation', async () => {
  const [a] = setupStore(); const expected = lodash.cloneDeep(a.matches.filter(m => m.trigger === ':hu'));
  const next = expected.map((m, i) => ({ ...m, label: `Choice ${i + 1}`, replace: `reply ${i + 1}` }));
  await store.saveChoiceVariants('a.yml', expected, next);
  assert.deepEqual(writes, ['a.yml']); assert.equal(history.undoStack.length, 1);
  assert.deepEqual(yaml.load(files.get('a.yml')).matches.map(m => m.replace), ['reply 1', 'reply 2', 'other']);
});
await check('failed batch save retains memory and creates no undo entry', async () => {
  const [a] = setupStore(); const expected = lodash.cloneDeep(a.matches.filter(m => m.trigger === ':hu')); failBackup = 'a.yml';
  await assert.rejects(store.saveChoiceVariants('a.yml', expected, [{ ...expected[0], replace: 'new' }]));
  assert.equal(a.matches.length, 3); assert.equal(a.matches[0].replace, 'first'); assert.equal(history.undoStack.length, 0);
});
await check('stale dialog cannot overwrite a newer edit', async () => {
  const [a] = setupStore(); const expected = lodash.cloneDeep(a.matches.filter(m => m.trigger === ':hu')); a.matches[0].replace = 'newer';
  await assert.rejects(store.saveChoiceVariants('a.yml', expected, expected), /重新打开/); assert.deepEqual(writes, []);
});
await check('removing the selected choice chooses a remaining one', async () => {
  const [a] = setupStore(); const expected = lodash.cloneDeep(a.matches.filter(m => m.trigger === ':hu'));
  await store.saveChoiceVariants('a.yml', expected, [expected[1]]);
  assert.equal(store.state.selectedItemId, 'second');
});
await check('batch choice save rejects duplicate or unrelated IDs without writing', async () => {
  const [a] = setupStore();
  const expected = lodash.cloneDeep(a.matches.filter(m => m.trigger === ':hu'));
  await assert.rejects(store.saveChoiceVariants('a.yml', expected, [expected[0], { ...expected[1], id: expected[0].id }]), /Duplicate choice ID/);
  await assert.rejects(store.saveChoiceVariants('a.yml', expected, [{ ...expected[0], id: 'other' }]), /Choice ID is already in use/);
  assert.deepEqual(writes, []);
  assert.equal(history.undoStack.length, 0);
  assert.deepEqual(a.matches.map(m => m.id), ['first', 'other', 'second']);
});
await check('large batch choice save returns only its ordered choices and clears removed IDs', async () => {
  const [a] = setupStore();
  const count = 1200;
  const selected = Array.from({ length: count }, (_, index) => match(`choice-${index}`, 'a.yml'));
  a.matches = [match('start', 'a.yml', ':start'), ...selected, match('other', 'a.yml', ':other')];
  const expected = lodash.cloneDeep(a.matches.slice(1, -1));
  const variants = expected.filter((_, index) => index % 2 === 1).reverse();
  store.state.selectedItemId = 'choice-0';
  store.state.modifiedNodeIds.add('choice-0');
  store.state.justSavedNodeIds.add('choice-0');
  const saved = await store.saveChoiceVariants('a.yml', expected, variants);
  assert.deepEqual(saved.map(m => m.id), variants.map(m => m.id));
  assert.deepEqual(a.matches.map(m => m.id), ['start', ...variants.map(m => m.id), 'other']);
  assert.deepEqual(a.matches.map(m => m.guiOrder), Array.from({ length: variants.length + 2 }, (_, index) => index + 1));
  assert.equal(store.state.selectedItemId, variants[0].id);
  assert.equal(store.state.modifiedNodeIds.has('choice-0'), false);
  assert.equal(store.state.justSavedNodeIds.has('choice-0'), false);
  assert.deepEqual(writes, ['a.yml']);
  assert.equal(history.undoStack.length, 1);
});
await check('merging snippets folds every keyword into one shared trigger set', () => {
  const merged = choices.toChoiceGroup(
    [{ ...match('first', 'a.yml', ':a'), replace: 'body a' }, { ...match('second', 'a.yml', ':b'), replace: 'body b' }],
    choices.unionTriggers([{ trigger: ':a' }, { triggers: [':b', ':c', ':a'] }])
  );
  assert.deepEqual(merged.map(m => m.triggers), [[':a', ':b', ':c'], [':a', ':b', ':c']]);
  assert.deepEqual(merged.map(m => m.trigger), [undefined, undefined]);
  assert.deepEqual(merged.map(m => m.label), [':a', ':b']);
  assert.deepEqual(merged.map(m => m.replace), ['body a', 'body b']);
});
await check('a single shared keyword stays a plain trigger and keeps the custom label', () => {
  const [merged] = choices.toChoiceGroup([{ ...match('first', 'a.yml', ':a'), label: 'Named' }], [':a']);
  assert.equal(merged.trigger, ':a'); assert.equal(merged.triggers, undefined); assert.equal(merged.label, 'Named');
});
await check('merge rewrites the selected snippets into one group in a single write', async () => {
  const [a] = setupStore();
  const expected = lodash.cloneDeep(a.matches.filter(m => m.id === 'first' || m.id === 'second'));
  await store.mergeMatches('a.yml', expected, choices.toChoiceGroup(expected, [':a', ':b']));
  assert.deepEqual(writes, ['a.yml']); assert.equal(history.undoStack.length, 1);
  assert.equal(history.undoStack[0].label, '合并片段');
  const saved = yaml.load(files.get('a.yml')).matches;
  assert.deepEqual(saved.map(m => m.triggers), [[':a', ':b'], [':a', ':b'], undefined]);
  assert.deepEqual(saved.map(m => m.trigger), [undefined, undefined, ':other']);
  assert.deepEqual(saved.map(m => m.label), [':hu', ':hu', undefined]);
  assert.deepEqual(a.matches.map(m => m.guiOrder), [1, 2, 3]);
});
await check('merge refuses a single snippet and a stale selection', async () => {
  const [a] = setupStore();
  const expected = lodash.cloneDeep(a.matches.filter(m => m.id === 'first' || m.id === 'second'));
  await assert.rejects(store.mergeMatches('a.yml', [expected[0]], [expected[0]]), /两个片段/);
  a.matches.find(m => m.id === 'second').replace = 'newer';
  await assert.rejects(store.mergeMatches('a.yml', expected, choices.toChoiceGroup(expected, [':a', ':b'])), /重新打开/);
  assert.deepEqual(writes, []); assert.equal(history.undoStack.length, 0);
});
await check('failed cross-file move restores both disk and reactive tree', async () => {
  const [, b] = setupStore(); failWrite = 'b.yml';
  await store.moveItem('first', b.id, 0);
  assert.equal(store.state.configTree[0].matches[0].id, 'first'); assert.equal(store.state.configTree[1].matches.length, 0);
  assert.equal(files.get('a.yml'), 'a original'); assert.equal(files.get('b.yml'), 'b original'); assert.equal(history.undoStack.length, 0);
});
await check('unchanged content is not rewritten or backed up', async () => {
  reset(); await service.saveConfigurationFile('a.yml', [match('same', 'a.yml')]);
  const first = files.get('a.yml'); writes.length = 0; failBackup = 'a.yml';
  await service.saveConfigurationFile('a.yml', [match('same', 'a.yml')]);
  assert.deepEqual(writes, []); assert.equal(files.get('a.yml'), first);
});
await check('failed snippet edit restores memory and leaves no undo entry', async () => {
  const [a] = setupStore(); failWrite = 'a.yml';
  await assert.rejects(store.updateMatch('first', { replace: 'changed' }));
  assert.equal(a.matches[0].replace, 'first'); assert.equal(history.undoStack.length, 0); assert.equal(files.get('a.yml'), 'a original');
});
await check('no-op snippet edit writes nothing and records no undo entry', async () => {
  setupStore();
  await store.updateMatch('first', { replace: 'first', trigger: ':hu' });
  assert.deepEqual(writes, []); assert.equal(history.undoStack.length, 0);
});
await check('history store keeps snapshots without re-cloning and supports discard', async () => {
  pinia.setActivePinia(pinia.createPinia());
  const real = load('src/store/useHistoryStore.ts').useHistoryStore();
  const first = { n: 1 }; const second = { n: 2 };
  const token = real.push('a', first, 2); real.push('b', second, 2); real.push('c', { n: 3 }, 2);
  assert.equal(real.undoStack.length, 2); assert.equal(real.undoStack[0].data, second);
  assert.equal(real.discard(token), false);
  const current = { n: 4 }; const undone = real.takeUndo(current, 2);
  assert.equal(undone.label, 'c'); assert.equal(real.redoStack[0].data, current);
  const t2 = real.push('d', { n: 5 }, 2); assert.equal(real.redoStack.length, 0);
  assert.equal(real.discard(t2), true); assert.equal(real.redoStack[0].data, current);
});
console.log(`Editor regression: ${checks} checks passed`);
