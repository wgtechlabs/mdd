---
name: mdd
description: A quiet documentation field guide with chapter and section context.
colors:
  mdd-background: "#ffffff"
  mdd-surface: "#f6f6f9"
  mdd-text: "#242534"
  mdd-muted: "#5c5e73"
  mdd-accent: "#4752c4"
  mdd-focus: "#5865f2"
  mdd-accent-soft: "#eceefd"
  mdd-border: "#dddde8"
  mdd-background-dark: "#1b1c25"
  mdd-surface-dark: "#262734"
  mdd-text-dark: "#eeeff8"
  mdd-muted-dark: "#b4b7cb"
  mdd-accent-dark: "#adb5ff"
  mdd-focus-dark: "#adb5ff"
  mdd-accent-soft-dark: "#343854"
  mdd-border-dark: "#3b3e52"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  section:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.5rem"
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  subsection:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.125rem"
    lineHeight: 1.4
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.75
  introduction:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.125rem"
    lineHeight: 1.7
  navigation:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    lineHeight: 1.75
  outline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.78rem"
    lineHeight: 1.75
  reading-tool:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.8rem"
    lineHeight: 1.75
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace'
    fontSize: "0.84rem"
    lineHeight: 1.8
rounded:
  mdd-radius: "6px"
  inline-code: "3px"
  focus: "2px"
spacing:
  control-block: "0.35rem"
  control-inline: "0.7rem"
  compact: "0.75rem"
  flow: "1rem"
  inset: "1.25rem"
  group: "1.5rem"
  section: "2rem"
  reading-compact: "2.5rem"
  reading-top: "3rem"
  reading-inline: "3.5rem"
components:
  button:
    backgroundColor: "{colors.mdd-surface}"
    textColor: "{colors.mdd-text}"
    typography: "{typography.reading-tool}"
    rounded: "{rounded.mdd-radius}"
    padding: "0.35rem 0.7rem"
  button-hover:
    backgroundColor: "{colors.mdd-accent-soft}"
  chapter-link:
    textColor: "{colors.mdd-muted}"
    typography: "{typography.navigation}"
    rounded: "{rounded.mdd-radius}"
    padding: "0.35rem 0.7rem"
  chapter-link-current:
    backgroundColor: "{colors.mdd-accent-soft}"
    textColor: "{colors.mdd-accent}"
  outline-link:
    textColor: "{colors.mdd-muted}"
    typography: "{typography.outline}"
    padding: "0.25rem 0"
  outline-link-current:
    textColor: "{colors.mdd-accent}"
  article-disclosure:
    textColor: "{colors.mdd-text}"
    typography: "{typography.body}"
    rounded: "{rounded.mdd-radius}"
    padding: "1rem 1.25rem"
  code-example:
    backgroundColor: "{colors.mdd-surface}"
    textColor: "{colors.mdd-text}"
    typography: "{typography.code}"
    rounded: "{rounded.mdd-radius}"
    padding: "1.25rem"
  article-note:
    backgroundColor: "{colors.mdd-surface}"
    textColor: "{colors.mdd-text}"
    typography: "{typography.body}"
    rounded: "{rounded.mdd-radius}"
    padding: "1rem 1.25rem"
  page-link:
    textColor: "{colors.mdd-accent}"
---

# Design System: mdd

## Overview

**Creative North Star: "Field Guide with Marginal Notes"**

The reader gives prose a quiet paper ground, with chapters and local headings in its margins. Deep slate text, a restrained blurple accent, and compact navigation support sustained reading. The visual density changes between the article and its supporting rails without introducing decorative imagery.

This record describes the current default reader in `assets/reader.css`, its enhancements in `assets/reader.js`, and its semantic structure in `src/render.ts`. The selected direction is recorded in `.impeccable/surfaces/src-render-ts.md`. It is implementation-derived documentation, not visual approval: browser inspection was blocked by administrator policy and the finish review requires fresh captures. Responsive appearance, rendered contrast, clipping, and interaction presentation remain pending visual verification. Author-supplied themes may override this default system.

**Key Characteristics:**
- A measured article flanked by chapter navigation and a local outline.
- Neutral paper surfaces, slate text, and blurple navigation states in two themes.
- Flat containers separated by fine rules and small corner radii.
- Native links and disclosures, with optional theme, copy, and outline enhancements.

## Colors

The palette uses the approved blurple brand family and a neutral foundation. Frontmatter values are normative snapshots of the default stylesheet; they are not a second theme implementation.

### Primary

