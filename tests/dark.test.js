// dark.realm.watch — unit tests for dark.js engine.
// Stubs browser globals so we can exercise the runtime under bun.
// Uses node:vm to evaluate dark.js in a controlled context.
// Run: bun test

const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { test, expect } = require('bun:test');

const DARK_JS_PATH = path.resolve(__dirname, '..', 'dark.js');

function makeEnv({ stored = null, systemDark = false } = {}) {
  const store = new Map();
  if (stored) store.set('drw-theme', stored);

  let systemIsDark = systemDark;
  const mqlListeners = [];

  const root = {
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    removeAttribute(k) { delete this._attrs[k]; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this._attrs, k); },
  };

  const events = [];

  function matchMedia(q) {
    const wantsDark = q.includes('dark');
    return {
      get matches() { return wantsDark ? systemIsDark : !systemIsDark; },
      addEventListener(_, fn) { mqlListeners.push(fn); },
      removeEventListener() {},
    };
  }

  const env = {
    localStorage: {
      getItem: k => store.has(k) ? store.get(k) : null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    matchMedia,
    document: {
      documentElement: root,
      readyState: 'complete',
      addEventListener() {},
      dispatchEvent(e) { events.push({ type: e.type, detail: e.detail }); return true; },
    },
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    _root: root,
    _events: events,
    _flipSystem(toDark) {
      systemIsDark = toDark;
      [...mqlListeners].forEach(fn => fn({ matches: toDark }));
    },
  };

  return env;
}

function loadDark(env) {
  const src = fs.readFileSync(DARK_JS_PATH, 'utf8');
  // dark.js IIFE references bare globals (localStorage, matchMedia, document,
  // CustomEvent, window). Expose env as the context's global object so those
  // identifiers resolve to our stubs.
  const ctx = {
    window: env,
    document: env.document,
    localStorage: env.localStorage,
    matchMedia: env.matchMedia,
    CustomEvent: env.CustomEvent,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // dark.js does `window.Dark = ...`, where window === env, so:
  return env.Dark;
}

// Sanity check the harness itself.
test('harness loads dark.js without throwing', () => {
  const env = makeEnv();
  expect(() => loadDark(env)).not.toThrow();
});

test('current() returns "system" when no value stored', () => {
  const env = makeEnv();
  const Dark = loadDark(env);
  expect(Dark.current()).toBe('system');
});

test('current() returns "light" when stored', () => {
  const env = makeEnv({ stored: 'light' });
  const Dark = loadDark(env);
  expect(Dark.current()).toBe('light');
});

test('current() returns "dark" when stored', () => {
  const env = makeEnv({ stored: 'dark' });
  const Dark = loadDark(env);
  expect(Dark.current()).toBe('dark');
});

test('current() returns "system" for invalid stored value', () => {
  const env = makeEnv({ stored: 'garbage' });
  const Dark = loadDark(env);
  expect(Dark.current()).toBe('system');
});

test('effective() returns "light" when system is light and pref is system', () => {
  const env = makeEnv({ systemDark: false });
  const Dark = loadDark(env);
  expect(Dark.effective()).toBe('light');
});

test('effective() returns "dark" when system is dark and pref is system', () => {
  const env = makeEnv({ systemDark: true });
  const Dark = loadDark(env);
  expect(Dark.effective()).toBe('dark');
});

test('effective() honors stored pref over system', () => {
  const env = makeEnv({ stored: 'light', systemDark: true });
  const Dark = loadDark(env);
  expect(Dark.effective()).toBe('light');
});

test('set("dark") persists and applies attribute', () => {
  const env = makeEnv();
  const Dark = loadDark(env);
  Dark.set('dark');
  expect(Dark.current()).toBe('dark');
  expect(env._root.getAttribute('data-theme')).toBe('dark');
});

test('set("light") persists and applies attribute', () => {
  const env = makeEnv();
  const Dark = loadDark(env);
  Dark.set('light');
  expect(Dark.current()).toBe('light');
  expect(env._root.getAttribute('data-theme')).toBe('light');
});

test('set("system") removes the attribute and clears storage', () => {
  const env = makeEnv({ stored: 'dark' });
  const Dark = loadDark(env);
  Dark.set('system');
  expect(Dark.current()).toBe('system');
  expect(env._root.hasAttribute('data-theme')).toBe(false);
});

test('set throws on invalid value', () => {
  const env = makeEnv();
  const Dark = loadDark(env);
  expect(() => Dark.set('blue')).toThrow();
});

test('set dispatches dark:change with theme + effective', () => {
  const env = makeEnv({ systemDark: false });
  const Dark = loadDark(env);
  env._events.length = 0;
  Dark.set('dark');
  const evt = env._events.find(e => e.type === 'dark:change');
  expect(evt).toBeDefined();
  expect(evt.detail.theme).toBe('dark');
  expect(evt.detail.effective).toBe('dark');
});

test('cycle: system -> dark', () => {
  const env = makeEnv();
  const Dark = loadDark(env);
  Dark.cycle();
  expect(Dark.current()).toBe('dark');
});

test('cycle: dark -> light', () => {
  const env = makeEnv({ stored: 'dark' });
  const Dark = loadDark(env);
  Dark.cycle();
  expect(Dark.current()).toBe('light');
});

test('cycle: light -> system', () => {
  const env = makeEnv({ stored: 'light' });
  const Dark = loadDark(env);
  Dark.cycle();
  expect(Dark.current()).toBe('system');
});

test('system change re-applies when pref is system', () => {
  const env = makeEnv({ systemDark: false });
  const Dark = loadDark(env);
  expect(Dark.effective()).toBe('light');
  env._events.length = 0;
  env._flipSystem(true);
  expect(env._root.hasAttribute('data-theme')).toBe(false);
  const evt = env._events.find(e => e.type === 'dark:change');
  expect(evt).toBeDefined();
  expect(evt.detail.theme).toBe('system');
  expect(evt.detail.effective).toBe('dark');
});

test('system change does NOT re-apply when pref is explicit', () => {
  const env = makeEnv({ stored: 'light', systemDark: false });
  const Dark = loadDark(env);
  env._events.length = 0;
  env._flipSystem(true);
  const evt = env._events.find(e => e.type === 'dark:change');
  expect(evt).toBeUndefined();
});

test('config({storage}) switches the storage key', () => {
  const env = makeEnv();
  env.localStorage.setItem('alt-key', 'dark');
  const Dark = loadDark(env);
  expect(Dark.current()).toBe('system');
  Dark.config({ storage: 'alt-key' });
  expect(Dark.current()).toBe('dark');
});

test('init applies stored value to <html> on load', () => {
  const env = makeEnv({ stored: 'dark' });
  loadDark(env);
  expect(env._root.getAttribute('data-theme')).toBe('dark');
});

test('init does NOT set attribute when pref is system', () => {
  const env = makeEnv({ systemDark: true });
  loadDark(env);
  expect(env._root.hasAttribute('data-theme')).toBe(false);
});
