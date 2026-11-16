---
title: Deploy on Railway
navTitle: Railway
order: 1
---
# Deploy on Railway

Railway runs the published MDD Docker image. At startup, the container downloads your public content repository, builds the site, and serves it.

> [!NOTE]
> Startup download needs an image that includes it. Older images serve only a baked site or a mounted project.

## Create the services

1. Create a service from the Docker image `wgtechlabs/mdd:latest`.
2. Optional: add a PostgreSQL service to turn on page feedback.
3. Set the variables below.
4. Set the healthcheck path to `/healthz`.
5. Generate a public domain. Keep its target port on the `PORT` that Railway sets.

## Variables

| Variable | Value |
| --- | --- |
| `MDD_REPO_URL` | Required. Public `https://github.com/owner/repository` URL of your docs. |
| `MDD_REPO_REF` | Optional branch or tag. Defaults to the default branch. |
| `MDD_SOURCE_SHA` | Optional full commit SHA. Set it to pin the docs to one commit. |
| `MDD_SOURCE_DIR` | Optional MDD folder. Defaults to `mdd/`, then `docs/`. |
| `MDD_BASE_PATH` | Optional public prefix. Defaults to `/`. |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `MDD_TRUST_PROXY` | `true` |

## Port

Railway sets `PORT`, usually to `8080`, and MDD listens on it. Do not set the domain's target port to `3000`. The image's `EXPOSE 3000` is only for local `docker run`.

## Update the docs

1. Set `MDD_SOURCE_SHA` to the new commit.
2. Redeploy the service.

MDD downloads the content once, when the container starts. It does not watch the repository. If MDD cannot get the commit, the new deployment fails and Railway keeps the old one.

## Try the demo

Set `MDD_REPO_URL` to `https://github.com/wgtechlabs/mdd` and `MDD_SOURCE_DIR` to `examples/basic/mdd`.
