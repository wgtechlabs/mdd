---
navTitle: Custom themes
order: 2
---
# Make the reader your own

The bundled **D Theme** gives you a complete reader. Its current release is **D26**, version **0.1.0**. Override a few CSS variables to match your project, or style its documented components.

## One theme, named releases

D Theme keeps the stable identifier `d`. D26 is its release name: minor and patch updates keep that name, and the planned 1.0.0 major release introduces D27. Theme versions are independent of MDD, and the calendar never changes the release name automatically.

The theme is developed inside the MDD repository under `themes/d/`. Historical source snapshots belong in `themes/archive/`. Shared reader controls remain part of MDD.

Omit the `theme` field from your project's configuration to use D Theme alone. The MDD CLI's `--theme d` option explicitly selects the same bundled base for checking, building, or previewing. The configuration field selects a local custom overlay instead; it does not select bundled themes by ID.

## Create a theme

Add a stylesheet at `mdd/themes/custom/theme.css`:

```css
:root {
  --mdd-accent: #6541a5;
  --mdd-accent-soft: #f0eafb;
  --mdd-radius: 4px;
}
```

Select it in `mdd/config.json`:

```json
{
  "title": "My project",
  "theme": "custom"
}
```

Custom theme CSS and its logo assets live together in the selected theme directory. The footer keeps the version display concise: the installed mdd version and the bundled D Theme version.

## Style the reading experience

| Variable | Controls |
| --- | --- |
| `--mdd-background` | Page background |
| `--mdd-surface` | Navigation and code surfaces |
| `--mdd-text` | Main text |
| `--mdd-muted` | Supporting text |
| `--mdd-accent` | Links and current location |
| `--mdd-measure` | Maximum reading width |

Use `.mdd-article`, `.mdd-sidebar`, `.mdd-outline`, and `.mdd-page-links` when you need more specific styling. Test your changes in both light and dark modes.

## Add browser behavior

An optional `theme.js` loads after the reader script. It runs in the visitor's browser, with access to that page. Only select theme code you trust.

Theme-relative images and fonts are copied alongside the stylesheet. Refer to them with relative URLs so the same theme works at any site prefix.

:::details[Can a theme replace the layout?]
Themes currently add CSS and browser JavaScript to the shared reader. Full layout replacement and plugins are deferred.
:::
