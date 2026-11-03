// Conservative foreground sampling. A title is a clue, never proof of intent.
// Shared by the renderer and deterministic tests; no browsing data is stored here.
(function (root) {
  function createActivityTracker() {
    let previous = null;
    let visit = 0;
    let sessionSeconds = 0;
    return {
      sample({ now, title = '', idleSeconds = 0, key = null }) {
        const away = idleSeconds >= 120;
        const gap = previous ? (now - previous.now) / 1000 : 0;
        const continuous = previous && gap > 0 && gap <= 6 && !away && !previous.away;
        const activeKey = away ? null : key;
        const changed = !previous || previous.key !== activeKey || !continuous;
        const ended = changed && previous?.key && sessionSeconds >= 60
          ? { key: previous.key, seconds: sessionSeconds } : null;
        if (changed) { visit++; sessionSeconds = 0; }
        const seconds = continuous && previous.title === title ? gap : 0;
        sessionSeconds += seconds;
        previous = { now, title, key: activeKey, away };
        return { seconds, away, key: activeKey, visit, sessionSeconds, started: changed && !!activeKey, ended };
      }
    };
  }
  const api = { createActivityTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DoneDogActivity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
