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

The sidebar follows files and folders. Folders without an index become navigation groups, using the folder name with hyphens and underscores replaced by spaces. A folder's `index.md` adds a landing page and supplies the group's navigation label.

Routes come from file paths, so changing a page's title or adding an emoji to its label does not change its URL.

## Add page metadata

Each file can start with optional YAML frontmatter between `---` lines, followed by ordinary Markdown:

```markdown
---
title: Installation
description: Set up your first documentation site.
navTitle: "🚀 Install"
order: 1
---

# Build your first site

Write your documentation in the `mdd/contents/` folder.

## Requirements

Use a supported Node.js version.

### Check your version

Run `node --version`.
```

This example shows **🚀 Install** in the sidebar, uses **Installation** as the page title, and keeps **Build your first site** as the visible article heading.

The supported metadata fields are:

| Field | Purpose |
| --- | --- |
| `title` | Page title for document metadata and the default navigation label. |
| `description` | Page description for document metadata. |
| `navTitle` | A separate label for the sidebar and Previous/Next links. |
| `order` | A finite number that orders the page among its siblings. Lower values come first. |

All fields are optional. Text fields must be nonempty strings; unknown fields fail validation. Pages with an explicit `order` come before unordered siblings. Remaining ties sort by label and path. Numeric filename prefixes are not removed automatically.

The sidebar chooses its label in this order: `navTitle`, then `title`, then the first `#` heading, then a readable filename. A frontmatter title does not replace an existing article heading. If the file has no `#` heading, MDD adds one using the page title.

## Use emoji and headings

Emoji are ordinary text. A heading such as `# 🚀 Installation` supplies that same sidebar label when neither `navTitle` nor `title` overrides it. To put an emoji only in navigation, use `navTitle: "🚀 Installation"` and keep the article heading plain.

There is no separate `icon` field or nested `nav.title` setting. Use the supported `navTitle` field.

Headings inside a file organize the article; they do not create extra sidebar pages. MDD lists `##` and `###` headings in **On this page**. Deeper headings still render in the article.

## Link to other pages

Write relative Markdown links, such as `[Installation](../get-started/installation.md)`. MDD checks the target and rewrites the link for your site's public prefix.

Use heading fragments to link directly to a section. For example, [page metadata](#add-page-metadata) jumps to the heading above.

## Highlight useful details

Use GitHub-style alerts for notes, tips, important context, warnings, and cautions. Put the uppercase marker on its own line inside a blockquote:

```markdown
> [!NOTE]
> Helpful context for readers.
```

> [!NOTE]
> Use a note for context readers should know before continuing.

> [!TIP]
> Use a tip for a shortcut or a simpler way to finish a task.

> [!IMPORTANT]
> Put essential information here when readers need it to complete a task.

> [!WARNING]
> Raw HTML and executable URL schemes fail validation. Selected theme scripts are trusted browser code and should be reviewed separately.

> [!CAUTION]
> Explain a potentially destructive action before a reader takes it.

All five alerts have visible labels. D Theme adds decorative icons and color; the alerts remain ordinary article content, without interrupting screen readers. Alert markers also remain readable in Markdown exports.

Engine 1.0.0 removes the old `:::note`, `:::tip`, and `:::warning` directives. Replace them with the corresponding alert above. For a former custom title, place bold text on the next quoted line. Keep alerts at the top level of the document; nested blockquotes and code examples are not converted to alerts.

:::details[How do disclosures look in Markdown exports?]
The `:::details[Title]` component still works. Its title and content remain readable in the Markdown export.
:::

## Search your documentation

Select **Search** or press **Ctrl+K** / **Cmd+K**. Results include page titles, headings, and excerpts with matching keywords highlighted as you type. Partial words and multiple keywords are supported. Highlighting stays in the results; the documentation page remains unchanged. Use the arrow keys to move between results and Enter to follow a link. Escape closes search and returns focus.

The index is built from article content and loaded from the same site when search first opens. No external search service or database is required. Reading and navigation still work with JavaScript disabled; search requires JavaScript.

## Add shared footer links

Create `mdd/footer.md` beside your `config.json`. This file is separate from `contents/` and appears in every page footer, including the not-found page:

```markdown
:::socials
- [GitHub](https://github.com/wgtechlabs/mdd)
:::
```

Use one `socials` block containing a plain unordered list of links with text labels and HTTPS destinations. MDD uses a GitHub icon for GitHub links; other destinations keep their text label. The footer does not create a documentation page or enter the search index. If you use a custom `--mdd-dir`, place `footer.md` in that directory instead.
