---
title: Environment variables
navTitle: Environment variables
order: 2
---
# Environment variables

The server reads these variables when it starts.

## Content source

| Variable | Use |
| --- | --- |
| `MDD_REPO_URL` | Public `https://github.com/owner/repository` URL. If set, MDD downloads this repository instead of using a mounted project. |
| `MDD_REPO_REF` | Branch or tag to download. Defaults to the default branch. |
| `MDD_SOURCE_SHA` | Full commit SHA to download. If MDD cannot get this commit, startup fails. |
| `MDD_SOURCE_DIR` | MDD folder in the downloaded repository. Defaults to `mdd/`, then `docs/`. |
| `MDD_PROJECT_DIR` | Mounted project root. Defaults to `/workspace` in the Docker image. |
| `MDD_DOCS_DIR` | MDD folder in the mounted project. Defaults to `mdd/`, then `docs/`. |

See [the MDD folder](../get-started/folder.md) for how MDD picks the folder.

## Site

| Variable | Use |
| --- | --- |
| `MDD_BASE_PATH` | Public prefix, such as `/docs/`. Defaults to `/`. |
| `MDD_EDIT_BASE_URL` | HTTPS editor prefix for **Edit this markdown** links, such as `https://github.com/owner/repository/edit/main/`. |
| `MDD_OUTPUT_DIR` | Build output folder. Defaults to `/tmp/mdd-dist` in the Docker image. |

## Server

| Variable | Use |
| --- | --- |
| `PORT` | Port to listen on. Defaults to `3000`. Railway sets it for you. |
| `HOST` | Interface to bind. Defaults to `0.0.0.0`. |
| `DATABASE_URL` | PostgreSQL connection string. Enables page feedback. Without it, docs still work. |
| `MDD_TRUST_PROXY` | Set to `true` behind Railway, so the feedback rate limit uses the `X-Real-IP` header. |
