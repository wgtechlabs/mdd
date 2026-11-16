# Build Flow and application delivery

MDD Standard is the current product focus, with Railway/Postgres as the recommended deployment and one user content repository per deployment. A usable `DATABASE_URL` enables the built-in feedback plugin through MDD's namespaced Plugin Storage API; without usable database storage, docs remain available with database-backed features disabled. MDD Light static hosting through GitHub Pages is planned for later and will use a different installation flow. Railway template creation is separate work. Only `mdd-engine` is published to npm and GitHub Packages. MDD consumes the released engine as a dependency and does not need its own npm token, Trusted Publisher, or first-package bootstrap.

The caller is `.github/workflows/build-flow.yml`, pinned to Build Flow v1.0.0. It uses Bun 1.3.10 and validates Node 22, 24, and 26, with isolated Node runtime checks and a dependency audit.

## Current configuration

- `package.json` has `private: true` to prevent accidental npm publication. This does not change the GitHub repository's public visibility.
- Build Flow uses `enable-package: false` permanently for the application. There is no `MDD_PUBLISHING_ENABLED` activation variable.
- GitHub Releases are enabled with `enable-release: true`. Build Flow creates a versioned release on eligible `main` updates when its version plan finds a change and every enabled artifact flow succeeds. The initial version defaults to `0.1.0`; releases are separate from package registry publication and do not depend on an MDD npm package.
- Container publishing is enabled with `enable-container: true`. All container artifact options use the pinned Build Flow Action defaults, including publishing to Docker Hub and GHCR. The organization secrets `DOCKER_HUB_USERNAME` and `DOCKER_HUB_ACCESS_TOKEN` are inherited by the reusable workflow.
- The pinned orchestrator requires successful enabled artifact publishing before a GitHub Release. With container publishing enabled, failed container publication blocks the release; Railway delivery is not a prerequisite.
- The caller retains permissions declared by the pinned reusable workflow chain, including its container workflow's package permission. It does not request `id-token: write` because MDD has no OIDC publishing flow.
- CodeQL is enabled automatically for public-repository events. Private copies can set `MDD_PRIVATE_CODEQL_ENABLED=true` after verifying that GitHub code scanning is available. This condition does not grant scanning access or change visibility.

The Dockerfile compiles the MDD renderer with Bun and runs the Node 24 LTS server. A content stage fetches a public GitHub repository when `MDD_REPO_URL` is set, compiles it, and copies the finished site into the final image. Git is installed only in that stage. `MDD_SOURCE_SHA` and `RAILWAY_DEPLOYMENT_ID` are build args immediately before the fetch, so dependency layers stay cached. The final image does not include Git or Railway Config as Code. Without `MDD_REPO_URL`, startup builds the MDD folder of the project mounted at `/workspace` (`mdd/`, else `docs/`) into `/tmp/mdd-dist` and serves it on `PORT` (default `3000`). Mount a project containing an `mdd/` folder at `/workspace`; set `MDD_PROJECT_DIR`, `MDD_DOCS_DIR`, or `MDD_OUTPUT_DIR` to customize those paths.

The smoke check creates and installs a temporary local archive to verify the renderer API, server, assets, and Node compatibility outside the development checkout; it asserts that the package exposes no CLI binary. It does not publish MDD to any registry.

## Delivery workflow

Use feature/fix → dev squash PRs and dev → main regular merge PRs through Clean Workflow. Verify current-head CI and security checks before merging. Eligible successful `main` builds can publish versioned GitHub Releases and the configured containers; this does not mean either hosting installation flow is complete. The current application priority is MDD Standard's database-backed feedback capability. Railway template creation remains separate; MDD Light/GitHub Pages support follows later. Configure Railway delivery independently of npm; each deployment reads one public content repository.

The maintainer made MDD public on October 10, 2026. The main build [37967930053](https://github.com/wgtechlabs/mdd/actions/runs/37967930053) passed the supported Node matrix, Gitleaks, and CodeQL. Earlier private-repository failures reflected unavailable organization secrets under GitHub Free. No registry publication or live deployment is claimed by those checks.
