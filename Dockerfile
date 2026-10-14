FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app

COPY package.json bun.lock tsconfig.json tsconfig.build.json ./
RUN bun install --frozen-lockfile

COPY src/ ./src/
RUN bun run build

FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY --from=build /app/dist/ ./dist/
COPY assets/ ./assets/
COPY themes/d/ ./themes/d/

WORKDIR /workspace

EXPOSE 3000
ENTRYPOINT ["node", "/app/dist/cli.js"]
