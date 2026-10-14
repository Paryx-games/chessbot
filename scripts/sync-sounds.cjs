const fs = require('node:fs');
const path = require('node:path');

function soundFiles(directory) {
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Sound directories must be local folders');
  const files = [];
  function visit(folder, prefix = '') {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Sound assets cannot be symbolic links');
      const name = prefix + entry.name;
      if (entry.isDirectory()) visit(path.join(folder, entry.name), name + '/');
      else if (entry.isFile()) files.push(name);
    }
  }
  visit(directory);
  return files.sort();
}
function syncSounds(project = path.resolve(__dirname, '..')) {
  const root = path.resolve(project);
  const source = path.join(root, 'sounds');
  const frontend = path.join(root, 'frontend');
  const target = path.join(frontend, 'sounds');
  if (fs.lstatSync(frontend).isSymbolicLink() || path.relative(root, target) !== path.join('frontend', 'sounds')) throw new Error('Sound destination must stay inside frontend');
  const files = soundFiles(source);
  fs.mkdirSync(target, { recursive: true });
  const wanted = new Set(files);
  // I only prune generated files inside the verified frontend sound directory.
  for (const name of soundFiles(target)) if (!wanted.has(name)) fs.unlinkSync(path.join(target, name));
  function prune(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const child = path.join(folder, entry.name); prune(child);
        if (!fs.readdirSync(child).length) fs.rmdirSync(child);
      }
    }
  }
  prune(target);
  for (const name of files) {
    const output = path.join(target, name);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const input = path.join(source, name);
    if (!fs.existsSync(output) || !fs.readFileSync(input).equals(fs.readFileSync(output))) fs.copyFileSync(input, output);
  }
  return files;
}
if (require.main === module) console.log(`Bundled ${syncSounds().length} sound assets from sounds/.`);
module.exports = { soundFiles, syncSounds };
