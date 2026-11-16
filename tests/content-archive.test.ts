import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { request, type Server } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { startContainer } from "../src/container-server.js";
import {
  type ArchiveDownloader,
  archiveUrl,
  downloadContentRepository,
} from "../src/content-archive.js";

const run = promisify(execFile);
const roots: string[] = [];
const servers: Server[] = [];
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mdd-archive-"));
  roots.push(root);
  return root;
}

interface TarEntry {
  name: string;
  type?: string;
  data?: string;
  linkname?: string;
}

function header(name: string, type: string, size: number, linkname = "") {
  const buffer = Buffer.alloc(512);
  buffer.write(name.slice(0, 100), 0, "utf8");
  buffer.write("0000644\0", 100);
  buffer.write("0000000\0", 108);
  buffer.write("0000000\0", 116);
  buffer.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
  buffer.write("00000000000\0", 136);
  buffer.write("        ", 148);
  buffer.write(type, 156);
  buffer.write(linkname, 157);
  buffer.write("ustar\0", 257);
  buffer.write("00", 263);
  let sum = 0;
  for (const byte of buffer) sum += byte;
  buffer.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return buffer;
}

function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`;
  let length = body.length + 1;
  while (`${length}${body}`.length !== length) length += 1;
  return `${length}${body}`;
}

function tarGz(commit: string | undefined, entries: TarEntry[]): Uint8Array {
  const parts: Buffer[] = [];
  const add = (name: string, type: string, data: Buffer, linkname = "") => {
    parts.push(header(name, type, data.length, linkname));
    parts.push(data, Buffer.alloc((512 - (data.length % 512)) % 512));
  };
  if (commit) {
    add("pax_global_header", "g", Buffer.from(paxRecord("comment", commit)));
  }
  for (const entry of entries) {
    add(
      entry.name,
      entry.type ?? "0",
      Buffer.from(entry.data ?? ""),
      entry.linkname,
    );
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}

const siteEntries: TarEntry[] = [
  { name: "docs-repo/", type: "5" },
  { name: "docs-repo/mdd/", type: "5" },
  { name: "docs-repo/mdd/contents/", type: "5" },
  { name: "docs-repo/mdd/contents/index.md", data: "# Runtime docs\n" },
];

function serving(archive: Uint8Array, urls: string[] = []): ArchiveDownloader {
  return async (url) => {
    urls.push(url);
    return { status: "ok", body: archive };
  };
}

describe("archive URL", () => {
  test("targets codeload for a SHA, a ref, or the default branch", () => {
    expect(archiveUrl("https://github.com/acme/docs.git", sha)).toBe(
      `https://codeload.github.com/acme/docs/tar.gz/${sha}`,
    );
    expect(archiveUrl("https://github.com/acme/docs", "release/v1")).toBe(
      "https://codeload.github.com/acme/docs/tar.gz/release/v1",
    );
    expect(() => archiveUrl("https://evil.com/acme/docs", "HEAD")).toThrow(
      /MDD_REPO_URL/,
    );
  });
});

