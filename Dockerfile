FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json tsconfig.build.json ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
RUN bun run build

FROM oven/bun:1.3.10-alpine AS production-deps

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json ./
COPY --from=production-deps /app/node_modules/ ./node_modules/
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx \
    && mkdir -p /workspace \
    && chown node:node /workspace

COPY --from=build /app/dist/ ./dist/
COPY assets/ ./assets/
COPY themes/d/ ./themes/d/

USER node
WORKDIR /workspace

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
ENTRYPOINT ["node", "/app/dist/cli.js"]
