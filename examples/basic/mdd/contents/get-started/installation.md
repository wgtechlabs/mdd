---
title: Build your first site
navTitle: Installation
order: 1
---
# Build your first site

Start with a Markdown file and the local MDD checkout. You need Bun for development and Node.js 22 or newer to run the built CLI.

## Prepare the project

From the MDD repository, install dependencies and build the CLI:

```sh
bun install --frozen-lockfile
bun run build
```

Create `mdd/contents/index.md` inside your documentation project:

```markdown
# Welcome

This is the beginning of our documentation.
```

## Check and build

Point the CLI at that project. These commands use a local checkout; they do not require MDD to be published.

```sh
node dist/cli.js check --project /path/to/project
node dist/cli.js build --project /path/to/project
```

The build writes `mdd-dist/` in the documentation project. An invalid link or configuration stops the build and leaves the previous output intact.

## Preview locally

```sh
node dist/cli.js dev --project /path/to/project
```

Save a Markdown file and refresh the browser after the rebuild. The preview uses the same static output as a production build.

## Deploy static output

For a project site with a nested prefix, supply the complete public path:

```sh
node dist/cli.js build --project /path/to/project --base-path /repository/docs/
```

Upload the contents of `mdd-dist/` to your static host at that prefix. The prefix changes URLs; it does not add another directory around the output.

> [!TIP]
> **Serving with Node**
>
> Use `mdd serve` to serve an existing build. It does not read or compile your source files. A Railway template is a separate upcoming delivery step.
