FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json tsconfig.build.json ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
COPY scripts/build.mjs ./scripts/build.mjs
RUN bun run build

FROM oven/bun:1.3.10-alpine AS production-deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# Git exists only in this stage. The final image copies the finished site, not Git.
FROM node:24-alpine AS content

RUN apk add --no-cache git

WORKDIR /app

COPY --from=build /app/dist/ ./dist/
COPY --from=production-deps /app/node_modules/ ./node_modules/
COPY package.json ./
COPY assets/ ./assets/
COPY themes/d/ ./themes/d/

# These arguments belong to this stage only. Railway injects service variables
# into a Dockerfile build when the names match. Keep them after the dependency
# layers. MDD_SOURCE_SHA and RAILWAY_DEPLOYMENT_ID are last so a new commit or
# deployment rebuilds the fetch and leaves the dependency layers cached.
ARG MDD_REPO_URL
ARG MDD_REPO_REF
ARG MDD_SOURCE_DIR
ARG MDD_BASE_PATH
ARG MDD_EDIT_BASE_URL
ARG MDD_SOURCE_SHA
ARG RAILWAY_DEPLOYMENT_ID

RUN mkdir -p /out/site \
    && MDD_REPO_URL="$MDD_REPO_URL" \
    MDD_REPO_REF="$MDD_REPO_REF" \
    MDD_SOURCE_DIR="$MDD_SOURCE_DIR" \
    MDD_BASE_PATH="$MDD_BASE_PATH" \
    MDD_EDIT_BASE_URL="$MDD_EDIT_BASE_URL" \
    MDD_SOURCE_SHA="$MDD_SOURCE_SHA" \
    RAILWAY_DEPLOYMENT_ID="$RAILWAY_DEPLOYMENT_ID" \
    MDD_CONTENT_CHECKOUT=/tmp/mdd-content \
    MDD_OUTPUT_DIR=/out/site \
    node /app/dist/content-fetch.js

FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=3000
ENV MDD_PROJECT_DIR=/workspace
ENV MDD_OUTPUT_DIR=/tmp/mdd-dist
ENV MDD_PREBUILT_DIR=/app/site

WORKDIR /app

COPY package.json ./
COPY --from=production-deps /app/node_modules/ ./node_modules/
RUN node -e 'const fs = require("node:fs"); const path = "/app/package.json"; const manifest = JSON.parse(fs.readFileSync(path, "utf8")); delete manifest.bin; fs.writeFileSync(path, JSON.stringify(manifest));' \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx \
    && mkdir -p /workspace \
    && chown node:node /workspace

COPY --from=build /app/dist/ ./dist/
COPY --from=content /out/site /app/site
COPY assets/ ./assets/
COPY themes/d/ ./themes/d/

USER node
WORKDIR /workspace

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
ENTRYPOINT ["node", "/app/dist/container-server.js"]
