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
  mdd-tip: "#166534"
  mdd-important: "#7e22ce"
  mdd-warning: "#92400e"
  mdd-caution: "#b91c1c"
  search-backdrop: "rgb(0 0 0 / 45%)"
  mdd-background-dark: "#1b1c25"
  mdd-surface-dark: "#262734"
  mdd-text-dark: "#eeeff8"
  mdd-muted-dark: "#b4b7cb"
  mdd-accent-dark: "#adb5ff"
  mdd-focus-dark: "#adb5ff"
  mdd-accent-soft-dark: "#343854"
  mdd-border-dark: "#3b3e52"
  mdd-tip-dark: "#86efac"
  mdd-important-dark: "#d8b4fe"
  mdd-warning-dark: "#fcd34d"
  mdd-caution-dark: "#fca5a5"
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
  search-result:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.5
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace'
    fontSize: "0.84rem"
    lineHeight: 1.8
rounded:
  mdd-radius: "6px"
  search-dialog: "12px"
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
  search-dialog:
    backgroundColor: "{colors.mdd-background}"
    textColor: "{colors.mdd-text}"
    rounded: "{rounded.search-dialog}"
    padding: "0"
    width: "min(40rem, calc(100% - 2rem))"
  search-input:
    backgroundColor: "{colors.mdd-background}"
    textColor: "{colors.mdd-text}"
    rounded: "{rounded.mdd-radius}"
    padding: "0.5rem"
---

# Design System: mdd

## Overview

**Creative North Star: "Field Guide with Marginal Notes"**

The reader gives prose a quiet paper ground, with chapters and local headings in its margins. Deep slate text, a restrained blurple accent, and compact navigation support sustained reading. The visual density changes between the article and its supporting rails without introducing decorative imagery.

This record describes the bundled D Theme in `themes/d/theme.css`, reader enhancements in `assets/reader.js`, search behavior in `assets/search-ui.js`, and semantic structure in `src/render.ts`. D Theme v0.2.0 (D26) is versioned independently of MDD v0.1.0. The selected direction remains recorded in `.impeccable/surfaces/src-render-ts.md`. Current browser captures in `.impeccable/review/` cover desktop, mobile, search, alerts, and footer presentation. Keyboard search and mobile overflow checks passed; forced-colors and reduced-motion rules were reviewed in source but were not browser-emulated. Author-supplied themes may override this default system.

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

### Semantic alerts

Tip, Important, Warning, and Caution use their corresponding `mdd-*` semantic colors for the label, icon, and leading border. The `-dark` entries record their dark-mode overrides. Note retains the shared accent. Every alert has a visible type label and a distinct icon, so color is not its only identifier. These colors do not replace the reading and navigation accent.

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
- **Navigation and outline:** smaller supporting text. Current chapter and outline links use weight `600`; navigation group labels are `0.875rem` at weight `600`.
- **Code:** preformatted blocks use the monospace role; inline code uses `0.87em` relative to its surrounding text. Tables use tabular numerals.

There is no mathematical type-scale ratio in the source. Do not infer one from the observed sizes.

## Layout

The masthead is sticky at the top, with a height of `4rem`. The centered page grid has a maximum width of `96rem` and columns of `15.5rem minmax(0, 1fr) 13rem`. The chapter rail sits below the masthead, fills the remaining dynamic viewport height, and scrolls independently. The local outline is sticky at `6rem`, with a maximum height of `calc(100dvh - 8rem)`.

The article and footer share `--mdd-measure: 70ch`. Desktop reading padding is `3rem 3.5rem 1.5rem`. Paragraphs and lists use the flow spacing; larger section gaps establish the article hierarchy. The spacing entries above name reused values already present in the stylesheet, not additional CSS custom properties or a new universal scale.

- At widths up to `1199px`, the grid becomes `14rem minmax(0, 1fr)`, reading padding becomes `2.5rem`, and the local outline moves into a native disclosure above the article.
- At widths up to `767px`, the layout becomes one column. The chapter rail becomes a native disclosure above the article; the masthead and article use `1.25rem` horizontal padding. Reading padding is `0 1.25rem 1.5rem`.
- Code examples and tables scroll horizontally within their available width; images fit the article. Long prose can wrap rather than widening the page.
- Coarse pointers receive a `44px` minimum height on toolbar controls, summaries, and mobile outline links.

