const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/renderer/missions-core.js');

test('parseDuration accepts common formats', () => {
  assert.strictEqual(C.parseDuration('1h30'), 5400);
  assert.strictEqual(C.parseDuration('1h'), 3600);
  assert.strictEqual(C.parseDuration('2h15'), 8100);
  assert.strictEqual(C.parseDuration('90m'), 5400);
  assert.strictEqual(C.parseDuration('90'), 5400);   // plain number = minutes
  assert.strictEqual(C.parseDuration('1:30'), 5400);
  assert.strictEqual(C.parseDuration(' 1H30 '), 5400); // trim + case
});

test('parseDuration rejects garbage', () => {
  assert.strictEqual(C.parseDuration('abc'), null);
  assert.strictEqual(C.parseDuration(''), null);
  assert.strictEqual(C.parseDuration('1h70'), null);   // minutes > 59
  assert.strictEqual(C.parseDuration(null), null);
});

test('formatHM renders hours and zero-padded minutes', () => {
  assert.strictEqual(C.formatHM(0), '0h00');
  assert.strictEqual(C.formatHM(3600), '1h00');
  assert.strictEqual(C.formatHM(4530), '1h15');       // 75.5 min -> 1h15
  assert.strictEqual(C.formatHM(252720), '70h12');    // the spec's example
});

test('formatClock renders HH:MM:SS', () => {
  assert.strictEqual(C.formatClock(0), '00:00:00');
  assert.strictEqual(C.formatClock(8047), '02:14:07');
});

test('localDate builds a local YYYY-MM-DD from a Date', () => {
  assert.strictEqual(C.localDate(new Date(2026, 8, 16, 23, 30)), '2026-09-16');
  assert.strictEqual(C.localDate(new Date(2026, 0, 5, 1, 0)), '2026-01-05');
});

test('totalSeconds sums sessions', () => {
  const mission = { id: 'm_1', sessions: [{ seconds: 3600 }, { seconds: 1800 }] };
  assert.strictEqual(C.totalSeconds(mission, null, Date.now()), 5400);
});

test('totalSeconds adds the live running slice for the same mission', () => {
  const startedAt = new Date(2026, 8, 16, 9, 0, 0).toISOString();
  const now = new Date(2026, 8, 16, 10, 0, 0).getTime();   // +1h
  const mission = { id: 'm_1', sessions: [{ seconds: 3600 }] };
  const running = { missionId: 'm_1', startedAt };
  assert.strictEqual(C.totalSeconds(mission, running, now), 7200);
});

test('totalSeconds ignores a running slice for a different mission', () => {
  const running = { missionId: 'm_OTHER', startedAt: new Date().toISOString() };
  const mission = { id: 'm_1', sessions: [{ seconds: 3600 }] };
  assert.strictEqual(C.totalSeconds(mission, running, Date.now()), 3600);
});

test('perWeekday buckets seconds Monday..Sunday', () => {
  // 2026-09-14 = Monday, 2026-09-16 = Wednesday, 2026-09-20 = Sunday
  const sessions = [
    { date: '2026-09-14', seconds: 3600 },
    { date: '2026-09-14', seconds: 1800 },
    { date: '2026-09-16', seconds: 7200 },
    { date: '2026-09-20', seconds: 900 }
  ];
  const wk = C.perWeekday(sessions);            // index 0=Mon .. 6=Sun
  assert.deepStrictEqual(wk, [5400, 0, 7200, 0, 0, 0, 900]);
});

test('perDate sums seconds per calendar day', () => {
  const sessions = [
    { date: '2026-09-16', seconds: 3600 },
    { date: '2026-09-16', seconds: 1800 },
    { date: '2026-09-17', seconds: 600 }
  ];
  assert.deepStrictEqual(C.perDate(sessions), { '2026-09-16': 5400, '2026-09-17': 600 });
});

test('recoverRunning closes the session at lastTickAt', () => {
  const startedAt = new Date(2026, 8, 16, 9, 0, 0).toISOString();
  const lastTick = new Date(2026, 8, 16, 11, 0, 0).getTime(); // +2h
  const sess = C.recoverRunning({ missionId: 'm_1', startedAt }, lastTick);
  assert.strictEqual(sess.seconds, 7200);
  assert.strictEqual(sess.date, '2026-09-16');
  assert.strictEqual(sess.manual, false);
  assert.strictEqual(sess.end, new Date(lastTick).toISOString());
});

test('recoverRunning returns null when nothing usable', () => {
  assert.strictEqual(C.recoverRunning(null, Date.now()), null);
  const startedAt = new Date(2026, 8, 16, 9, 0, 0).toISOString();
  assert.strictEqual(C.recoverRunning({ missionId: 'm_1', startedAt }, Date.parse(startedAt) - 1000), null);
});

const HOURLY = { billing: { type: 'hourly', rate: 50 }, soldHours: 56 };
const FIXED = { billing: { type: 'fixed', price: 4200 }, soldHours: 56 };
const HOURS = { billing: { type: 'hours' }, soldHours: 56 };

test('revenue by billing type', () => {
  assert.strictEqual(C.revenue(HOURLY, 70), 3500);   // 50 * 70
  assert.strictEqual(C.revenue(FIXED, 70), 4200);    // fixed price
  assert.strictEqual(C.revenue(HOURS, 70), null);    // no money tracked
});

test('effectiveRate by billing type', () => {
  assert.strictEqual(C.effectiveRate(HOURLY, 70), 50);
  assert.strictEqual(C.effectiveRate(FIXED, 70), 60);   // 4200 / 70
  assert.strictEqual(C.effectiveRate(FIXED, 0), null);  // no div-by-zero
  assert.strictEqual(C.effectiveRate(HOURS, 70), null);
});

test('overrun hours + cost', () => {
  assert.deepStrictEqual(C.overrun(HOURLY, 70), { hours: 14, cost: 700 }); // 50 * 14
  assert.deepStrictEqual(C.overrun(FIXED, 70), { hours: 14, cost: 0 });    // forfait: unpaid
  assert.deepStrictEqual(C.overrun(HOURS, 50), { hours: 0, cost: null });  // under budget
});
