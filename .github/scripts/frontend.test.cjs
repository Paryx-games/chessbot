const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkFrontend } = require('../../scripts/check-frontend.cjs');

test('current frontend assets and controls validate', () => checkFrontend());

test('frontend validation rejects missing assets, controls, duplicate IDs and invalid JavaScript', t => {
  const base = path.resolve('.cache');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'frontend-check-'));
  assert.ok(root.startsWith(base + path.sep));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const html = '<link href="style.css"><script src="app.js"></script><div id="board"></div>';
  const cases = [
    [html + '<img src="missing.png">', '', /ENOENT/],
    [html + '<img src="../escape.png">', '', /must be local/],
    [html + '<div id="board"></div>', '', /Duplicate/],
    [html, "$('#missing')", /Missing frontend element/],
    [html, 'const broken = ;', /Command failed/],
  ];
  for (const [markup, js, expected] of cases) {
    fs.writeFileSync(path.join(root, 'index.html'), markup);
    fs.writeFileSync(path.join(root, 'style.css'), 'body{}');
    fs.writeFileSync(path.join(root, 'app.js'), js);
    assert.throws(() => checkFrontend(root), expected);
  }
});
