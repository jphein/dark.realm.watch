// dark.realm.watch — <dark-image> custom element.
// Swaps an inner <img>'s src based on the effective theme.
//
// Usage:
//   <dark-image
//     src="default.png"
//     src-light="cat-bright.png"
//     src-dark="cat-night.png"
//     alt="A cat that changes coat with the time of day"
//     width="320" height="200" loading="lazy">
//   </dark-image>
//
// Attributes:
//   src         — fallback / default URL (used when no per-theme variant or
//                 when both src-light and src-dark are absent).
//   src-light   — URL to use when effective theme is 'light'.
//   src-dark    — URL to use when effective theme is 'dark'.
//   alt, width, height, loading, decoding — passed through to the inner <img>.
//
// Light DOM (not shadow): the inner <img> stays addressable by SEO crawlers,
// CSS, and accessibility tools. If you pre-author an <img> child, this element
// updates its src in place; otherwise one is created on connect.
//
// FOUC strategy: the constructor reads the stored preference + system pref
// synchronously (mirroring dark.js's `effective()` logic) so the very first
// paint already picks the right image — no flicker waiting for dark.js to
// load and dispatch `dark:change`.

(function () {
  if (typeof customElements === 'undefined') return;

  var PASSTHROUGH_ATTRS = ['alt', 'width', 'height', 'loading', 'decoding'];

  function effectiveTheme() {
    if (window.Dark && typeof window.Dark.effective === 'function') {
      return window.Dark.effective();
    }
    // Standalone fallback: same shape as dark.js's effective().
    try {
      var pref = localStorage.getItem('drw-theme');
      if (pref === 'light' || pref === 'dark') return pref;
    } catch (_) {}
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  class DarkImage extends HTMLElement {
    static get observedAttributes() {
      return ['src', 'src-light', 'src-dark']
        .concat(PASSTHROUGH_ATTRS);
    }

    connectedCallback() {
      this._ensureImg();
      this._sync();
      this._onChange = this._sync.bind(this);
      document.addEventListener('dark:change', this._onChange);
    }

    disconnectedCallback() {
      if (this._onChange) {
        document.removeEventListener('dark:change', this._onChange);
      }
    }

    attributeChangedCallback() {
      if (this._img) this._sync();
    }

    _ensureImg() {
      this._img = this.querySelector(':scope > img');
      if (!this._img) {
        this._img = document.createElement('img');
        this.appendChild(this._img);
      }
    }

    _resolveSrc(effective) {
      var src = this.getAttribute('src') || '';
      var srcLight = this.getAttribute('src-light') || '';
      var srcDark = this.getAttribute('src-dark') || '';
      if (effective === 'light' && srcLight) return srcLight;
      if (effective === 'dark' && srcDark) return srcDark;
      return src || srcLight || srcDark || '';
    }

    _sync() {
      if (!this._img) return;
      var img = this._img;
      var newSrc = this._resolveSrc(effectiveTheme());
      if (newSrc && img.getAttribute('src') !== newSrc) {
        img.setAttribute('src', newSrc);
      }
      for (var i = 0; i < PASSTHROUGH_ATTRS.length; i++) {
        var attr = PASSTHROUGH_ATTRS[i];
        var v = this.getAttribute(attr);
        if (v != null && img.getAttribute(attr) !== v) {
          img.setAttribute(attr, v);
        }
      }
    }
  }

  customElements.define('dark-image', DarkImage);
})();