describe("runtime download", () => {
  test("downloads the requested SHA and verifies the reported commit", async () => {
    const urls: string[] = [];
    const destination = await tempDir();
    const fetched = await downloadContentRepository({
      repoUrl: "https://github.com/acme/docs",
      repoRef: "main",
      sourceSha: sha.toUpperCase(),
      destination,
      download: serving(tarGz(sha, siteEntries), urls),
    });
    expect(fetched.commit).toBe(sha);
    expect(urls).toEqual([
      `https://codeload.github.com/acme/docs/tar.gz/${sha}`,
    ]);
    expect(
      await readFile(path.join(destination, "mdd/contents/index.md"), "utf8"),
    ).toContain("Runtime docs");
  });

  test("fails closed when the SHA is missing or does not match", async () => {
    const destination = await tempDir();
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        repoRef: "main",
        sourceSha: sha,
        destination,
        download: async () => ({ status: "missing" }),
      }),
    ).rejects.toThrow(/unavailable.*branch HEAD/s);
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        sourceSha: sha,
        destination,
        download: serving(tarGz(otherSha, siteEntries)),
      }),
    ).rejects.toThrow(new RegExp(`${otherSha} does not match`));
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        destination,
        download: serving(tarGz(undefined, siteEntries)),
      }),
    ).rejects.toThrow(/did not report a commit/);
    expect(await readdir(destination)).toEqual([]);
  });

  test("uses the ref or the default branch and records the archive commit", async () => {
    const urls: string[] = [];
    await downloadContentRepository({
      repoUrl: "https://github.com/acme/docs",
      repoRef: "release/v1",
      destination: await tempDir(),
      download: serving(tarGz(sha, siteEntries), urls),
    });
    const fetched = await downloadContentRepository({
      repoUrl: "https://github.com/acme/docs",
      destination: await tempDir(),
      download: serving(tarGz(otherSha, siteEntries), urls),
    });
    expect(fetched.commit).toBe(otherSha);
    expect(urls).toEqual([
      "https://codeload.github.com/acme/docs/tar.gz/release/v1",
      "https://codeload.github.com/acme/docs/tar.gz/HEAD",
    ]);
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        repoRef: "main;rm",
        destination: await tempDir(),
        download: serving(tarGz(sha, siteEntries)),
      }),
    ).rejects.toThrow(/branch or tag/);
  });

  test("rejects traversal and skips links", async () => {
    const parent = await tempDir();
    const destination = path.join(parent, "checkout");
    await mkdir(destination);
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        destination,
        download: serving(
          tarGz(sha, [{ name: "docs-repo/../../escape.md", data: "x" }]),
        ),
      }),
    ).rejects.toThrow(/unsafe path/);
    expect(await readdir(parent)).toEqual(["checkout"]);

    const linked = await tempDir();
    await downloadContentRepository({
      repoUrl: "https://github.com/acme/docs",
      destination: linked,
      download: serving(
        tarGz(sha, [
          ...siteEntries,
          { name: "docs-repo/mdd/secret", type: "2", linkname: "/etc/passwd" },
          { name: "docs-repo/mdd/hard", type: "1", linkname: "docs-repo/x" },
        ]),
      ),
    });
    expect((await readdir(path.join(linked, "mdd"))).sort()).toEqual([
      "contents",
    ]);
  });

  test("rejects a corrupt archive", async () => {
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        destination: await tempDir(),
        download: serving(gzipSync(Buffer.alloc(700, 7))),
      }),
    ).rejects.toThrow(/invalid/);
    await expect(
      downloadContentRepository({
        repoUrl: "https://github.com/acme/docs",
        destination: await tempDir(),
        download: serving(Buffer.from("not gzip")),
      }),
    ).rejects.toThrow(/invalid/);
  });

  test("reads an archive written by git archive", async () => {
    const repo = await tempDir();
    await mkdir(path.join(repo, "docs/contents/guides"), { recursive: true });
    await writeFile(path.join(repo, "docs/contents/index.md"), "# Git docs\n");
    const long = `${"long-name-".repeat(12)}.md`;
    await writeFile(path.join(repo, "docs/contents/guides", long), "# Long\n");
    await run("git", ["init", "-q"], { cwd: repo });
    await run("git", ["add", "."], { cwd: repo });
    await run(
      "git",
      [
        "-c",
        "user.name=MDD Test",
        "-c",
        "user.email=mdd@example.test",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        "fixture",
      ],
      { cwd: repo },
    );
    const head = (
      await run("git", ["rev-parse", "HEAD"], { cwd: repo })
    ).stdout.trim();
    const { stdout } = await run(
      "git",
      ["archive", "--format=tar", `--prefix=docs-${head}/`, "HEAD"],
      { cwd: repo, encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
    );
    const destination = await tempDir();
    const fetched = await downloadContentRepository({
      repoUrl: "https://github.com/acme/docs",
      sourceSha: head,
      destination,
      download: serving(gzipSync(stdout as Buffer)),
    });
    expect(fetched.commit).toBe(head);
    expect(
      await readFile(
        path.join(destination, "docs/contents/guides", long),
        "utf8",
      ),
    ).toBe("# Long\n");
  });
});

async function freePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolve());
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("No port.");
  await new Promise<void>((resolve) => probe.close(() => resolve()));
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

describe("container runtime fetch", () => {
  test("downloads MDD_REPO_URL when no site is baked, then serves it", async () => {
    const parent = await tempDir();
    const port = await freePort();
    const previousDatabase = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    let server: Server;
    try {
      server = await startContainer(
        {
          MDD_PREBUILT_DIR: path.join(parent, "missing-site"),
          MDD_PROJECT_DIR: path.join(parent, "unused-mount"),
          MDD_OUTPUT_DIR: path.join(parent, "out"),
          MDD_REPO_URL: "https://github.com/acme/docs",
          MDD_SOURCE_SHA: sha,
          HOST: "127.0.0.1",
          PORT: String(port),
        },
        { download: serving(tarGz(sha, siteEntries)) },
      );
    } finally {
      if (previousDatabase === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabase;
    }
    servers.push(server);
    expect((await get(port, "/healthz")).status).toBe(200);
    expect((await get(port, "/")).body).toContain("Runtime docs");
    const manifest = JSON.parse(
      await readFile(path.join(parent, "out/mdd-build.json"), "utf8"),
    );
    expect(manifest.source).toEqual({ commit: sha, dirty: null });
  });

  test("does not listen when the requested SHA is unavailable", async () => {
    const parent = await tempDir();
    const port = await freePort();
    await expect(
      startContainer(
        {
          MDD_PREBUILT_DIR: path.join(parent, "missing-site"),
          MDD_OUTPUT_DIR: path.join(parent, "out"),
          MDD_REPO_URL: "https://github.com/acme/docs",
          MDD_SOURCE_SHA: sha,
          HOST: "127.0.0.1",
          PORT: String(port),
        },
        { download: async () => ({ status: "missing" }) },
      ),
    ).rejects.toThrow(/unavailable/);
    await expect(get(port, "/healthz")).rejects.toThrow();
  });
});
