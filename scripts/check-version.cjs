const fs = require('node:fs');
const assert = require('node:assert/strict');

function checkVersion(root = '.') {
  const app = JSON.parse(fs.readFileSync(`${root}/src-tauri/tauri.conf.json`, 'utf8'));
  const cargo = fs.readFileSync(`${root}/src-tauri/Cargo.toml`, 'utf8');
  const lock = fs.readFileSync(`${root}/src-tauri/Cargo.lock`, 'utf8');
  const packageBlock = lock.split('[[package]]').find(block => /^name = "chess-stockfish"$/m.test(block));
  assert.match(app.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.equal(cargo.match(/^version = "([^"]+)"/m)?.[1], app.version, 'Cargo and Tauri versions differ');
  assert.equal(packageBlock?.match(/^version = "([^"]+)"/m)?.[1], app.version, 'Cargo lockfile version differs');
  return app.version;
}

if (require.main === module) console.log(`Application version: ${checkVersion()}`);
module.exports = { checkVersion };
