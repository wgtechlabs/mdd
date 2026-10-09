import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { request, type Server } from "node:http";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "../src/build.js";
import { listTree } from "../src/files.js";
import type { BuildManifest } from "../src/manifest.js";
import { serve } from "../src/server.js";

const directories: string[] = [];
const servers: Server[] = [];

async function writeInventory(directory: string): Promise<void> {
  const { files } = await listTree(directory);
  const entries = await Promise.all(
    files
      .filter((name) => name !== ".mdd-output.json")
      .map(async (name) => [
        name,
        createHash("sha256")
          .update(await readFile(join(directory, name)))
          .digest("hex"),
      ]),
  );
  await writeFile(
    join(directory, ".mdd-output.json"),
    JSON.stringify({ schemaVersion: 1, files: Object.fromEntries(entries) }),
  );
}

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(basePath = "/"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "mdd-server-"));
  directories.push(directory);
  const manifest: BuildManifest = {
    schemaVersion: 1,
    mddVersion: "0.1.0",
    engineVersion: "0.1.0",
    basePath,
    source: { commit: null, dirty: true },
  };
  await mkdir(join(directory, "guide", "deep"), { recursive: true });
  await mkdir(join(directory, "assets"));
  await mkdir(join(directory, "markdown"));
  await mkdir(join(directory, "_mdd"));
  await Promise.all(
    Object.entries({
      "index.html": "<h1>Home</h1>",
      "404.html": "<h1>Page not found</h1>",
      "_mdd/reader.css": "body { color: black; }",
      "_mdd/reader.js": "// Reader enhancements",
      "guide/deep/index.html": "<h1>Deep page</h1>",
      "assets/theme.css": "body { color: red; }",
      "assets/theme.js": 'document.body.dataset.ready = "true";',
      "assets/search.json": '{"pages":[]}',
      "assets/guide.pdf": "%PDF-1.7 fixture",
      "markdown/guide.md": "# Guide",
      "markdown/index.md": "# Home",
      "llms.txt": "Documentation index",
      "mdd-build.json": JSON.stringify(manifest),
    }).map(([path, contents]) => writeFile(join(directory, path), contents)),
  );
  await writeInventory(directory);
  return directory;
}

async function start(directory: string): Promise<number> {
  const server = await serve({ directory, port: 0 });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected an HTTP listening port.");
  return address.port;
}

function get(
  port: number,
  path: string,
  method = "GET",
): Promise<{
  status: number;
  headers: import("node:http").IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const call = request(
      { host: "127.0.0.1", port, path, method },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        response.on("error", reject);
      },
    );
    call.on("error", reject);
    call.end();
  });
}

