// dark.realm.watch — system-aware dark/light theming engine.
// Public API: window.Dark.{current, effective, set, cycle, config}.
// Three states: 'light', 'dark', 'system' (system = absence of stored value).

(function () {
  var storageKey = 'drw-theme';
  var mediaQuery = null;

  function readPref() {
    try {
      var v = localStorage.getItem(storageKey);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch (_) {
      return 'system';
    }
  }

  function effective() {
    var p = readPref();
    if (p !== 'system') return p;
    if (!mediaQuery) mediaQuery = matchMedia('(prefers-color-scheme: dark)');
    return mediaQuery.matches ? 'dark' : 'light';
  }

  window.Dark = {
    current: readPref,
    effective: effective,
  };
})();
