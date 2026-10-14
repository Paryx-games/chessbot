const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTag, changelogNotes, confirmTag } = require('./release.cjs');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

test('release tags match the application version and classify prereleases', () => {
  assert.deepEqual(validateTag('v0.1.0', '0.1.0'), { prerelease: false, makeLatest: true });
  assert.equal(validateTag('v0.2.0-rc.1', '0.2.0-rc.1').prerelease, true);
  for (const tag of ['main', '--help', 'v0.1.0\nrun', 'v0.1.1']) assert.throws(() => validateTag(tag, '0.1.0'));
});
test('release notes select only the matching maintained changelog section', () => {
  const text = '# Changes\n\n## Unreleased\n\nFuture\n\n## 0.1.0\n\n### Added\n\n- Board editor\n\n## 0.0.1\n\nOlder';
  assert.equal(changelogNotes(text, 'v0.1.0'), '### Added\n\n- Board editor');
  assert.throws(() => changelogNotes(text, 'v0.2.0'));
  assert.throws(() => changelogNotes('## 0.1.0\n\n### Added', 'v0.1.0'));
});
test('publication rejects moved tags and resolves annotated tags', async () => {
  process.env.RELEASE_TAG = 'v0.1.0'; process.env.RELEASE_SHA = 'expected';
  const context = { repo: { owner: 'test', repo: 'chessbot' } };
  const github = { rest: { git: {
    getRef: async () => ({ data: { object: { type: 'tag', sha: 'annotation' } } }),
    getTag: async () => ({ data: { object: { type: 'commit', sha: 'expected' } } }),
  } } };
  await confirmTag({ github, context });
  process.env.RELEASE_SHA = 'moved';
  await assert.rejects(confirmTag({ github, context }), /tag moved/);
  delete process.env.RELEASE_TAG; delete process.env.RELEASE_SHA;
});

test('release notes describe installer, portable, and source downloads accurately', () => {
  const root = path.resolve('.cache', `release-notes-test-${crypto.randomUUID()}`);
  fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'release'));
  fs.writeFileSync(path.join(root, 'notes/release-notes.md'), '- Synthetic release change\n');
  for (const name of ['chessbot-v0.1.0-windows-x64-setup.exe', 'chessbot-v0.1.0-windows-x64-portable.zip', 'Stockfish-sf_19-source.zip']) {
    fs.writeFileSync(path.join(root, 'release', name), 'Synthetic artifact');
  }
  fs.writeFileSync(path.join(root, 'release/SHA256SUMS.txt'), 'synthetic checksum\n');
  execFileSync(process.execPath, [path.resolve('scripts/write-release-notes.cjs')], {
    cwd: root, env: { ...process.env, RELEASE_TAG: 'v0.1.0', RELEASE_SHA: 'synthetic-sha', GITHUB_REPOSITORY: 'Paryx-games/chessbot' },
  });
  const notes = fs.readFileSync(path.join(root, 'final-release-notes.md'), 'utf8');
  assert.match(notes, /releases\/download\/v0\.1\.0\/chessbot-v0\.1\.0-windows-x64-setup\.exe/);
  assert.match(notes, /extract everything and keep Stockfish alongside the app/);
  assert.match(notes, /synthetic-sha/);
  assert.match(notes, /unsigned/);
  assert.match(notes, /https:\/\/ko-fi.com\/paryx/);
});
