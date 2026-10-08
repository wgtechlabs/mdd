# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: static HTML/CSS with small browser scripts, TypeScript, Bun tooling, Node.js runtime. The user authorized proceeding after the recommended stack, editorial reader, and direct implementation were presented. No frontend framework is needed for portable documentation.

## Users

Repository owners and AI agents author documentation through files. Readers need to find a topic, understand it, follow examples, and move between related pages. Agents need portable Markdown access to the same content.

## Product Purpose

MDD turns a repository's `mdd/` folder into documentation that its owner can host. The separate published mdd-engine package owns compilation; this application owns the reader, CLI, static output, and server.

## Operating Context

Authors edit Markdown, configuration, and selected theme files in Git. Static output can be served from GitHub Pages under a chosen prefix. Railway support is planned as one public content repository per deployment. There is no dashboard or database.

## Capabilities and Constraints

- File-derived navigation, article content, heading links, table of contents, previous/next pages, and a real not-found page.
- Reading and navigation work without JavaScript. Enhancements must not require a hosted service.
- Themes use CSS and optional browser JavaScript; author code never runs during compilation.
- Local commands validate, build, preview, and serve. Agent exports include normalized Markdown and an index.
- Separate repositories, published engine dependency, Bun tools, Node 22/24/26 support with latest LTS default.
- Private content repositories, plugins, accounts, search services, AI chat, and multiple sites are deferred.

## Brand Commitments

The product is named mdd (Markdown Docs). Its voice is direct and useful. No logo or externally licensed brand assets have been supplied.

## Evidence on Hand

The published engine package and its documented API are available. Example documentation will describe actual local capabilities and will not claim deployment or publication before verification.

## Product Principles

- Author with ordinary files; keep hosting under the owner's control.
- Compile once into portable output.
- Keep the engine headless and reuse its output without duplicating its parser.
- Prefer native browser and Node features to extra runtime dependencies.

## Accessibility & Inclusion

Semantic HTML, visible keyboard focus, responsive reading, reduced-motion support, sufficient contrast, and functional navigation without JavaScript are implementation acceptance criteria.
