// dark.realm.watch — <dark-toggle> custom element.
// Variants: "icon" (default, click cycles) — pills variant added in next task.
// Inherits currentColor and font-size for reskinning.
// Drives Dark.cycle() and listens for dark:change.

(function () {
  if (typeof customElements === 'undefined') return;

  var ICON_STYLE =
    ':host { display: inline-block; }' +
    'button {' +
      'font: inherit; color: inherit; background: transparent;' +
      'border: 1px solid currentColor; border-radius: 50%;' +
      'width: 2em; height: 2em; padding: 0; line-height: 1;' +
      'cursor: pointer; opacity: 0.7;' +
      'display: inline-flex; align-items: center; justify-content: center;' +
      'transition: opacity 0.15s;' +
    '}' +
    'button:hover { opacity: 1; }' +
    'button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }';

  function attachStyle(root, css) {
    if (typeof CSSStyleSheet !== 'undefined' &&
        'replaceSync' in CSSStyleSheet.prototype &&
        'adoptedStyleSheets' in root) {
      var sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      root.adoptedStyleSheets = [sheet];
      return;
    }
    var style = document.createElement('style');
    style.appendChild(document.createTextNode(css));
    root.appendChild(style);
  }

  function clearChildren(root) {
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  class DarkToggle extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      this._render();
      this._sync();
      this._onChange = this._sync.bind(this);
      document.addEventListener('dark:change', this._onChange);
    }
    disconnectedCallback() {
      document.removeEventListener('dark:change', this._onChange);
    }
    _variant() {
      return this.getAttribute('variant') || 'icon';
    }
    _render() {
      this._renderIcon();
    }
    _renderIcon() {
      clearChildren(this.shadowRoot);
      attachStyle(this.shadowRoot, ICON_STYLE);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('part', 'button');
      btn.setAttribute('aria-label', 'Toggle theme');
      btn.addEventListener('click', function () {
        if (window.Dark) window.Dark.cycle();
      });
      this.shadowRoot.appendChild(btn);
    }
    _sync() {
      if (!window.Dark) return;
      var theme = window.Dark.current();
      var eff = window.Dark.effective();
      var btn = this.shadowRoot.querySelector('button');
      if (!btn) return;
      btn.textContent = theme === 'system' ? '◐' : eff === 'dark' ? '☾' : '☀';
      btn.title = 'Theme: ' + theme + (theme === 'system' ? ' (effective: ' + eff + ')' : '');
    }
  }

  customElements.define('dark-toggle', DarkToggle);
})();
