---
navTitle: Writing pages
order: 1
---
# Writing pages

Use familiar Markdown for your content. Add a little metadata when you want to control titles and ordering.

## Organize your content

| File | Page route |
| --- | --- |
| `contents/index.md` | `/` |
| `contents/guides/index.md` | `/guides/` |
| `contents/guides/writing.md` | `/guides/writing/` |

Folders without an index become navigation groups. A folder index becomes a landing page.

## Add page metadata

```yaml
---
title: Writing pages
navTitle: Writing
order: 1
---
```

The engine uses `navTitle` in navigation and `title` for page metadata. If you leave out a title, it uses your first main heading, then the filename.

## Link to other pages

Write relative Markdown links, such as `[Installation](../get-started/installation.md)`. MDD checks the target and rewrites the link for your site's public prefix.

Use heading fragments to link directly to a section. For example, [page metadata](#add-page-metadata) jumps to the heading above.

## Highlight useful details

:::note[Notes]
Use a note for context readers should know before continuing.
:::

:::tip[Tips]
Use a tip for a useful shortcut or a simpler way to finish a task.
:::

:::warning[Keep source code inert]
Raw HTML and executable URL schemes fail validation. Selected theme scripts are trusted browser code and should be reviewed separately.
:::

:::details[How do components look in Markdown exports?]
Callouts become readable blockquotes. The same content stays useful to an agent without a browser.
:::
