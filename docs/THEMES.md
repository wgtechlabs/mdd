# Themes

A selected theme adds CSS and optional browser JavaScript to the shared reader. It does not replace the engine, execute during builds, or introduce plugins.

Create `mdd/themes/custom/theme.css` and set `"theme": "custom"` in `mdd/config.json`. With a custom `paths.themes`, put `custom/` inside that configured directory instead.

## Tokens

| CSS variable | Default light value | Purpose |
| --- | --- | --- |
| `--mdd-background` | `#ffffff` | Reading surface |
| `--mdd-surface` | `#f4f6f6` | Sidebar and code surface |
| `--mdd-text` | `#202b2a` | Body text |
| `--mdd-muted` | `#596664` | Secondary text |
| `--mdd-accent` | `#17655d` | Links and active navigation |
| `--mdd-accent-soft` | `#e3efec` | Selected/hover backgrounds |
| `--mdd-border` | `#dce3e1` | Dividers |
| `--mdd-font` | System sans stack | Reading and navigation |
| `--mdd-mono` | System monospace stack | Source code |
| `--mdd-measure` | `70ch` | Maximum article width |
| `--mdd-radius` | `6px` | Small control corners |

The default follows `prefers-color-scheme`. The reader toggle sets `data-theme="light"` or `data-theme="dark"` on `<html>` and stores that preference locally. To override dark tokens, match `:root[data-theme="dark"]` and `:root:not([data-theme="light"])` inside a dark media query. A plain `:root` override alone has lower specificity than those selectors.

```css
:root { --mdd-accent: #6541a5; --mdd-accent-soft: #f0eafb; }
:root[data-theme="dark"] { --mdd-accent: #cbb5fa; --mdd-accent-soft: #382c48; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --mdd-accent: #cbb5fa; --mdd-accent-soft: #382c48; }
}
```

## Reader selectors

Use `.mdd-header`, `.mdd-sidebar`, `.mdd-reading`, `.mdd-article`, `.mdd-outline`, `.mdd-page-links`, and `.mdd-footer` for layout styling. Current page links have `aria-current="page"`; the desktop outline uses `aria-current="location"` after enhancement. Engine components retain `.mdd-note`, `.mdd-tip`, `.mdd-warning`, and `.mdd-details`.

The desktop outline hides below 1200px and becomes a disclosure above the article. Below 768px the sidebar becomes a separate native disclosure. These work without JavaScript. Test long titles, tables, code, keyboard focus, narrow screens, and both color schemes when changing styles.

## Assets and trust

Theme CSS/JS/MJS/JSON, supported raster images, SVG, and WOFF/WOFF2/TTF/OTF fonts are copied below `_mdd/theme/` with their relative paths intact. Use relative CSS URLs or relative module URLs. Avoid root-relative asset references: those do not automatically inherit the documentation prefix. Other extensions are omitted. Hidden/sensitive paths and symlinks are refused. Referenced content assets have the engine's more restrictive allowlist.

Optional `theme.js` is a deferred classic browser script loaded after `reader.js`. It has the same page access as other scripts and may load network resources. Select only code you trust; theme files are not sandboxed or sanitized. No source JavaScript runs in the Node compilation process.