Current browser review covered `1280×720`, `390×844`, and the user’s `852×740` viewport. The mobile page and search dialog had no horizontal page overflow. This coverage does not replace checks at every breakpoint or accessibility setting.

## Elevation & Depth

The default reader has no shadows, gradients, backdrop blur, or floating-card treatment. Surface color and one-pixel rules create separation. Sticky navigation changes position without gaining a shadow. Keyboard focus uses a two-pixel accent outline offset by four pixels; it is interaction feedback, not elevation.

Search uses a native modal dialog with the `search-backdrop` scrim. The scrim dims the page without blur or shadow; it is a modal boundary, not a new surface-elevation style.

**The Flat Surface Rule.** Separate the reader's regions with existing surface tones and fine rules; the default reader does not use shadow elevation.

## Shapes

Controls, chapter links, code blocks, article images, notes, quotations, and article disclosures use the shared `mdd-radius` corner token. Inline code uses its smaller radius; focused controls use the focus radius. Borders are one-pixel solid rules in the border color. There is no pill, badge, or ornamental silhouette in the default reader. The theme control uses two small outline SVG icons with a consistent two-pixel stroke and currentColor. Search uses the `search-dialog` radius, computed from twice `--mdd-radius`; inputs and result links retain the base radius.

## Components

### Product logo

The approved “Page space” wordmark is recorded in `brand/README.md`. MDD’s own example documentation selects `theme: "mdd"`, whose CSS displays the blurple wordmark on light surfaces and the white wordmark on dark surfaces. The linked site title remains its accessible name; forced-colors mode and print restore the visible title. Logo URLs are relative to the selected theme stylesheet, so static exports work at every base path without browser JavaScript.

The default renderer still displays each documentation owner’s configured title. The MDD logo is specific to this example theme; it is not imposed on other documentation sites.

### Buttons

Small textual controls share the surface fill, primary text, fine border, and control padding. Hover uses the accent wash. Focus uses the common visible outline. Disabled buttons are dimmed to opacity `0.65` and use the waiting cursor.

The theme control is hidden until its script initializes. It is an icon-only, transparent 44px square using simple sun/moon outline SVGs. The icon shows the target mode; an accessible name and native tooltip say “Switch to light theme” or “Switch to dark theme.” Copy controls use `0.72rem` text, a minimum width of `5.5rem`, and a minimum height of `2.5rem`.

### Chapter navigation

The chapter rail shares the page background. Links and folder labels use aligned `14px` type with a `20px` line height, a `36px` minimum row, and `12px` horizontal padding. Top-level folder groups have a `20px` preceding gap; deeper groups keep compact spacing. Inactive links use muted text; hover uses the surface fill. `aria-current="page"` adds the blurple accent wash, accent text, and weight `600`. Native folder disclosures use small trailing chevrons; linked folder titles remain separate destinations. Child lists use a `12px` inset and a thin border guide. Phones and coarse pointers receive `44px` minimum rows. The sidebar width, scroll container, and slide behavior stay fixed.

### Local outline

The desktop outline uses muted text without container fills. Hover and `aria-current="location"` use the accent; the current location also uses weight `600`. Third-level headings indent by `0.85rem`. The script tracks the current desktop section during scrolling. The smaller-width outline remains a native disclosure of direct heading links.

### Code examples

Code sits inside a rounded, bordered surface with horizontal overflow and a tab size of two. When a copy button is inserted, top padding expands to `3.5rem` to reserve its area; phone padding narrows horizontally to `1rem`. The button temporarily says “Copied,” or “Code selected” if clipboard access fails, then returns to “Copy code” after two seconds. A polite live region announces the outcome. Script-enhanced code blocks become keyboard-focusable.

### Article notes and disclosures

Notes, blockquotes, and article disclosures share border, corner, and inset treatment. Notes use the surface fill; blockquotes use muted text without that fill. Article disclosures use native details and summary elements, with a semibold summary. No custom accordion animation is implemented.

