---
title: Build your first site
navTitle: Installation
order: 1
---
# Build your first site

Start with a Markdown file and the local MDD checkout. You need Bun for development and Node.js 22 or newer to run the renderer and server.

## Prepare the project

From the MDD repository, install dependencies and build the renderer:

```sh
bun install --frozen-lockfile
bun run build
```

Create `mdd/contents/index.md` inside your documentation project:

```markdown
# Welcome

This is the beginning of our documentation.
```

## Run the server

Use the MDD container to build and serve a project containing an `mdd/` directory:

```sh
docker run --rm -p 3000:3000 -v "/path/to/project:/workspace" wgtechlabs/mdd:latest
```

The server builds the documentation when it starts and serves the rendered site on port 3000. An invalid link or configuration stops startup without replacing the previous build.

## Deploy static output

For static hosting, use the renderer's `build()` API and provide the complete public path in `basePath`, such as `/repository/docs/`. The build writes `mdd-dist/` in the documentation project. Upload its contents to the static host; the prefix changes URLs but does not add another directory around the output. See the repository README for the build API example.
