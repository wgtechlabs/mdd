---
title: Deploy MDD
navTitle: Overview
order: 3
---
# Deploy MDD

MDD runs as one Docker container that serves one documentation site. The image is published as `wgtechlabs/mdd` on Docker Hub and `ghcr.io/wgtechlabs/mdd` on GitHub Container Registry.

The container gets its content in one of three ways. It uses the first one that applies:

1. **Baked site.** The image was built with `MDD_REPO_URL` as a build argument. The site is already inside the image.
2. **Download at startup.** `MDD_REPO_URL` is set when the container starts. MDD downloads the repository, builds the site, and then starts listening.
3. **Mounted project.** No repository is set. MDD builds the project mounted at `/workspace`.

In every case, `/healthz` returns 200 only after the site is ready.

[Deploy on Railway](./railway.md) with the Docker image.
