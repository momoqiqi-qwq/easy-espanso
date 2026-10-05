import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Compile the pure release helpers with small boundary stubs: no network or desktop required.
const source = fs.readFileSync(new URL('../src/services/updateService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(() => ({}), exports);
const {
  isNewerVersion, downloadableAssets, openReleaseUrl,
  pickInstallerAsset, isVersionSkipped, normalizeVersion,
} = exports;

let checks = 0;
const check = (label, fn) => { fn(); checks += 1; return label; };

// --- 版本比较 ---
for (const [latest, current, expected] of [
  ['v1.2.4', '1.2.3', true], ['v1.10.0', '1.9.9', true],
  ['1.2.3', '1.2.3', false], ['1.2.2', '1.2.3', false],
  ['1.2.3', '1.2.3-beta.2', true], ['1.2.3-beta.2', '1.2.3', false],
  ['1.2.3-beta.10', '1.2.3-beta.2', true], ['1.2.3+build.1', '1.2.3', false],
]) assert.equal(isNewerVersion(latest, current), expected, `${latest} vs ${current}`);
checks += 8;
assert.throws(() => isNewerVersion('release-main', '1.2.3'));
checks += 1;

// --- 可下载资产过滤 ---
assert.deepEqual(downloadableAssets({ assets: [
  { name: 'app.exe' }, { name: 'app.dmg' }, { name: 'app.AppImage' },
  { name: 'app.tar.gz' }, { name: 'app.exe.sig' }, { name: 'latest.json' },
] }).map(a => a.name), ['app.exe', 'app.dmg', 'app.AppImage', 'app.tar.gz']);
checks += 1;

// --- 自动更新：优先挑 NSIS 安装包 ---
const asset = name => ({ name, browser_download_url: `https://github.com/momoqiqi-qwq/easy-espanso/releases/download/v1/E${name}`, size: 1 });
check('pickInstallerAsset', () => {
  assert.equal(pickInstallerAsset({ assets: [asset('portable.exe'), asset('App_1.0.0_x64-setup.exe')] }).name, 'App_1.0.0_x64-setup.exe');
  assert.equal(pickInstallerAsset({ assets: [asset('portable.exe')] }).name, 'portable.exe');
  assert.equal(pickInstallerAsset({ assets: [asset('app.msi')] }).name, 'app.msi');
  assert.equal(pickInstallerAsset({ assets: [asset('app.dmg'), asset('app.AppImage')] }), null);
  assert.equal(pickInstallerAsset({ assets: [] }), null);
});

// --- 「不再提醒」按版本忽略 ---
check('isVersionSkipped', () => {
  assert.equal(isVersionSkipped('v1.3.1', 'v1.3.1'), true);
  assert.equal(isVersionSkipped('v1.3.1', '1.3.1'), true, 'leading v should not matter');
  assert.equal(isVersionSkipped('1.3.1', 'v1.3.1'), true);
  assert.equal(isVersionSkipped('v1.3.1', 'v1.3.0'), false, 'a newer version must be announced again');
  assert.equal(isVersionSkipped('v1.3.1', ''), false);
  assert.equal(isVersionSkipped('v1.3.1', undefined), false);
  assert.equal(normalizeVersion(' v1.3.0 '), '1.3.0');
});

// --- 下载地址白名单 ---
await assert.rejects(openReleaseUrl('https://github.com.evil.test/momoqiqi-qwq/easy-espanso/releases'));
await assert.rejects(openReleaseUrl('http://github.com/momoqiqi-qwq/easy-espanso/releases'));
checks += 2;

// --- 实时校验：真实 GitHub API 必须能取到带 Windows 安装包的正式版本 ---
if (process.argv.includes('--offline')) {
  console.log('(skipped live GitHub check: --offline)');
} else {
  const response = await fetch('https://api.github.com/repos/momoqiqi-qwq/easy-espanso/releases/latest', {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'easy-espanso-regression' },
  });
  assert.equal(response.status, 200, `GitHub API returned ${response.status}`);
  const release = await response.json();
  assert.match(release.tag_name, /^v\d+\.\d+\.\d+/, `unexpected tag: ${release.tag_name}`);
  assert.equal(release.draft, false, 'latest release must not be a draft');
  assert.equal(release.prerelease, false, 'latest release must not be a prerelease');
  const installer = pickInstallerAsset(release);
  assert.ok(installer, 'latest release must expose a Windows installer');
  assert.match(installer.browser_download_url, /^https:\/\/github\.com\/momoqiqi-qwq\/easy-espanso\/releases\/download\//);
  assert.ok(installer.size > 0, 'installer size should be positive');
  assert.equal(isNewerVersion(release.tag_name, release.tag_name), false, 'same version must not prompt');
  assert.equal(isNewerVersion(release.tag_name, '1.0.0'), true, 'older local version must prompt');
  checks += 8;
  console.log(`live GitHub check: latest=${release.tag_name} installer=${installer.name} (${installer.size} bytes)`);
}

console.log(`Update helpers: ${checks} checks passed`);
