const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { moveSoundType } = require('../../frontend/sounds.js');
test('move sounds distinguish ordinary moves, captures, en passant, and both castling directions', () => {
  const grid = Array(64).fill(''); grid[60] = 'K'; grid[4] = 'k'; grid[28] = 'P'; grid[21] = 'n';
  assert.equal(moveSoundType(grid, 28, 20, '-'), 'move');
  assert.equal(moveSoundType(grid, 28, 21, '-'), 'capture');
  assert.equal(moveSoundType(grid, 28, 19, 'd6'), 'capture');
  assert.equal(moveSoundType(grid, 28, 19, '-'), 'move');
  for (const [from, to] of [[60,62],[60,58],[4,6],[4,2]]) assert.equal(moveSoundType(grid, from, to, '-'), 'castle');
});
test('all four supplied audio files are included in the frontend unchanged', () => {
  for (const name of ['move','capture','castle','check']) {
    assert.deepEqual(fs.readFileSync(`frontend/sounds/${name}.mp3`), fs.readFileSync(`sounds/${name}.mp3`));
  }
});
