// Inspect the exact executable ZIP and ASAR before publishing any download.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const asar = require('@electron/asar');
const { version } = require('../package.json');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const base = 'DoneDog-Windows-x64';
const zip = path.join(dist, base + '.zip');
const exe = path.join(dist, base + '.exe');
const extracted = fs.mkdtempSync(path.join(dist, 'verify-zip-'));
const privateValues = [os.homedir(), root];
const keysFile = path.join(root, 'gemini-keys.json');
if (fs.existsSync(keysFile)) privateValues.push(...JSON.parse(fs.readFileSync(keysFile, 'utf8')));
function checkPrivate(buffer, name) {
  for (const value of privateValues.filter(v => typeof v === 'string' && v.length > 8)) {
    for (const encoding of ['utf8', 'utf16le']) assert.equal(buffer.includes(Buffer.from(value, encoding)), false, 'Private value in ' + name);
  }
}
try {
  for (const file of [zip, exe]) assert.ok(fs.statSync(file).size > 1000000, 'Missing or empty download');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Expand-Archive -LiteralPath $env:DONEDOG_VERIFY_ZIP -DestinationPath $env:DONEDOG_VERIFY_DIR'], {
    windowsHide: true, encoding: 'utf8', env: { ...process.env, DONEDOG_VERIFY_ZIP: zip, DONEDOG_VERIFY_DIR: extracted }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(extracted, 'DoneDog.exe')).toString('ascii', 0, 2), 'MZ');
  const resources = path.join(extracted, 'resources');
  const archive = path.join(resources, 'app.asar');
  assert.ok(fs.readFileSync(archive).equals(fs.readFileSync(path.join(dist, 'win-unpacked/resources/app.asar'))), 'ZIP must contain the verified build');
  let voices = 0;
  for (const entry of asar.listPackage(archive)) {
    const name = entry.replace(/^[/\\]+/, '').replaceAll('\\', '/');
    const archiveName = name.split('/').join(path.sep);
    if (asar.statFile(archive, archiveName).files) continue;
    assert.match(name, /^(src\/|assets\/|package\.json$)/);
    assert.doesNotMatch(name, /gemini-keys|tts-cache|\.bak$|\.corrupt-|(?:^|\/)(tasks|settings|missions)\.json/i);
    const data = asar.extractFile(archive, archiveName);
    checkPrivate(data, name);
    if (name === 'package.json') assert.equal(JSON.parse(data).version, version);
    else assert.ok(data.equals(fs.readFileSync(path.join(root, name))), 'Source mismatch: ' + name);
    if (name.endsWith('.wav')) voices++;
  }
  assert.equal(voices, 66, 'Both languages must ship with all 33 voices');
  const watcher = spawnSync(process.execPath, [path.join(__dirname, 'test-packaged-watcher.cjs'), resources], { encoding: 'utf8', windowsHide: true });
  assert.equal(watcher.status, 0, watcher.stdout + watcher.stderr);
  const sums = [exe, zip].map(file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') + '  ' + path.basename(file));
  fs.writeFileSync(path.join(dist, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
  console.log('PASS: installer, executable ZIP, matching sources, 66 voices, no private values, ZIP PowerShell helper and SHA-256 checksums.');
} finally {
  // mkdtemp creates this directory under dist; never remove a user-supplied path.
  assert.equal(path.dirname(extracted), dist);
  fs.rmSync(extracted, { recursive: true, force: true });
}
