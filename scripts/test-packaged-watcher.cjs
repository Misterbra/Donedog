// Check the actual built archive AND its unpacked PowerShell file using Node,
// which (like PowerShell) cannot treat app.asar as a directory.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const asar = require('@electron/asar');

async function main() {
  const resourcesPath = path.resolve(process.argv[2] || 'dist/win-unpacked/resources');
  const archive = path.join(resourcesPath, 'app.asar');
  const exports = { exports: {} };
  const source = asar.extractFile(archive, path.join('src', 'native', 'window-watcher.js')).toString('utf8');
  vm.runInNewContext(source, { require, module: exports, setTimeout, clearTimeout }, { filename: 'packaged-window-watcher.js' });
  const { WindowWatcher, watcherScriptPath } = exports.exports;
  const script = watcherScriptPath({ isPackaged: true, resourcesPath });
  assert.equal(fs.existsSync(script), true, 'The external PowerShell script must exist on disk');
  assert.equal(fs.readFileSync(script, 'utf8'), fs.readFileSync('src/native/window-watcher.ps1', 'utf8'));
  const children = [];
  const watcher = new WindowWatcher(script, {
    restartDelayMs: 50,
    spawnProcess: (...args) => { const child = spawn(...args); children.push(child); return child; }
  });
  try {
    watcher.start();
    const first = await watcher.call({ op: 'windows' }, 15000);
    assert.equal(first?.ok, true, 'Packaged script responds to the real Windows request');
    assert.ok(Array.isArray(first.data));
    console.log(`PASS: packaged watcher reads Windows (${first.data.length} windows; titles not logged).`);
    children[0].kill();
    for (let i = 0; i < 100 && children.length < 2; i++) await delay(20);
    assert.equal(children.length, 2, 'Watcher restarts after the actual child is killed');
    const recovered = await watcher.call({ op: 'windows' }, 15000);
    assert.equal(recovered?.ok, true);
    console.log('PASS: actual PowerShell termination and restart, no EPIPE crash.');
  } finally { watcher.stop(); }

  // Reproduce the original invalid-ASAR-path failure; it must now be nonfatal.
  const missing = new WindowWatcher(path.join(resourcesPath, 'app.asar', 'src', 'native', 'window-watcher.ps1'));
  try {
    missing.start();
    assert.equal(await missing.call({ op: 'windows' }, 10000), null);
    console.log('PASS: missing script is handled without an uncaught exception.');
  } finally { missing.stop(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
