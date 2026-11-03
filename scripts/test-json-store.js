const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createJsonStore } = require('../src/json-store');

function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'donedog-storage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { file: path.join(dir, 'nested', 'tasks.json'), store: createJsonStore(options) };
}

test('first launch creates the data folder without a false warning', t => {
  const { file, store } = fixture(t);
  assert.deepEqual(store.read(file, []), []);
  assert.deepEqual(store.status(), []);
  assert.equal(store.write(file, [{ text: 'First task' }]), true);
  assert.deepEqual(store.read(file, []), [{ text: 'First task' }]);
});

test('truncated primary recovers the previous revision and preserves damaged bytes', t => {
  const { file, store } = fixture(t);
  store.write(file, ['first']); store.write(file, ['second']);
  fs.writeFileSync(file, '[broken');
  assert.deepEqual(store.read(file, []), ['first']);
  assert.equal(store.status()[0].kind, 'recovered');
  assert.equal(store.write(file, ['recovered and edited']), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak')), ['first']);
  const corrupt = fs.readdirSync(path.dirname(file)).find(name => name.includes('.corrupt-'));
  assert.equal(fs.readFileSync(path.join(path.dirname(file), corrupt), 'utf8'), '[broken');
});

test('missing primary recovers from backup', t => {
  const { file, store } = fixture(t);
  store.write(file, ['first']); store.write(file, ['second']); fs.unlinkSync(file);
  assert.deepEqual(store.read(file, []), ['first']);
  assert.equal(store.status()[0].kind, 'recovered');
});

test('null or a wrong JSON container falls back to the valid backup', t => {
  const { file, store } = fixture(t);
  store.write(file, ['valid']); store.write(file, ['latest']);
  for (const invalid of ['null', '{}', '42']) {
    fs.writeFileSync(file, invalid);
    assert.deepEqual(store.read(file, []), ['valid']);
  }
});

test('unrecoverable damage is reported and retained when new data is written', t => {
  const { file, store } = fixture(t);
  store.write(file, ['initial']); fs.writeFileSync(file, '{');
  assert.deepEqual(store.read(file, []), []);
  assert.equal(store.status()[0].kind, 'unreadable');
  store.write(file, ['new']);
  assert.ok(fs.readdirSync(path.dirname(file)).some(name => name.includes('.corrupt-')));
});

test('failed replacement keeps the original and retry saves the latest pending edit', t => {
  let fail = false;
  const io = { ...fs, renameSync: (from, to) => {
    if (fail && to.endsWith('tasks.json')) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    return fs.renameSync(from, to);
  } };
  const { file, store } = fixture(t, { io });
  store.write(file, ['original']); fail = true;
  assert.equal(store.write(file, ['edit']), false);
  assert.equal(store.write(file, ['latest edit']), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), ['original']);
  assert.equal(fs.existsSync(file + '.tmp'), false);
  assert.equal(store.status().filter(item => item.kind === 'save-failed').length, 1);
  fail = false;
  assert.deepEqual(store.retry(), []);
  assert.deepEqual(store.read(file, []), ['latest edit']);
});

test('failure to preserve a damaged file prevents overwriting it', t => {
  const { file, store } = fixture(t, { io: { ...fs, copyFileSync: () => { throw new Error('access denied'); } } });
  store.write(file, ['original']); fs.writeFileSync(file, '{damaged');
  assert.equal(store.write(file, ['new']), false);
  assert.equal(fs.readFileSync(file, 'utf8'), '{damaged');
});

test('schema-invalid writes do not replace saved data', t => {
  const { file, store } = fixture(t, { validators: { 'tasks.json': v => Array.isArray(v) && v.every(x => typeof x === 'string') } });
  store.write(file, ['valid']);
  assert.equal(store.write(file, [null]), false);
  assert.deepEqual(store.read(file, []), ['valid']);
});
