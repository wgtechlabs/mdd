---
navTitle: Introduction
order: 0
---
# MDD documentation

MDD turns a folder of Markdown into a documentation site. You keep the files in your repository. MDD builds the pages, navigation, search, and an `llms.txt` index for agents.

This site is built by MDD from the `mdd/` folder of the [MDD repository](https://github.com/wgtechlabs/mdd).

## What you get

- A reader with light and dark modes, search, and a table of contents.
- A Node server with a `/healthz` readiness route.
- Optional page feedback when a PostgreSQL database is available.
- A Docker image that you can deploy on Railway.

## Where to start

1. [Run MDD on your computer](./get-started/index.md).
2. [Set up your MDD folder](./get-started/folder.md).
3. [Configure the site](./configuration/index.md).
4. [Deploy on Railway](./deploy/railway.md).
