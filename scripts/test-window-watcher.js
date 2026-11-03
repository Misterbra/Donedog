const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const { WindowWatcher, watcherScriptPath } = require('../src/native/window-watcher');

function fakeChild(write) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.stdout = new PassThrough();
  child.writes = [];
  child.stdin = new Writable({ write(chunk, encoding, callback) {
    child.writes.push(chunk.toString());
    if (write) write(chunk, callback);
    else callback();
  } });
  child.kills = 0;
  child.kill = () => { child.kills++; return true; };
  return child;
}

function setup(t, options = {}) {
  const children = [];
  const failures = [];
  const watcher = new WindowWatcher('watcher.ps1', {
    restartDelayMs: 10,
    spawnProcess: () => { const child = fakeChild(options.write); children.push(child); return child; },
    onFailure: error => failures.push(error),
    ...options
  });
  t.after(() => watcher.stop());
  watcher.start();
  return { watcher, children, failures };
}

test('packaged PowerShell script has a real unpacked path', () => {
  const path = watcherScriptPath({ isPackaged: true, resourcesPath: 'resources', sourceDir: 'src' });
  assert.match(path, /app\.asar\.unpacked/);
  assert.doesNotMatch(path, /app\.asar[/\\]/);
});

test('window watcher matches each response to its request', async t => {
  const { watcher, children } = setup(t);
  const first = watcher.call({ op: 'first' });
  const second = watcher.call({ op: 'second' });
  children[0].stdout.write('{"ok":true,"id":1}\n{"ok":true,"id":2}\n');
  assert.deepEqual(await first, { ok: true, id: 1 });
  assert.deepEqual(await second, { ok: true, id: 2 });
});

test('asynchronous EPIPE resolves requests without an uncaught stream error', async t => {
  const { watcher, children, failures } = setup(t, { write: (_, callback) => {
    setImmediate(() => callback(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })));
  } });
  const responses = await Promise.all([watcher.call({ op: 'windows' }), watcher.call({ op: 'windows' })]);
  assert.deepEqual(responses, [null, null]);
  await delay(1); // Let Writable emit its separate error event as well.
  assert.equal(failures.length, 1);
  assert.equal(children[0].kills, 1);
});

test('an asynchronous spawn failure is handled and can recover', async t => {
  const { watcher, children, failures } = setup(t);
  const response = watcher.call({ op: 'windows' });
  children[0].emit('error', Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' }));
  assert.equal(await response, null);
  await delay(25);
  assert.equal(children.length, 2);
  const recovered = watcher.call({ op: 'windows' });
  children[1].stdout.write('{"ok":true,"data":[]}\n');
  assert.equal((await recovered).ok, true);
  assert.equal(failures.length, 1);
});

test('synchronous write errors also settle the request', async t => {
  const { watcher, children } = setup(t);
  children[0].stdin.write = () => { throw new Error('stream closed'); };
  assert.equal(await watcher.call({ op: 'windows' }), null);
});

test('timeout drains pending requests and old events cannot stop the replacement', async t => {
  const { watcher, children } = setup(t);
  const first = watcher.call({ op: 'windows' }, 5);
  const second = watcher.call({ op: 'windows' }, 100);
  assert.deepEqual(await Promise.all([first, second]), [null, null]);
  await delay(25);
  assert.equal(children.length, 2);
  const response = watcher.call({ op: 'windows' });
  children[0].emit('exit', 1);
  children[0].emit('close', 1);
  children[0].stdin.emit('error', new Error('late EPIPE'));
  children[1].stdout.write('{"ok":true,"data":[]}\n');
  assert.equal((await response).ok, true);
  assert.equal(children[1].kills, 0);
});

test('closed input and malformed responses fail safely', async t => {
  const { watcher, children } = setup(t);
  const pending = watcher.call({ op: 'windows' });
  children[0].stdout.write('invalid json\n');
  assert.equal(await pending, null);
  await delay(25);
  children[1].stdin.end();
  assert.equal(await watcher.call({ op: 'windows' }), null);
});

test('stop settles requests and prevents delayed restart on application quit', async t => {
  const { watcher, children } = setup(t);
  const response = watcher.call({ op: 'windows' });
  watcher.stop();
  children[0].emit('exit', 0);
  children[0].stdin.emit('error', new Error('closed during shutdown'));
  assert.equal(await response, null);
  await delay(25);
  assert.equal(children.length, 1);
  assert.equal(await watcher.call({ op: 'windows' }), null);
});
