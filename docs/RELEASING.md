# Build Flow and publication

The caller is `.github/workflows/build-flow.yml`, pinned to the same verified Build Flow v1.0.0 revision as mdd-engine. It uses Bun 1.3.10 and validates Node 22, 24, and 26, with packaged Node runtime checks and a dependency audit.

## Temporary bootstrap gates

- `MDD_PUBLISHING_ENABLED` is a repository variable, unset by default. Until it equals `true`, both package and GitHub Release flows are disabled. This is deliberate: the MDD package has not been bootstrapped, npm Trusted Publishing has not been configured for it, and initial local implementation does not authorize publication.
- The repository is public as of October 10, 2026. CodeQL is enabled automatically for public-repository events. Private copies can set `MDD_PRIVATE_CODEQL_ENABLED=true` after verifying that GitHub code scanning is available. This condition does not change repository visibility or grant scanning access.

These are activation gates, not channel overrides. Once publication is enabled, the orchestrator inherits development, PR, manual, stable, npm OIDC, and both-registry behavior. Package publication must succeed before the GitHub Release. Container publishing stays disabled: there is no container in this phase.

## First publication checklist

1. Confirm package identity `@wgtechlabs/mdd`, MIT licensing, repository visibility, and the intended public package contents.
2. Complete the first npm publication using the reviewed local archive and the maintainer's npm authentication. Do not place tokens or OTPs in source or chat.
3. Configure npm Trusted Publishing for this repository and the exact workflow identity required by the Build Flow reusable workflow chain. Verify the provider record, rather than copying the engine's account configuration blindly.
4. Confirm GitHub Packages access with the built-in `GITHUB_TOKEN` and caller `packages: write`; preserve `id-token: write` for npm OIDC.
5. Set `MDD_PUBLISHING_ENABLED=true` once the maintainer authorizes automated publication. Verify a development package in both registries before a stable release.
6. Use feature/fix → dev squash PRs and dev → main regular merge PRs through Clean Workflow. Confirm actual registry versions and the completed GitHub Release after promotion.

Repository secrets and variables are not created by this local setup. Remote CI has run for PR #1. Earlier private-repository runs received no Gitleaks license because GitHub Free does not provide organization-level secrets to private repositories. The maintainer made this repository public; fresh current-head checks must confirm secret scanning and CodeQL before merging. Package publication and deployment remain inactive. See the separate engine repository for the already completed engine release.