// Send unsafe paths literally; HTTP client URL normalization can hide traversal.
function rawGet(
  port: number,
  path: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`,
      );
    });
    let received = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      received += chunk;
      const boundary = received.indexOf("\r\n\r\n");
      if (boundary < 0) return;
      const length = /content-length: (\d+)/i.exec(received.slice(0, boundary));
      const body = received.slice(boundary + 4);
      if (length && Buffer.byteLength(body) >= Number(length[1])) {
        resolve({ status: Number(received.split(" ")[1]), body });
        socket.destroy();
      }
    });
    socket.on("error", reject);
    socket.on("end", () =>
      resolve({
        status: Number(received.split(" ")[1]),
        body: received.slice(received.indexOf("\r\n\r\n") + 4),
      }),
    );
  });
}

describe("static server", () => {
  for (const prefix of ["/", "/docs/", "/repository/docs/", "/%C2%A0/"]) {
    test(`serves real pages, assets, Markdown, and 404s under ${prefix}`, async () => {
      const port = await start(await fixture(prefix));
      const home = await get(port, prefix);
      expect(home.status).toBe(200);
      expect(home.body).toBe("<h1>Home</h1>");
      expect(home.headers["x-content-type-options"]).toBe("nosniff");
      expect((await get(port, `${prefix}guide/deep/`)).body).toBe(
        "<h1>Deep page</h1>",
      );
      const redirect = await get(port, `${prefix}guide/deep?search=one`);
      expect(redirect.status).toBe(308);
      expect(redirect.headers.location).toBe(`${prefix}guide/deep/?search=one`);
      for (const [path, type] of [
        ["assets/theme.css", "text/css"],
        ["assets/theme.js", "text/javascript"],
        ["assets/search.json", "application/json"],
        ["assets/guide.pdf", "application/pdf"],
        ["markdown/guide.md", "text/markdown"],
        ["llms.txt", "text/plain"],
        ["mdd-build.json", "application/json"],
      ]) {
        const result = await get(port, `${prefix}${path}`);
        expect(result.status).toBe(200);
        expect(result.headers["content-type"]).toStartWith(type ?? "");
      }
      const missing = await get(port, `${prefix}missing`);
      expect(missing.status).toBe(404);
      expect(missing.body).toBe("<h1>Page not found</h1>");
      if (prefix !== "/") {
        expect((await get(port, "/")).status).toBe(404);
        expect(
          (await get(port, `${prefix.slice(0, -1)}?a=1`)).headers.location,
        ).toBe(`${prefix}?a=1`);
        expect((await get(port, `${prefix.slice(0, -1)}-other/`)).status).toBe(
          404,
        );
      }
      expect((await get(port, "/healthz")).status).toBe(200);
    });
  }

  test("serves encoded Unicode prefixes and decodes asset and route names exactly once", async () => {
    const prefix = "/caf%C3%A9/%23%25/";
    const directory = await fixture(prefix);
    const names = [
      "café",
      "with space",
      "100%",
      "hash#",
      "question?",
      "%2e%2e",
    ];
    for (const name of names) {
      await mkdir(join(directory, name));
      await writeFile(join(directory, name, "index.html"), `<h1>${name}</h1>`);
      await writeFile(join(directory, "markdown", `${name}.md`), `# ${name}`);
    }
    await writeInventory(directory);
    const port = await start(directory);
    expect((await get(port, prefix)).status).toBe(200);
    expect((await get(port, prefix.slice(0, -1))).headers.location).toBe(
      prefix,
    );
    for (const name of names) {
      const encoded = encodeURIComponent(name);
      expect((await get(port, `${prefix}${encoded}/`)).body).toBe(
        `<h1>${name}</h1>`,
      );
      expect(
        (await get(port, `${prefix}${encoded}?q=1`)).headers.location,
      ).toBe(`${prefix}${encoded}/?q=1`);
      expect((await get(port, `${prefix}markdown/${encoded}.md`)).body).toBe(
        `# ${name}`,
      );
    }
  });

  test("HEAD returns the GET status and length without a body, and mutation methods fail", async () => {
    const port = await start(await fixture());
    for (const path of ["/", "/missing", "/healthz"]) {
      const full = await get(port, path);
      const head = await get(port, path, "HEAD");
      expect(head.status).toBe(full.status);
      expect(head.headers["content-length"]).toBe(
        full.headers["content-length"],
      );
      expect(head.body).toBe("");
    }
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const result = await get(port, "/", method);
      expect(result.status).toBe(405);
      expect(result.headers.allow).toBe("GET, HEAD");
    }
  });

  test("rejects raw and encoded traversal, sensitive files, and file or directory symlinks", async () => {
    const directory = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "mdd-outside-"));
    directories.push(outside);
    const port = await start(directory);
    await Promise.all([
      writeFile(join(outside, "private.txt"), "outside secret"),
      writeFile(join(directory, ".env"), "secret"),
      writeFile(join(directory, "package.json"), '{"private":"secret"}'),
      writeFile(join(directory, "credentials.json"), '{"secret":true}'),
      mkdir(join(directory, ".git")),
    ]);
    await writeFile(join(directory, ".git", "config"), "git secret");
    await Promise.all([
      symlink(join(outside, "private.txt"), join(directory, "escaped.txt")),
      symlink(join(directory, "index.html"), join(directory, "linked.html")),
      symlink(outside, join(directory, "outside")),
      symlink(join(directory, "guide"), join(directory, "linked-guide")),
    ]);
    for (const path of [
      "/../private.txt",
      "/%2e%2e/private.txt",
      "/%252e%252e/private.txt",
      "/guide/../../private.txt",
      "/guide/../index.html",
      "/guide/%2e%2e/index.html",
      "/guide%2f..%2fprivate.txt",
      "/guide%5c..%5cprivate.txt",
      "/guide\\..\\private.txt",
      "/%00index.html",
      "/%ZZ",
      "//index.html",
      "/.env",
      "/%2eenv",
      "/.git/config",
      "/.mdd-output.json",
      "/package.json",
      "/credentials.json",
      "/escaped.txt",
      "/linked.html",
      "/outside/private.txt",
      "/linked-guide/deep/",
    ]) {
      const result = await rawGet(port, path);
      expect(result.status, path).toBe(404);
      expect(result.body).toBe("<h1>Page not found</h1>");
    }
  });

  test("health becomes unavailable when any required output is missing or replaced by a symlink", async () => {
    const directory = await fixture("/docs/");
    const port = await start(directory);
    for (const filename of [
      "index.html",
      "404.html",
      "mdd-build.json",
      "guide/deep/index.html",
      "_mdd/reader.css",
    ]) {
      const contents =
        filename === "mdd-build.json"
          ? await get(port, "/docs/mdd-build.json")
          : await get(port, `/docs/${filename}`);
      await rm(join(directory, filename));
      expect((await get(port, "/healthz")).status).toBe(503);
      await writeFile(join(directory, filename), contents.body);
      expect((await get(port, "/healthz")).status).toBe(200);
    }
    const inventory = await readFile(join(directory, ".mdd-output.json"));
    await writeFile(join(directory, ".mdd-output.json"), "{}");
    expect((await get(port, "/healthz")).status).toBe(503);
    await writeFile(join(directory, ".mdd-output.json"), inventory);
    await rm(join(directory, "index.html"));
    await symlink(join(directory, "404.html"), join(directory, "index.html"));
    expect((await get(port, "/healthz")).status).toBe(503);
    expect((await get(port, "/docs/")).status).toBe(404);
  });

  test("rejects incomplete output and malformed or unsafe manifests before listening", async () => {
    const directory = await fixture();
    await rm(join(directory, "404.html"));
    await expect(serve({ directory, port: 0 })).rejects.toThrow(
      "Incomplete mdd build",
    );
    await writeFile(join(directory, "404.html"), "Not found");
    for (const basePath of [
      "/docs",
      "/docs/../",
      "/docs\\bad/",
      "//docs/",
      "/%2e%2e/",
      "/docs/?bad/",
      "/docs/#bad/",
    ]) {
      await writeFile(
        join(directory, "mdd-build.json"),
        JSON.stringify({
          schemaVersion: 1,
          mddVersion: "0.1.0",
          engineVersion: "0.1.0",
          basePath,
          source: { commit: null, dirty: null },
        }),
      );
      await writeInventory(directory);
      await expect(serve({ directory, port: 0 })).rejects.toThrow(
        "Invalid mdd-build.json",
      );
    }
    for (const manifest of ["{", "{}", '{"schemaVersion":2}']) {
      await writeFile(join(directory, "mdd-build.json"), manifest);
      await writeInventory(directory);
      await expect(serve({ directory, port: 0 })).rejects.toThrow();
    }
  });

  test("rejects malformed inventories, missing required entries, unowned files, and changed output before listening", async () => {
    const directory = await fixture();
    const original = await readFile(
      join(directory, ".mdd-output.json"),
      "utf8",
    );
    for (const inventory of [
      "{}",
      '{"schemaVersion":2,"files":{}}',
      '{"schemaVersion":1,"files":[]}',
    ]) {
      await writeFile(join(directory, ".mdd-output.json"), inventory);
      await expect(serve({ directory, port: 0 })).rejects.toThrow("Invalid");
    }
    for (const name of [
      "../outside.txt",
      "/absolute.txt",
      ".env",
      "folder\\file.txt",
    ]) {
      const inventory = JSON.parse(original);
      inventory.files[name] = "a".repeat(64);
      await writeFile(
        join(directory, ".mdd-output.json"),
        JSON.stringify(inventory),
      );
      await expect(serve({ directory, port: 0 })).rejects.toThrow(
        "Invalid output inventory entry",
      );
    }
    const missing = JSON.parse(original);
    delete missing.files["_mdd/reader.css"];
    await writeFile(
      join(directory, ".mdd-output.json"),
      JSON.stringify(missing),
    );
    await expect(serve({ directory, port: 0 })).rejects.toThrow("Incomplete");
    const invalidHash = JSON.parse(original);
    invalidHash.files["index.html"] = "invalid";
    await writeFile(
      join(directory, ".mdd-output.json"),
      JSON.stringify(invalidHash),
    );
    await expect(serve({ directory, port: 0 })).rejects.toThrow(
      "Invalid output inventory entry",
    );
    await writeFile(join(directory, ".mdd-output.json"), original);
    await writeFile(join(directory, "unrelated.txt"), "Not generated");
    await expect(serve({ directory, port: 0 })).rejects.toThrow("do not match");
    await rm(join(directory, "unrelated.txt"));
    await writeFile(join(directory, "index.html"), "Changed after build");
    await expect(serve({ directory, port: 0 })).rejects.toThrow(
      "missing or changed",
    );
  });

  test("an actual export is unhealthy when a declared page or stylesheet disappears, and never serves added files", async () => {
    const project = await mkdtemp(join(tmpdir(), "mdd-server-export-"));
    directories.push(project);
    await mkdir(join(project, "mdd/contents"), { recursive: true });
    await writeFile(
      join(project, "mdd/contents/index.md"),
      "# Home\n\n[Guide](guide.md)\n",
    );
    await writeFile(join(project, "mdd/contents/guide.md"), "# Guide\n");
    const result = await build({ projectDir: project });
    if (!result.site) throw new Error(JSON.stringify(result.diagnostics));
    const port = await start(result.directory);
    await writeFile(join(result.directory, "unrelated.txt"), "Not generated");
    expect((await get(port, "/unrelated.txt")).status).toBe(404);
    expect((await get(port, "/.mdd-output.json")).status).toBe(404);
    expect((await get(port, "/healthz")).status).toBe(200);
    for (const name of ["guide/index.html", "_mdd/reader.css"]) {
      const contents = await readFile(join(result.directory, name));
      await rm(join(result.directory, name));
      expect((await get(port, "/healthz")).status).toBe(503);
      await writeFile(join(result.directory, name), contents);
      expect((await get(port, "/healthz")).status).toBe(200);
    }
  });
});
