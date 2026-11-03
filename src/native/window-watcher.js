const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

function watcherScriptPath({ isPackaged, resourcesPath, sourceDir }) {
  // PowerShell is external to Electron and cannot read virtual ASAR paths.
  return isPackaged
    ? path.join(resourcesPath, 'app.asar.unpacked', 'src', 'native', 'window-watcher.ps1')
    : path.join(sourceDir, 'native', 'window-watcher.ps1');
}

class WindowWatcher {
  constructor(scriptPath, { spawnProcess = spawn, restartDelayMs = 5000, onFailure = () => {} } = {}) {
    this.scriptPath = scriptPath;
    this.spawnProcess = spawnProcess;
    this.restartDelayMs = restartDelayMs;
    this.onFailure = onFailure;
    this.current = null;
    this.restartTimer = null;
    this.stopped = false;
  }

  start() {
    if (this.stopped || this.current) return;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    let child;
    try {
      child = this.spawnProcess('powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath],
        { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    } catch (error) {
      this.onFailure(error);
      this.scheduleRestart();
      return;
    }
    const state = { child, pending: [], reader: null, closed: false };
    this.current = state;
    const fail = error => this.disconnect(state, error);
    // Stream errors are asynchronous: a try/catch around write() is insufficient.
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stdout.on('error', fail);
    child.once('exit', () => fail(new Error('Window watcher exited')));
    child.once('close', () => fail(new Error('Window watcher closed')));
    state.reader = readline.createInterface({ input: child.stdout });
    state.reader.on('error', fail);
    state.reader.on('close', () => fail(new Error('Window watcher output closed')));
    state.reader.on('line', line => {
      if (state.closed) return;
      let value;
      try { value = JSON.parse(line); }
      catch (error) { fail(error); return; }
      const request = state.pending.shift();
      if (request) request.finish(value);
    });
  }

  call(command, timeoutMs = 8000) {
    const state = this.current;
    if (this.stopped || !state || state.closed) return Promise.resolve(null);
    const { child } = state;
    if (child.exitCode !== null || child.stdin.destroyed || child.stdin.writableEnded || !child.stdin.writable) {
      this.disconnect(state, new Error('Window watcher input is unavailable'));
      return Promise.resolve(null);
    }
    let payload;
    try { payload = JSON.stringify(command) + '\n'; }
    catch { return Promise.resolve(null); }
    return new Promise(resolve => {
      let timer;
      let done = false;
      const request = { finish(value) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      } };
      timer = setTimeout(() => {
        // A late FIFO response must never be assigned to the next request.
        this.disconnect(state, new Error('Window watcher timed out'));
      }, timeoutMs);
      state.pending.push(request);
      try {
        child.stdin.write(payload, error => {
          if (error) this.disconnect(state, error);
        });
      } catch (error) { this.disconnect(state, error); }
    });
  }

  disconnect(state, error) {
    if (state.closed) return;
    state.closed = true;
    if (this.current === state) this.current = null;
    for (const request of state.pending.splice(0)) request.finish(null);
    if (state.reader) state.reader.close();
    state.child.stdin.destroy();
    state.child.stdout.destroy();
    try { state.child.kill(); } catch {}
    // Old process callbacks can arrive after a replacement has started.
    // Their listeners stay installed, but the closed guard makes them harmless.
    if (!this.stopped) {
      this.onFailure(error);
      this.scheduleRestart();
    }
  }

  scheduleRestart() {
    if (this.stopped || this.current || this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start();
    }, this.restartDelayMs);
    this.restartTimer.unref();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.current) this.disconnect(this.current);
  }
}

module.exports = { WindowWatcher, watcherScriptPath };
