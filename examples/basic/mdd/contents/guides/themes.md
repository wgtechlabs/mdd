---
navTitle: Custom themes
order: 2
---
# Make the reader your own

The default theme gives you a complete reader. Override a few CSS variables to match your project, or style its documented components.

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
