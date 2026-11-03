// DoneDog — logique PURE du suivi de missions (aucun DOM).
// Chargé comme global dans le renderer ET require()-able dans les tests Node.
(function (root) {
  function parseDuration(str) {
    if (typeof str !== 'string') return null;
    const s = str.trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    let m = s.match(/^(\d+):(\d{1,2})$/);
    if (m) { const mm = +m[2]; if (mm > 59) return null; return (+m[1] * 60 + mm) * 60; }
    m = s.match(/^(\d+)h(\d{1,2})?$/);
    if (m) { const mm = m[2] !== undefined ? +m[2] : 0; if (mm > 59) return null; return (+m[1] * 60 + mm) * 60; }
    m = s.match(/^(\d+)m$/);
    if (m) return +m[1] * 60;
    m = s.match(/^(\d+)$/);
    if (m) return +m[1] * 60;
    return null;
  }

  function formatHM(seconds) {
    const totalMin = Math.floor((seconds || 0) / 60);
    const h = Math.floor(totalMin / 60);
    const mm = String(totalMin % 60).padStart(2, '0');
    return `${h}h${mm}`;
  }

  function formatClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  }

  function localDate(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function totalSeconds(mission, running, nowMs) {
    let sum = (mission.sessions || []).reduce((a, s) => a + (s.seconds || 0), 0);
    if (running && running.missionId === mission.id && running.startedAt) {
      const started = Date.parse(running.startedAt);
      sum += Math.max(0, Math.floor((nowMs - started) / 1000));
    }
    return sum;
  }

  function perWeekday(sessions) {
    const out = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    for (const s of (sessions || [])) {
      if (!s.date) continue;
      const [y, mo, dd] = s.date.split('-').map(Number);
      const wd = new Date(y, mo - 1, dd).getDay(); // 0=Sun..6=Sat
      out[(wd + 6) % 7] += (s.seconds || 0);       // shift so Mon=0
    }
    return out;
  }

  function perDate(sessions) {
    const out = {};
    for (const s of (sessions || [])) {
      if (!s.date) continue;
      out[s.date] = (out[s.date] || 0) + (s.seconds || 0);
    }
    return out;
  }

  function recoverRunning(running, lastTickAtMs) {
    if (!running || !running.missionId || !running.startedAt) return null;
    const startMs = Date.parse(running.startedAt);
    const endMs = typeof lastTickAtMs === 'number' ? lastTickAtMs : Date.parse(lastTickAtMs);
    if (!(endMs > startMs)) return null;
    const seconds = Math.round((endMs - startMs) / 1000);
    if (seconds < 1) return null;
    return {
      date: localDate(startMs), start: running.startedAt,
      end: new Date(endMs).toISOString(), seconds, manual: false, note: ''
    };
  }

  function revenue(mission, totalHours) {
    const b = mission.billing || {};
    if (b.type === 'hourly') return (b.rate || 0) * totalHours;
    if (b.type === 'fixed') return (b.price || 0);
    return null;
  }

  function effectiveRate(mission, totalHours) {
    const b = mission.billing || {};
    if (b.type === 'hourly') return b.rate || 0;
    if (b.type === 'fixed') return totalHours > 0 ? (b.price || 0) / totalHours : null;
    return null;
  }

  function overrun(mission, totalHours) {
    const sold = mission.soldHours;
    const hours = (typeof sold === 'number' && sold > 0) ? Math.max(0, totalHours - sold) : 0;
    const b = mission.billing || {};
    let cost = null;
    if (b.type === 'hourly') cost = (b.rate || 0) * hours;
    else if (b.type === 'fixed') cost = 0;
    return { hours, cost };
  }

  const api = {
    parseDuration, formatHM, formatClock, localDate, totalSeconds,
    perWeekday, perDate, recoverRunning, revenue, effectiveRate, overrun
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