GitHub Note, Tip, Important, Warning, and Caution alerts retain this note surface and inset. A semantic leading border, visible label, and distinct outline icon distinguish each type. Forced-colors rules use system colors for the border, label, and icon; this mode has source review only.

### Search dialog

Search is an optional enhancement: its trigger stays hidden until the native dialog and script initialize. The trigger and close control have a `44px` minimum target. The dialog is limited to the available viewport, with a separately scrollable result list. The compact input header stays visible above results; keyboard hints stay below them on larger screens. Search input and results reuse the canvas, muted text, accent, and focus tokens. Result hover and selection use the accent wash; selected rows also have an inset focus-colored outline so selection remains distinct while the input retains focus. Each row has an 18px decorative page/heading icon, a 15px primary label, and optional 12px breadcrumbs. Body-only matches add a short 13px excerpt; label matches avoid redundant preview text.

Matching text in result titles, section labels, and excerpts uses semantic `mark` elements with an accent background and canvas-colored text. Highlights use a small `2px` corner radius. Highlighting adds no padding or weight, so text does not shift as queries change. It preserves the original characters and stays within search results.

Meta/Control+K opens search and focuses the input. Escape closes it even with a nonempty query and restores the opener’s focus. Arrow keys wrap the selected result while DOM focus remains in the input; Enter follows its real anchor. A combobox and listbox expose selection through `aria-activedescendant` and `aria-selected`. Normal result activation closes the dialog before native navigation, including a heading on the current page. Empty query, loading, results, no results, load failure, and query errors have distinct status text; failure exposes a retry control. Modified clicks retain native link behavior. Engine-provided ranges also highlight corrected typo spellings without reimplementing matching in the reader.

### Shared footer

The shared footer keeps contribution actions, Markdown resources, configured social links, attribution, and version information inside the article measure. Social links use `44px` minimum targets, muted text, and a surface fill on hover; focus uses the common outline. Known services use accessible inline icons, while other links retain visible labels. Rows wrap on narrow screens. MDD and D Theme versions remain separate labels.

### Previous and next links

Two-column page navigation follows the article, before the fine rule that starts the footer. Each link contains a muted direction label and a semibold destination; the next destination aligns right. Hover underlines the destination. These are ordinary text links rather than cards.

### Reading tools and accessibility states

The masthead combines the linked site title, optional Search control, and optional icon-only theme control. Previous/next navigation follows the article above the divider that begins the footer. The optional contribution row begins the footer, pairing Help improve this page. with Edit this markdown, followed by a separator before the resources. Helpfulness voting is not part of the reader. View Markdown and llms.txt for agents share a compact footer row and wrap when space is limited. Built with mdd sits in the main page footer as an intrinsic-width attribution link. A header icon shows/hides the desktop sidebar, remembering the reader's choice when storage is available. Folder groups use native disclosures, open by default; their landing-page labels remain links. Mobile keeps the Browse documentation disclosure. A keyboard-visible skip link targets the main article. All links, buttons, and summaries share visible focus styling. Under `prefers-reduced-motion: no-preference`, buttons, desktop chapter links, and desktop outline links transition color and background color over `160ms ease-out`; otherwise the default changes are immediate. The desktop sidebar uses an interruptible 240ms slide when motion is allowed; search has no custom entrance animation.

## Do's and Don'ts

### Do:

- **Do** reuse the current semantic color variables so light and dark modes keep the same reading and interaction roles.
- **Do** keep the article measure and responsive chapter/outline behavior when extending this reader.
- **Do** preserve native links, disclosures, visible focus, and meaningful current-location states.
- **Do** keep optional JavaScript enhancements independent of basic reading and navigation.
- **Do** preserve the recorded browser coverage and disclose untested accessibility modes when extending it.

### Don't:

- **Don't** introduce a new shadow or decorative container language as an incidental extension of this flat reader.
- **Don't** turn the current system-sans headings into a display-font mandate for unrelated surfaces.
- **Don't** make a JavaScript-only menu or custom disclosure replace the reader's functional native controls.
- **Don't** claim the component previews or token extraction establish rendered accessibility or visual approval.
