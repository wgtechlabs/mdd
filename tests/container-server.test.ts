import { afterEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { request, type Server } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "../src/build.js";
import {
  findPrebuiltSite,
  serverListenOptions,
  startContainer,
} from "../src/container-server.js";

const roots: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mdd-container-"));
  roots.push(root);
  return root;
}

async function project(): Promise<string> {
  const root = await tempDir();
  await mkdir(path.join(root, "mdd/contents"), { recursive: true });
  await writeFile(path.join(root, "mdd/config.json"), "{}");
  await writeFile(path.join(root, "mdd/contents/index.md"), "# Welcome\n");
  return root;
}

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolve());
  });
  const address = probe.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a free TCP port.");
  }
  await new Promise<void>((resolve, reject) => {
    probe.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

function get(
  port: number,
  pathname: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const call = request(
      { host: "127.0.0.1", port, path: pathname },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    call.on("error", reject);
    call.end();
  });
}

async function listen(
  env: NodeJS.ProcessEnv,
): Promise<{ server: Server; port: number }> {
  const port = await freePort();
  const previousDatabase = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const server = await startContainer({
      ...env,
      HOST: "127.0.0.1",
      PORT: String(port),
    });
    servers.push(server);
    return { server, port };
  } finally {
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  }
}

describe("container startup", () => {
  test("binds the public interface and Railway port by default", () => {
    expect(serverListenOptions({})).toEqual({ host: "0.0.0.0", port: 3000 });
    expect(serverListenOptions({ HOST: "", PORT: "8080" })).toEqual({
      host: "0.0.0.0",
      port: 8080,
    });
    expect(() => serverListenOptions({ PORT: "0" })).toThrow(/PORT/);
  });

  test("serves a baked site without building the mount", async () => {
    const source = await project();
    const built = await build({
      projectDir: source,
      outDir: path.join(await tempDir(), "baked"),
    });
    if (!built.directory) throw new Error("Expected a baked site.");
    const empty = await tempDir();
    const { port } = await listen({
      MDD_PREBUILT_DIR: built.directory,
      MDD_PROJECT_DIR: empty,
      MDD_OUTPUT_DIR: path.join(empty, "should-not-build"),
    });
    expect((await get(port, "/healthz")).status).toBe(200);
    expect((await get(port, "/")).body).toContain("Welcome");
    expect(
      await readFile(
        path.join(empty, "should-not-build", "index.html"),
        "utf8",
      ).catch(() => null),
    ).toBeNull();
  });

  test("builds the mounted project when the image has no baked site", async () => {
    const source = await project();
    const parent = await tempDir();
    const emptySite = path.join(parent, "empty-site");
    await mkdir(emptySite);
    const { port } = await listen({
      MDD_PREBUILT_DIR: emptySite,
      MDD_PROJECT_DIR: source,
      MDD_OUTPUT_DIR: path.join(parent, "out"),
    });
    expect((await get(port, "/healthz")).status).toBe(200);
    expect((await get(port, "/")).body).toContain("Welcome");
  });

  test("builds a mounted docs/ folder when mdd/ is absent", async () => {
    const source = await tempDir();
    await mkdir(path.join(source, "docs/contents"), { recursive: true });
    await writeFile(path.join(source, "docs/contents/index.md"), "# Docs\n");
    const parent = await tempDir();
    const { port } = await listen({
      MDD_PREBUILT_DIR: path.join(parent, "missing-site"),
      MDD_PROJECT_DIR: source,
      MDD_OUTPUT_DIR: path.join(parent, "out"),
    });
    expect((await get(port, "/")).body).toContain("Docs");
  });

  test("refuses to start without an MDD folder instead of serving a blank site", async () => {
    const source = await tempDir();
    const parent = await tempDir();
    await expect(
      startContainer({
        MDD_PREBUILT_DIR: path.join(parent, "missing-site"),
        MDD_PROJECT_DIR: source,
        MDD_OUTPUT_DIR: path.join(parent, "out"),
        PORT: String(await freePort()),
        HOST: "127.0.0.1",
      }),
    ).rejects.toThrow(/No MDD folder found\. Checked mdd\/ and docs\//);
    await expect(
      startContainer({
        MDD_PREBUILT_DIR: path.join(parent, "missing-site"),
        MDD_PROJECT_DIR: await project(),
        MDD_DOCS_DIR: "docs",
        MDD_OUTPUT_DIR: path.join(parent, "out"),
        PORT: String(await freePort()),
        HOST: "127.0.0.1",
      }),
    ).rejects.toThrow(/MDD_DOCS_DIR=docs is not an MDD folder/);
  });

  test("rejects an unsafe prebuilt manifest instead of using the mount", async () => {
    const parent = await tempDir();
    const site = path.join(parent, "site");
    const outside = path.join(parent, "outside.json");
    await mkdir(site);
    await writeFile(outside, "{}");
    await symlink(outside, path.join(site, "mdd-build.json"));
    await expect(findPrebuiltSite(site)).rejects.toThrow(/regular file/);
    await expect(
      findPrebuiltSite(path.join(parent, "missing")),
    ).resolves.toBeUndefined();
    const empty = path.join(parent, "empty");
    await mkdir(empty);
    await expect(findPrebuiltSite(empty)).resolves.toBeUndefined();
    const linked = path.join(parent, "linked");
    await symlink(site, linked);
    await expect(findPrebuiltSite(linked)).rejects.toThrow(/real directory/);
  });
});
