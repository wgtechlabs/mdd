# Build Flow and application delivery

MDD is the documentation server and frontend intended for delivery through a Railway template, with one content repository per deployment. Only `mdd-engine` is published to npm and GitHub Packages. MDD consumes the released engine as a dependency and does not need its own npm token, Trusted Publisher, or first-package bootstrap.

The caller is `.github/workflows/build-flow.yml`, pinned to Build Flow v1.0.0. It uses Bun 1.3.10 and validates Node 22, 24, and 26, with isolated Node runtime checks and a dependency audit.

## Current configuration

- `package.json` has `private: true` to prevent accidental npm publication. This does not change the GitHub repository's public visibility.
- Build Flow uses `enable-package: false` permanently for the application. There is no `MDD_PUBLISHING_ENABLED` activation variable.
- GitHub Releases are enabled with `enable-release: true`. Build Flow creates a versioned release on eligible `main` updates when its version plan finds a change and every enabled artifact flow succeeds. The initial version defaults to `0.1.0`; releases are separate from package registry publication and do not depend on an MDD npm package.
- Container publishing is enabled with `enable-container: true`. All container artifact options use the pinned Build Flow Action defaults, including publishing to Docker Hub and GHCR. The organization secrets `DOCKER_HUB_USERNAME` and `DOCKER_HUB_ACCESS_TOKEN` are inherited by the reusable workflow.
- The pinned orchestrator requires successful enabled artifact publishing before a GitHub Release. With container publishing enabled, failed container publication blocks the release; Railway delivery is not a prerequisite.
- The caller retains permissions declared by the pinned reusable workflow chain, including its container workflow's package permission. It does not request `id-token: write` because MDD has no OIDC publishing flow.
- CodeQL is enabled automatically for public-repository events. Private copies can set `MDD_PRIVATE_CODEQL_ENABLED=true` after verifying that GitHub code scanning is available. This condition does not grant scanning access or change visibility.

The Dockerfile compiles the MDD renderer with Bun and runs the Node 24 LTS server. At startup, the server builds the mounted project at `/workspace/mdd` into `/tmp/mdd-dist` and serves the rendered site on `PORT` (default `3000`). Mount a project containing an `mdd/` directory at `/workspace`; set `MDD_PROJECT_DIR`, `MDD_DOCS_DIR`, or `MDD_OUTPUT_DIR` to customize those paths. The image does not fetch a separate content repository or deploy a Railway service.

The smoke check creates and installs a temporary local archive to verify the renderer API, server, assets, and Node compatibility outside the development checkout; it asserts that the package exposes no CLI binary. It does not publish MDD to any registry.

## Delivery workflow

Use feature/fix → dev squash PRs and dev → main regular merge PRs through Clean Workflow. Verify current-head CI and security checks before merging. Eligible successful `main` builds can publish versioned GitHub Releases and the configured containers. The next delivery work is the Railway template and its application build/start configuration. Configure it independently of npm; each deployment reads one public content repository.

The maintainer made MDD public on October 10, 2026. The main build [37967930053](https://github.com/wgtechlabs/mdd/actions/runs/37967930053) passed the supported Node matrix, Gitleaks, and CodeQL. Earlier private-repository failures reflected unavailable organization secrets under GitHub Free. No registry publication or live deployment is claimed by those checks.
