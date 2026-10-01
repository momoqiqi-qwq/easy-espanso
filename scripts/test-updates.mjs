import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Compile the pure release helpers with small boundary stubs: no network or desktop required.
const source = fs.readFileSync(new URL('../src/services/updateService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(() => ({}), exports);
const { isNewerVersion, downloadableAssets, openReleaseUrl } = exports;
for (const [latest, current, expected] of [
  ['v1.2.4', '1.2.3', true], ['v1.10.0', '1.9.9', true],
  ['1.2.3', '1.2.3', false], ['1.2.2', '1.2.3', false],
  ['1.2.3', '1.2.3-beta.2', true], ['1.2.3-beta.2', '1.2.3', false],
  ['1.2.3-beta.10', '1.2.3-beta.2', true], ['1.2.3+build.1', '1.2.3', false],
]) assert.equal(isNewerVersion(latest, current), expected, `${latest} vs ${current}`);
assert.throws(() => isNewerVersion('release-main', '1.2.3'));
assert.deepEqual(downloadableAssets({ assets: [
  { name: 'app.exe' }, { name: 'app.dmg' }, { name: 'app.AppImage' },
  { name: 'app.tar.gz' }, { name: 'app.exe.sig' }, { name: 'latest.json' },
] }).map(a => a.name), ['app.exe', 'app.dmg', 'app.AppImage', 'app.tar.gz']);
await assert.rejects(openReleaseUrl('https://github.com.evil.test/momoqiqi-qwq/easy-espanso/releases'));
await assert.rejects(openReleaseUrl('http://github.com/momoqiqi-qwq/easy-espanso/releases'));
console.log('Update helpers: 12 checks passed');
