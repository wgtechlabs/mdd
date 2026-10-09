# Build Flow and application delivery

MDD is the documentation application. Only `mdd-engine` is published to npm and GitHub Packages. MDD consumes the released engine as a dependency and does not need its own npm token, Trusted Publisher, or first-package bootstrap.

The caller is `.github/workflows/build-flow.yml`, pinned to Build Flow v1.0.0. It uses Bun 1.3.10 and validates Node 22, 24, and 26, with isolated Node runtime checks and a dependency audit.

## Current configuration

- `package.json` has `private: true` to prevent accidental npm publication. This does not change the GitHub repository's public visibility.
- Build Flow uses `enable-package: false` permanently for the application. There is no `MDD_PUBLISHING_ENABLED` activation variable.
- GitHub Releases remain disabled with `enable-release: false` until application delivery is configured. They are separate from package registry publication and do not depend on an MDD npm package.
- Container publishing remains disabled because this phase has no production container or Railway template.
- The pinned orchestrator requires a successful enabled artifact flow before a GitHub Release. Enabling releases alone is insufficient; configure the intended application artifact, such as a container, when implementing deployment.
- The caller retains permissions declared by the pinned reusable workflow chain, including its container workflow's package permission. It does not request `id-token: write` because MDD has no OIDC publishing flow.
- CodeQL is enabled automatically for public-repository events. Private copies can set `MDD_PRIVATE_CODEQL_ENABLED=true` after verifying that GitHub code scanning is available. This condition does not grant scanning access or change visibility.

The CLI and build API run from a built checkout. The smoke check creates and installs a temporary local archive to verify the CLI, server, assets, and Node compatibility outside the development checkout; it does not publish MDD to any registry.

## Delivery workflow

Use feature/fix → dev squash PRs and dev → main regular merge PRs through Clean Workflow. Verify the current-head CI and security checks before merging. Application GitHub Releases, deployment builds, and a future Railway template can be configured independently of npm when that delivery work is implemented.

The maintainer made MDD public on October 10, 2026. The main build [37967930053](https://github.com/wgtechlabs/mdd/actions/runs/37967930053) passed the supported Node matrix, Gitleaks, and CodeQL. Earlier private-repository failures reflected unavailable organization secrets under GitHub Free. No registry publication or live deployment is claimed by those checks.
