# dark.realm.watch

System-aware dark/light theming as a drop-in include. One pattern, three layered tiers, no build step.

Live at **[dark.realm.watch](https://dark.realm.watch)** — toggle on the page, flip your system theme, watch it follow.

## Why this exists

JP's projects implement dark/light twenty different ways. The two most evolved (`portfolio` and `disks`) had independently converged on the same canonical pattern — a `data-theme` attribute on `<html>` paired with `prefers-color-scheme`, with absence of the attribute meaning "follow the system." This package extracts that pattern, fixes its known warts (no-FOUC head snippet; explicit "system" state in the cycle), and ships it as small drop-in files. It also provides a `dark` CLI on Linux that wraps the cross-desktop XDG Desktop Portal call so shell scripts and GNOME extensions can read the same signal.

## Three tiers

### Tier 1 — CSS only (no JS)

```html
<link rel="stylesheet" href="https://dark.realm.watch/dark.css">
<style>
  :root { --bg: #0a0a0c; --fg: #eee; }
  :root[data-theme="light"] { --bg: #f5f5f7; --fg: #111; }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) { --bg: #f5f5f7; --fg: #111; }
  }
  body { background: var(--bg); color: var(--fg); }
</style>
```

The CSS preset establishes the four selectors (`[data-theme="light"]`, `[data-theme="dark"]`, and `:not(...)` system fallbacks) and declares `color-scheme:` so the user agent uses the right form-control palette. You bring your own variables; the include doesn't impose a schema.

### Tier 2 — add the engine

```html
<script>(()=>{try{var s=localStorage.getItem('drw-theme');if(s==='dark'||s==='light')document.documentElement.setAttribute('data-theme',s)}catch(_){}})()</script>
<link rel="stylesheet" href="https://dark.realm.watch/dark.css">
<script src="https://dark.realm.watch/dark.js"></script>
<button onclick="Dark.cycle()">cycle</button>
```

The inline `<script>` in `<head>` runs before paint and applies the saved preference, so there's no flash. Then `dark.js` exposes:

```js
Dark.current()          // 'light' | 'dark' | 'system'  — user's stored preference
Dark.effective()        // 'light' | 'dark'             — what's actually showing
Dark.set('dark')        // also accepts 'light' or 'system'
Dark.cycle()            // system → dark → light → system → …
Dark.config({ storage: 'mykey' })   // override the localStorage key

// Event:
document.addEventListener('dark:change', e => {
  console.log(e.detail.theme, e.detail.effective);
});
```

### Tier 3 — default toggle

```html
<script src="https://dark.realm.watch/dark-toggle.js"></script>
<dark-toggle></dark-toggle>                  <!-- icon, click cycles -->
<dark-toggle variant="pills"></dark-toggle>  <!-- three buttons: Light / Dark / System -->
```

Both inherit `currentColor` and `font-size`, so they reskin by setting those on a parent.

### Tier 3 — theme-aware images

```html
<script src="https://dark.realm.watch/dark-image.js"></script>
<dark-image
  src="cat-default.png"
  src-light="cat-bright.png"
  src-dark="cat-night.png"
  alt="A cat that changes coat with the time of day"
  width="320" height="200" loading="lazy">
</dark-image>
```

Renders an inner `<img>` whose `src` swaps on `dark:change`. Picks `src-light` when effective theme is light, `src-dark` when dark, falling back to `src` (or whichever variant is present) when only one is supplied. The constructor mirrors `dark.js`'s effective-theme resolution synchronously, so the first paint already picks the right image — no flicker waiting for `dark.js` to dispatch its first event. `alt`, `width`, `height`, `loading`, and `decoding` pass through to the inner `<img>`.

If you want a pre-authored `<img>` child for no-JS fallback or SSR, the element will reuse it instead of creating a new one:

```html
<dark-image src-light="cat-bright.png" src-dark="cat-night.png" alt="cat">
  <img src="cat-default.png" alt="cat" width="320" height="200">
</dark-image>
```

## Linux CLI

```bash
$ dark
dark
$ dark watch
dark
light
^C
```

Reads `org.freedesktop.appearance / color-scheme` via the [XDG Desktop Portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Settings.html); falls back to `gsettings get org.gnome.desktop.interface color-scheme` on systems without the portal.

Install:

```bash
git clone https://github.com/jphein/dark.realm.watch ~/Projects/dark.realm.watch
ln -s ~/Projects/dark.realm.watch/linux/dark ~/.local/bin/dark
```

## Files

| File | Use |
|---|---|
| `dark.css` | Selector preset (link in `<head>`) |
| `dark.js` | The engine (load after the preset) |
| `dark-head.js` | The render-blocking FOUC preventer (canonical use is to *inline* it) |
| `dark-toggle.js` | The optional `<dark-toggle>` custom element |
| `dark-image.js` | The optional `<dark-image>` custom element for theme-aware images |
| `linux/dark` | Bash CLI; install to `$PATH` |

## Defaults

| | |
|---|---|
| Storage key | `drw-theme` (override via `Dark.config({storage})`) |
| Cycle order | system → dark → light → system |
| Theme attribute | `data-theme` on `<html>` (absent = follow system) |
| Event | `dark:change` on `document`, with `detail: { theme, effective }` |

## Companion: auto-switching by sunset

This package reads what the system says is dark or light. If you also want the system itself to auto-switch at sunrise/sunset, install [Night Theme Switcher](https://extensions.gnome.org/extension/2236/night-theme-switcher/). The two compose: Night Theme Switcher flips your GNOME color-scheme; `dark.realm.watch` propagates that flip into your sites and tooling.

## Tests

```bash
bun test                                # JS unit tests (engine pure logic)
./linux/tests/test-dark.sh              # bash CLI tests (mocked gdbus / gsettings)
xdg-open tests/runner.html              # browser smoke check
```

## Acknowledgments

The patterns this codifies were learned from:

- [GoogleChromeLabs/dark-mode-toggle](https://github.com/GoogleChromeLabs/dark-mode-toggle) — the canonical custom-element treatment
- [theme-change](https://github.com/saadeghi/theme-change) — DaisyUI's tiny three-mode helper
- [jaywcjlove/dark-mode](https://github.com/jaywcjlove/dark-mode) — small MIT custom element
- The XDG Desktop Portal `org.freedesktop.appearance` cross-desktop standard
- `portfolio` and `disks` from JP's own homelab — the converged-pattern source

## License

MIT.
