const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createActivityTracker } = require('../src/renderer/activity-core');

test('foreground time uses elapsed samples, without inventing time before the first one', () => {
  const tracker = createActivityTracker();
  const sample = now => tracker.sample({ now, title: 'YouTube - Opera', key: 'youtube' });
  assert.equal(sample(1000).seconds, 0);
  assert.equal(sample(3000).seconds, 2);
  assert.equal(sample(4800).seconds, 1.8);
});

test('switches, long gaps and idle periods are not credited to the new window', () => {
  const tracker = createActivityTracker();
  tracker.sample({ now: 0, title: 'YouTube', key: 'youtube' });
  assert.equal(tracker.sample({ now: 1600, title: 'Editor', key: 'code' }).seconds, 0);
  assert.equal(tracker.sample({ now: 60000, title: 'Editor', key: 'code' }).seconds, 0);
  assert.equal(tracker.sample({ now: 61600, title: 'Editor', key: 'code', idleSeconds: 120 }).seconds, 0);
  assert.equal(tracker.sample({ now: 63200, title: 'Editor', key: 'code', idleSeconds: 0 }).seconds, 0);
  assert.equal(tracker.sample({ now: 64800, title: 'Editor', key: 'code' }).seconds, 1.6);
});

test('visit duration and learned sessions only include observed foreground intervals', () => {
  const tracker = createActivityTracker();
  let result;
  for (let now = 0; now <= 64000; now += 2000) result = tracker.sample({ now, title: 'YouTube', key: 'youtube' });
  assert.equal(result.sessionSeconds, 64);
  const visit = result.visit;
  result = tracker.sample({ now: 66000, title: 'Editor', key: 'code' });
  assert.deepEqual(result.ended, { key: 'youtube', seconds: 64 });
  assert.notEqual(result.visit, visit);
  assert.equal(result.sessionSeconds, 0);
});

function brain(language = 'fr') {
  const context = vm.createContext({ window: { __lang: language } });
  for (const name of ['phrases.js', 'brain.js', 'roast-engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer', name), 'utf8'), context);
  }
  return source => vm.runInContext(source, context);
}

test('a background video does not inflate reported leisure time', () => {
  const run = brain();
  assert.equal(run("minutesOf({ apps: { youtube: 7200 }, fg: { youtube: 120, code: 600 } }, d => d.procrastination)"), 2);
  assert.equal(run("minutesOf({ apps: { youtube: 7200 } }, d => d.procrastination)"), 0);
});

test('foreground observations have a real app label in both languages', () => {
  for (const language of ['fr', 'en']) {
    const run = brain(language);
    const text = run(`intelCandidates({ journal: { [todayKey()]: { apps: {}, fg: { youtube: 600 }, done: 0 } } }).find(q => q.key === 'i-proc').text`);
    assert.match(text, /YouTube/);
    assert.doesNotMatch(text, /undefined/);
  }
});

test('composed remarks remain brief even with task details and historical callbacks', () => {
  for (const language of ['fr', 'en']) {
    const run = brain(language);
    run(`var facts = { appLabel: 'YouTube', openCount: 5, escalation: 2, appMinToday: 100,
      avgSession: 30, sessionCount: 4, oldestTask: { text: 'Préparer le dossier pour la réunion', days: 3 },
      pendingCount: 6, doneToday: 0, hour: 17, yesterdayAppMin: 50, switches10: 30,
      distractionToday: 100, chronoActive: true, chronoTask: 'Préparer le dossier',
      worstDay: { label: 'Lundi', min: 90 } }; var said = {};`);
    for (let i = 0; i < 100; i++) {
      const text = run('composeRoast(facts, said)');
      assert.ok(text.length <= 240, `${language} remark is too long (${text.length})`);
      assert.doesNotMatch(text, /undefined/);
    }
  }
});
