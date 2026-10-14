const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

test('portable packaging includes sidecar, licenses, source, commit, and matching checksums', { skip: process.platform !== 'win32' }, () => {
  const root = path.resolve('.cache', `package-test-${crypto.randomUUID()}`);
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync('scripts/package-release.ps1', path.join(root, 'scripts/package-release.ps1'));
  const release = path.join(root, 'src-tauri/target/release');
  fs.mkdirSync(path.join(release, 'bundle/nsis'), { recursive: true });
  fs.mkdirSync(path.join(release, 'licenses'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src-tauri/tauri.conf.json'), JSON.stringify({ version: '1.0.0' }));
  fs.writeFileSync(path.join(root, 'README.md'), 'Synthetic packaging fixture\n');
  fs.writeFileSync(path.join(root, '.gitignore'), 'src-tauri/target/\n.cache/\n');
  for (const name of ['chessbot.exe', 'stockfish.exe', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.writeFileSync(path.join(release, name), `Synthetic ${name}\n`);
  }
  fs.writeFileSync(path.join(release, 'bundle/nsis/Chessbot_1.0.0_x64-setup.exe'), 'Synthetic installer');
  fs.writeFileSync(path.join(release, 'bundle/nsis/Chessbot_0.9.0_x64-setup.exe'), 'Stale installer');
  fs.writeFileSync(path.join(release, 'licenses/Stockfish-sf_19-source.zip'), 'Synthetic engine source');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '--quiet']); git(['add', 'README.md', '.gitignore', 'scripts', 'src-tauri/tauri.conf.json']);
  git(['-c', 'user.name=Packaging Test', '-c', 'user.email=packaging@example.invalid', 'commit', '--quiet', '-m', 'test fixture']);
  const run = tag => execFileSync('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/package-release.ps1', '-Tag', tag], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.throws(() => run('v0.2.0'));
  run('v1.0.0');
  const out = path.join(root, '.cache/release');
  assert.equal(fs.readFileSync(path.join(out, 'chessbot-v1.0.0-windows-x64-setup.exe'), 'utf8'), 'Synthetic installer');
  assert.equal(fs.existsSync(path.join(out, 'chessbot-v1.0.0-source.zip')), false);
  for (const line of fs.readFileSync(path.join(out, 'SHA256SUMS.txt'), 'ascii').trim().split(/\r?\n/)) {
    const [, expected, filename] = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(out, filename))).digest('hex'), expected);
  }
  assert.equal(fs.readFileSync(path.join(out, 'COMMIT.txt'), 'utf8').replace(/^\uFEFF/, '').trim(), git(['rev-parse', 'HEAD']));
  const zipPath = path.join(out, 'chessbot-v1.0.0-windows-x64-portable.zip');
  const entries = execFileSync('pwsh', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[IO.Compression.ZipFile]::OpenRead($env:PACKAGE_TEST_ZIP); $zip.Entries.FullName; $zip.Dispose()'], {
    env: { ...process.env, PACKAGE_TEST_ZIP: zipPath }, encoding: 'utf8',
  }).replaceAll('\\', '/');
  for (const name of ['chessbot.exe', 'stockfish.exe', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses/Stockfish-sf_19-source.zip']) assert.ok(entries.includes(name), name);
  assert.throws(() => run('v1.0.0')); // Do not silently mix new output with stale release files.
});
