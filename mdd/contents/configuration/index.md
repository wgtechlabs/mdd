---
title: Configuration files
navTitle: Configuration files
order: 2
---
# Configuration files

All configuration files are optional. They live in your MDD folder, next to `contents/`.

## config.json

`config.json` sets the site title, content paths, and an optional custom theme. Paths are relative to `config.json` and must stay inside the project.

```json
{
  "title": "My project",
  "paths": { "contents": "./contents", "themes": "./themes" },
  "theme": "custom"
}
```

Omit `theme` to use D Theme alone.

## reader.json

`reader.json` adds up to two header links and one call to action. Links must use HTTPS.

```json
{
  "header": {
    "links": [
      { "label": "Sponsor", "href": "https://github.com/sponsors/wgtechlabs" }
    ],
    "cta": { "label": "GitHub", "href": "https://github.com/wgtechlabs/mdd" }
  }
}
```

## footer.md

`footer.md` holds the social links in the page footer. Use one `socials` block with a flat list of HTTPS links:

```markdown
:::socials
- [GitHub](https://github.com/wgtechlabs/mdd)
:::
```

The footer is not a page and does not appear in search.

## Next step

[Set environment variables](./environment.md) for the server.
