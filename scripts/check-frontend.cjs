const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function checkFrontend(directory = path.resolve(__dirname, '../frontend')) {
  const root = path.resolve(directory);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate frontend element IDs');
  const resources = [...html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const required of ['app.js', 'style.css']) {
    if (!resources.includes(required)) throw new Error(`Missing frontend entry: ${required}`);
  }
  for (const resource of resources) {
    const filename = path.resolve(root, resource);
    const relative = path.relative(root, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative) || /^(?:[a-z]+:|\/)/i.test(resource)) {
      throw new Error(`Frontend resource must be local: ${resource}`);
    }
    if (!fs.statSync(filename).isFile()) throw new Error(`Missing frontend resource: ${resource}`);
  }
  for (const resource of resources.filter(name => name.endsWith('.js'))) {
    execFileSync(process.execPath, ['--check', path.join(root, resource)], { stdio: 'pipe' });
  }
  const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const match of js.matchAll(/\$\(['"]#([a-z][\w-]*)['"]\)/gi)) {
    if (!ids.includes(match[1])) throw new Error(`Missing frontend element: ${match[1]}`);
  }
}

if (require.main === module) {
  checkFrontend();
  console.log('Frontend JavaScript, element references, and local assets passed.');
}
module.exports = { checkFrontend };
