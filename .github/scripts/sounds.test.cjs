const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SOUND_NAMES, moveSoundType, completedMoveSound } = require('../../frontend/sounds.js');
const { soundFiles, syncSounds } = require('../../scripts/sync-sounds.cjs');

test('move sounds distinguish self/opponent moves, captures, en passant, promotion, and castling', () => {
  const grid = Array(64).fill(''); grid[60] = 'K'; grid[4] = 'k'; grid[28] = 'P'; grid[21] = 'n'; grid[8] = 'P';
  assert.equal(moveSoundType(grid, 28, 20, '-'), 'move-self');
  assert.equal(moveSoundType(grid, 28, 20, '-', true), 'move-opponent');
  assert.equal(moveSoundType(grid, 28, 21, '-'), 'capture');
  assert.equal(moveSoundType(grid, 28, 19, 'd6'), 'capture');
  assert.equal(moveSoundType(grid, 28, 19, '-'), 'move-self');
  assert.equal(moveSoundType(grid, 8, 0, '-'), 'promote');
  for (const [from, to] of [[60,62],[60,58],[4,6],[4,2]]) assert.equal(moveSoundType(grid, from, to, '-'), 'castle');
});

test('completed move cues prioritize checkmate, promotion, and checking moves', () => {
  assert.equal(completedMoveSound('capture', { kind: 'checkmate', checked_square: 0 }), 'check');
  assert.equal(completedMoveSound('promote', { kind: 'check', checked_square: 0 }), 'promote');
  assert.equal(completedMoveSound('move-self', { kind: 'check', checked_square: 0 }), 'move-check');
  assert.equal(completedMoveSound('castle', { kind: 'playing', checked_square: null }), 'castle');
});

test('every source sound asset, including nested files, is bundled unchanged without obsolete files', () => {
  const source = soundFiles('sounds');
  assert.deepEqual(soundFiles('frontend/sounds'), source, 'Run node scripts/sync-sounds.cjs');
  for (const name of source) assert.deepEqual(fs.readFileSync(`frontend/sounds/${name}`), fs.readFileSync(`sounds/${name}`));
  for (const cue of SOUND_NAMES) assert.ok(source.includes(cue + '.mp3'));
});

test('sound synchronization copies nested assets and removes stale generated files', t => {
  const base = path.resolve('.cache'); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'sound-sync-test-'));
  assert.ok(root.startsWith(base + path.sep));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'sounds/nested'), { recursive: true });
  fs.mkdirSync(path.join(root, 'frontend/sounds'), { recursive: true });
  fs.writeFileSync(path.join(root, 'sounds/nested/cue.mp3'), 'synthetic sound');
  fs.writeFileSync(path.join(root, 'sounds/LICENSE.txt'), 'synthetic license');
  fs.writeFileSync(path.join(root, 'frontend/sounds/obsolete.mp3'), 'old');
  assert.deepEqual(syncSounds(root), ['LICENSE.txt', 'nested/cue.mp3']);
  assert.deepEqual(soundFiles(path.join(root, 'frontend/sounds')), ['LICENSE.txt', 'nested/cue.mp3']);
  assert.equal(fs.readFileSync(path.join(root, 'frontend/sounds/nested/cue.mp3'), 'utf8'), 'synthetic sound');
});
