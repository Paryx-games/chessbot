const fs = require('node:fs');
const path = require('node:path');
const tag = process.env.RELEASE_TAG;
if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) throw new Error('Invalid release tag');
const repo = process.env.GITHUB_REPOSITORY;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Invalid repository');
const assets = fs.readdirSync('release').filter(name => /\.(exe|zip)$/.test(name)).sort();
const describe = name => name.endsWith('-setup.exe') ? 'Windows x64 installer (recommended)'
  : name.endsWith('-portable.zip') ? 'Portable folder; extract everything and keep Stockfish alongside the app'
  : name.startsWith('Stockfish-') ? 'Corresponding Stockfish source'
  : (() => { throw new Error(`Unexpected release download: ${name}`); })();
const lines = [
  fs.readFileSync('notes/release-notes.md', 'utf8').trim(), '', '## Downloads', '',
  '| File | Use case |', '| --- | --- |',
  ...assets.map(name => `| [${path.basename(name)}](https://github.com/${repo}/releases/download/${tag}/${name}) | ${describe(name)} |`),
  '', 'Windows x64 and Microsoft WebView2 Runtime are required. The installer can install WebView2 if missing. Portable users need the runtime installed already.',
  '', '## SHA-256', '', 'Compare downloaded files with `Get-FileHash -Algorithm SHA256`. Full checksums are included in `SHA256SUMS.txt`.',
  '', '```text', fs.readFileSync('release/SHA256SUMS.txt', 'utf8').trim(), '```',
  '', `Built from commit \`${process.env.RELEASE_SHA}\`. These builds are unsigned.`,
  '', '[Support development on Ko-fi](https://ko-fi.com/paryx).', '',
];
fs.writeFileSync('final-release-notes.md', lines.join('\n'));