- **Blurple** (`#5865F2`) is the primary brand color and light-mode keyboard focus (`mdd-focus`).
- **Deep blurple** (`mdd-accent`, `#4752C4`) colors article links, the current chapter, and the current desktop outline location. This darker shade keeps small text readable on both white and selected backgrounds.
- **Pale blurple wash** (`mdd-accent-soft`) marks current chapters, hovered controls, and text selection.
- **Soft periwinkle** (`mdd-accent-dark`, also `mdd-focus-dark`) and **deep blurple wash** (`mdd-accent-soft-dark`) take those roles in dark mode.

Calculated text contrast for the primary, muted, and accent colors is at least 5.5:1 across the canvas, surface, and selection wash. Focus colors are at least 4.00:1 on those surfaces. These are token calculations, not a browser accessibility audit.

### Neutral

- **White paper** (`mdd-background`) carries the article and masthead; **cool gray paper** (`mdd-surface`) carries the chapter rail, code examples, controls, notes, and table headers.
- **Deep slate** (`mdd-text`) carries primary text; **muted slate** (`mdd-muted`) carries supporting labels, inactive navigation, introductory paragraphs, and quotations.
- **Fine gray rule** (`mdd-border`) separates surfaces, table rows, and reading sections.
- The corresponding `-dark` entries record the dark paper, surface, text, muted text, and rule values. This suffix is documentation notation: the stylesheet overrides the original `--mdd-*` custom properties rather than defining separate dark variables.

The operating-system preference selects dark mode unless the root explicitly requests light mode. The theme control sets `data-theme` and attempts to remember the choice locally; storage is optional. Selection and scrollbar colors also use this palette.

**The Shared Accent Rule.** Use the existing accent and accent-soft variables for reading links, location, and interaction feedback; use the focus variable for keyboard outlines. Keep these roles coherent across both themes.

## Typography

**Body and navigation font:** the platform sans stack in `typography.body`, from `--mdd-font`.

**Code font:** the native monospace stack in `typography.code`, from `--mdd-mono`.

The current implementation uses one sans family for article text, headings, and navigation. It has no loaded display font or custom font asset; the product wordmark is a separate SVG asset. The recorded heading roles describe this reader only; a platform display voice is not established as a rule for future expressive surfaces.

### Hierarchy

- **Headline:** article H1, balanced wrapping and compact tracking. At the phone breakpoint its size becomes `2rem`.
- **Section:** article H2 with tighter tracking and a larger preceding gap; its phone size becomes `1.35rem`.
- **Subsection:** article H3. H4–H6 use body size; their weight remains the native heading weight because the stylesheet does not explicitly set it.
- **Body:** normal reading text, with a maximum article measure of `70ch`.
- **Introduction:** a paragraph immediately following a direct-child article H1, using muted text and pretty wrapping.
- **Navigation and outline:** smaller supporting text. Current chapter and outline links use weight `600`; navigation group labels are `0.8rem` at weight `600`.
- **Code:** preformatted blocks use the monospace role; inline code uses `0.87em` relative to its surrounding text. Tables use tabular numerals.

There is no mathematical type-scale ratio in the source. Do not infer one from the observed sizes.

## Layout

The masthead is sticky at the top, with a height of `4rem`. The centered page grid has a maximum width of `96rem` and columns of `15.5rem minmax(0, 1fr) 13rem`. The chapter rail sits below the masthead, fills the remaining dynamic viewport height, and scrolls independently. The local outline is sticky at `6rem`, with a maximum height of `calc(100dvh - 8rem)`.

The article and footer share `--mdd-measure: 70ch`. Desktop reading padding is `3rem 3.5rem 1.5rem`. Paragraphs and lists use the flow spacing; larger section gaps establish the article hierarchy. The spacing entries above name reused values already present in the stylesheet, not additional CSS custom properties or a new universal scale.

- At widths up to `1199px`, the grid becomes `14rem minmax(0, 1fr)`, reading padding becomes `2.5rem`, and the local outline moves into a native disclosure above the article.
- At widths up to `767px`, the layout becomes one column. The chapter rail becomes a native disclosure above the article; the masthead and article use `1.25rem` horizontal padding. Reading padding is `0 1.25rem 1.5rem`.
- Code examples and tables scroll horizontally within their available width; images fit the article. Long prose can wrap rather than widening the page.
- Coarse pointers receive a `44px` minimum height on toolbar controls, summaries, and mobile outline links.

These are source-defined breakpoints and dimensions; their rendered behavior still needs the pending browser review.

