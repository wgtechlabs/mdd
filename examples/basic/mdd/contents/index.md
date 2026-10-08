---
navTitle: Introduction
order: 0
---
# Documentation starts with a folder.

Write Markdown. Keep it in your repository. Turn it into a documentation site you can host yourself.

MDD gives your documentation a home without changing how you work. You and your agents edit ordinary files; the engine handles pages, links, and navigation.

## A small, familiar structure

Your folders become sections. Your files become pages. Start with an `index.md` and grow from there.

```text
mdd/
  contents/
    index.md
    get-started/
      installation.md
  themes/
  config.json
```

[Build your first site](./get-started/installation.md) with the local CLI.

## Write once, read anywhere

The same build produces readable HTML and plain Markdown. People get a focused reading experience. Agents get a Markdown index they can follow.

:::note[Your files stay yours]
MDD creates a static directory. You can serve it with any static host or with the included Node server. Reading and navigation work without JavaScript.
:::

## Make it yours

Start with the default theme, or add your own CSS. The content and its presentation stay separate, so a new look doesn't mean rewriting your docs.

- **Organize naturally.** Folders and filenames define the structure.
- **Write for humans and agents.** One source produces both formats.
- **Choose your host.** Build for a root domain or a nested path.

Explore [writing pages](./guides/writing.md) or [customizing a theme](./guides/themes.md).
