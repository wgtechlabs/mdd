---
title: Run MDD on your computer
navTitle: Quick start
order: 1
---
# Run MDD on your computer

You need Docker, or Bun 1.3.10 and Node.js 24 LTS. The server runs on Node.js 22, 24, and 26.

## Run the Docker image

Go to the project that contains your `mdd/` folder. Then start the container:

```sh
docker run --rm -p 3000:3000 -v "$PWD:/workspace" wgtechlabs/mdd:latest
```

Open <http://127.0.0.1:3000/>. The container builds the mounted project, then starts the server.

## Run from a checkout

Clone the MDD repository, install the dependencies, and start the demo:

```sh
bun install --frozen-lockfile
bun run demo
```

Open <http://127.0.0.1:4173/docs/>. The demo serves the example project in `examples/basic/mdd`.

## Next step

[Set up your MDD folder](./folder.md).
