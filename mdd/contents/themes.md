---
title: Themes
navTitle: Themes
order: 4
---
# Themes

MDD ships with **D Theme**. It supports light and dark modes and a reader toggle. Its current release is **D26**, version **0.3.0**.

## Add a custom theme

A custom theme adds CSS on top of D Theme.

1. Add `mdd/themes/custom/theme.css`:

   ```css
   :root {
     --mdd-accent: #6541a5;
     --mdd-radius: 4px;
   }
   ```

2. Select it in `mdd/config.json`:

   ```json
   { "theme": "custom" }
   ```

Keep the theme's images and fonts in the same folder. Use relative URLs so the theme works at any public prefix.

## Variables you can override

| Variable | Controls |
| --- | --- |
| `--mdd-background` | Page background |
| `--mdd-surface` | Navigation and code surfaces |
| `--mdd-text` | Main text |
| `--mdd-muted` | Supporting text |
| `--mdd-accent` | Links and current location |
| `--mdd-measure` | Maximum reading width |

## Browser scripts

An optional `theme.js` runs in the reader's browser after the reader script. The build never runs it. Use only theme code you trust.
