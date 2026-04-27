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
