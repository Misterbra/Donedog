const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Keep one previous valid revision. Never replace it with a damaged document.
function createJsonStore({ io = fs, validators = {}, onStatus = () => {} } = {}) {
  const notices = new Map();
  const pending = new Map();
  const status = () => [...notices.values()];
  function notice(file, kind) {
    const key = file + (kind === 'save-failed' ? ':save' : ':read');
    if (notices.get(key)?.kind === kind) return;
    notices.set(key, { file: path.basename(file), kind });
    onStatus(status());
  }
  function parse(file, raw, fallback) {
    const value = JSON.parse(raw);
    const valid = validators[path.basename(file)] || (v => fallback == null ||
      (Array.isArray(fallback) ? Array.isArray(v) :
        typeof fallback === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) :
          typeof v === typeof fallback));
    if (!valid(value)) throw new SyntaxError('Invalid data structure');
    return value;
  }
  function read(file, fallback) {
    let originalError;
    try { return parse(file, io.readFileSync(file, 'utf8'), fallback); }
    catch (error) { originalError = error; }
    try {
      const recovered = parse(file, io.readFileSync(file + '.bak', 'utf8'), fallback);
      notice(file, 'recovered');
      return recovered;
    } catch (backupError) {
      if (originalError.code !== 'ENOENT' || backupError.code !== 'ENOENT') notice(file, 'unreadable');
      return fallback;
    }
  }
  function atomic(file, contents) {
    const tmp = file + '.tmp';
    let fd;
    try {
      fd = io.openSync(tmp, 'w');
      io.writeFileSync(fd, contents, 'utf8');
      io.fsyncSync(fd);
      io.closeSync(fd); fd = undefined;
      io.renameSync(tmp, file);
    } finally {
      if (fd !== undefined) io.closeSync(fd);
      try { io.unlinkSync(tmp); } catch {}
    }
  }
  function write(file, data) {
    pending.set(file, data);
    try {
      const contents = JSON.stringify(data, null, 2);
      parse(file, contents, data);
      io.mkdirSync(path.dirname(file), { recursive: true });
      let old;
      try { old = io.readFileSync(file, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (old !== undefined && old !== contents) {
        let valid = true;
        try { parse(file, old, data); } catch { valid = false; }
        if (valid) atomic(file + '.bak', old);
        else {
          // Preserve damaged bytes for manual recovery before replacing them.
          io.copyFileSync(file, file + '.corrupt-' + randomUUID(), fs.constants.COPYFILE_EXCL);
        }
      }
      atomic(file, contents);
      pending.delete(file);
      if (notices.delete(file + ':save')) onStatus(status());
      return true;
    } catch {
      notice(file, 'save-failed');
      return false;
    }
  }
  function retry() {
    for (const [file, data] of [...pending]) write(file, data);
    return status();
  }
  return { read, write, status, retry };
}

module.exports = { createJsonStore };