## Elevation & Depth

The default reader has no shadows, gradients, backdrop blur, or floating-card treatment. Surface color and one-pixel rules create separation. Sticky navigation changes position without gaining a shadow. Keyboard focus uses a two-pixel accent outline offset by four pixels; it is interaction feedback, not elevation.

**The Flat Surface Rule.** Separate the reader's regions with existing surface tones and fine rules; the default reader does not use shadow elevation.

## Shapes

Controls, chapter links, code blocks, article images, notes, quotations, and article disclosures use the shared `mdd-radius` corner token. Inline code uses its smaller radius; focused controls use the focus radius. Borders are one-pixel solid rules in the border color. There is no pill, badge, ornamental silhouette, or icon system in the default reader.

## Components

### Product logo

The approved “Page space” wordmark is recorded in `brand/README.md`. MDD’s own example documentation selects `theme: "mdd"`, whose CSS displays the blurple wordmark on light surfaces and the white wordmark on dark surfaces. The linked site title remains its accessible name; forced-colors mode and print restore the visible title. Logo URLs are relative to the selected theme stylesheet, so static exports work at every base path without browser JavaScript.

The default renderer still displays each documentation owner’s configured title. The MDD logo is specific to this example theme; it is not imposed on other documentation sites.

### Buttons

Small textual controls share the surface fill, primary text, fine border, and control padding. Hover uses the accent wash. Focus uses the common visible outline. Disabled buttons are dimmed to opacity `0.65` and use the waiting cursor.

The theme control is hidden until its script initializes and labels the action as “Dark theme” or “Light theme.” On phones it has a `2.5rem` minimum height. Copy controls use `0.72rem` text, a minimum width of `5.5rem`, and a minimum height of `2.5rem`.

### Chapter navigation

Chapter links are compact, rounded text rows on the cool surface. Inactive links use muted text; hover adds the accent wash and primary text. `aria-current="page"` adds the accent wash, accent text, and weight `600`. Nested lists indent by `0.8rem`. On phones, the native “Browse documentation” disclosure contains the same links with `0.6rem` vertical padding.

### Local outline

The desktop outline uses muted text without container fills. Hover and `aria-current="location"` use the accent; the current location also uses weight `600`. Third-level headings indent by `0.85rem`. The script tracks the current desktop section during scrolling. The smaller-width outline remains a native disclosure of direct heading links.

### Code examples

Code sits inside a rounded, bordered surface with horizontal overflow and a tab size of two. When a copy button is inserted, top padding expands to `3.5rem` to reserve its area; phone padding narrows horizontally to `1rem`. The button temporarily says “Copied,” or “Code selected” if clipboard access fails, then returns to “Copy code” after two seconds. A polite live region announces the outcome. Script-enhanced code blocks become keyboard-focusable.

### Article notes and disclosures

Notes, blockquotes, and article disclosures share border, corner, and inset treatment. Notes use the surface fill; blockquotes use muted text without that fill. Article disclosures use native details and summary elements, with a semibold summary. No custom accordion animation is implemented.

### Previous and next links

A fine top rule separates the two-column page navigation from the article. Each link contains a muted direction label and a semibold destination; the next destination aligns right. Hover underlines the destination. These are ordinary text links rather than cards.

### Reading tools and accessibility states

The masthead combines the linked site title, Markdown access, and the optional theme control. A keyboard-visible skip link targets the main article. All links, buttons, and summaries share visible focus styling. Under `prefers-reduced-motion: no-preference`, buttons, desktop chapter links, and desktop outline links transition color and background color over `160ms ease-out`; otherwise the default changes are immediate. No entrance or scrolling animation is defined.

## Do's and Don'ts

### Do:

- **Do** reuse the current semantic color variables so light and dark modes keep the same reading and interaction roles.
- **Do** keep the article measure and responsive chapter/outline behavior when extending this reader.
- **Do** preserve native links, disclosures, visible focus, and meaningful current-location states.
- **Do** keep optional JavaScript enhancements independent of basic reading and navigation.
- **Do** treat this record as source evidence until fresh browser captures complete the visual review.

### Don't:

- **Don't** introduce a new shadow or decorative container language as an incidental extension of this flat reader.
- **Don't** turn the current system-sans headings into a display-font mandate for unrelated surfaces.
- **Don't** make a JavaScript-only menu or custom disclosure replace the reader's functional native controls.
- **Don't** claim the component previews or token extraction establish rendered accessibility or visual approval.
