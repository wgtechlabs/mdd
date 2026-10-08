import { afterEach, expect, test } from "bun:test";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const fixtures: string[] = [];
const children: ChildProcess[] = [];

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdd-cli-"));
  fixtures.push(root);
  await mkdir(join(root, "mdd", "contents"), { recursive: true });
  await writeFile(
    join(root, "mdd", "contents", "index.md"),
    "# My documentation\n\nHello reader.\n",
  );
  return root;
}

function run(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PORT: "0" },
    timeout: 15_000,
  });
}

async function until(
  check: () => Promise<boolean>,
  message: string,
  output?: () => string,
): Promise<void> {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`${message}${output ? `\nCLI output:\n${output()}` : ""}`);
}

function launch(root: string, ...args: string[]) {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  return { child, output: () => output };
}

async function serves(url: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    const body = await response.text();
    return response.status === 200 && body.includes(text);
  } catch {
    // A successful rebuild briefly closes and reopens the preview server.
    return false;
  }
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((done) => child.once("exit", done));
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
      await closed;
      clearTimeout(timer);
    }
  }
  await Promise.all(
    fixtures
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("CLI shows help/version and refuses invalid or misplaced arguments", async () => {
  const root = await fixture();
  expect(run(root, "--help").stdout).toContain("Usage: mdd");
  expect(run(root, "--version").stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  for (const args of [
    ["unknown"],
    ["build", "extra"],
    ["build", "--unknown"],
    ["check", "--out", "build"],
    ["serve", "--base-path", "/docs/"],
    ["build", "--project="],
    ["serve", "--port=Infinity"],
    ["serve", "--port=65536"],
    ["serve", "--port=-1"],
    ["serve", "--port=1.5"],
  ]) {
    const result = run(root, ...args);
    expect(result.status, args.join(" ")).toBe(1);
    expect(result.stderr).toContain("mdd:");
  }
});

test("check reports authoring errors without emitting output; build respects paths", async () => {
  const root = await fixture();
  expect(run(root, "check").status).toBe(0);
  await expect(
    readFile(join(root, "mdd-dist", "index.html")),
  ).rejects.toThrow();
  await writeFile(
    join(root, "mdd", "contents", "index.md"),
    "# Home\n\n[Broken](absent.md)\n",
  );
  const invalid = run(root, "check");
  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toMatch(/mdd\/contents\/index\.md.*error/);
  await writeFile(
    join(root, "mdd", "contents", "index.md"),
    "# Home\n\nWelcome.\n",
  );
  const result = run(
    root,
    "build",
    "--project",
    root,
    "--dir",
    "mdd",
    "--out",
    "website",
    "--base-path",
    "/docs/",
  );
  expect(result.status, result.stderr).toBe(0);
  const manifest = JSON.parse(
    await readFile(join(root, "website", "mdd-build.json"), "utf8"),
  );
  expect(manifest.basePath).toBe("/docs/");
  expect(await readFile(join(root, "website", "index.html"), "utf8")).toContain(
    "/docs/",
  );
});

test("serve reads a built snapshot, uses PORT, and shuts down cleanly", async () => {
  const root = await fixture();
  expect(run(root, "build").status).toBe(0);
  await rm(join(root, "mdd"), { recursive: true });
  const process = launch(root, "serve", "--host", "127.0.0.1");
  await until(
    async () => {
      if (process.child.exitCode !== null) throw new Error(process.output());
      return /http:\/\/127\.0\.0\.1:\d+\//.test(process.output());
    },
    "Server did not start.",
    process.output,
  );
  const url = process.output().match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
  expect(url).toBeDefined();
  const home = await fetch(url ?? "");
  expect(home.status).toBe(200);
  expect(await home.text()).toContain("My documentation");
  expect((await fetch(`${url}missing/`)).status).toBe(404);
  const exited = new Promise<number | null>((done) =>
    process.child.once("exit", done),
  );
  process.child.kill("SIGTERM");
  expect(await exited).toBe(0);
}, 15_000);

test("dev watches configured content/theme roots and keeps the last build through errors", async () => {
  const root = await fixture();
  await mkdir(join(root, "guide"));
  await mkdir(join(root, "styles", "custom"), { recursive: true });
  await writeFile(join(root, "guide", "index.md"), "# Original preview\n");
  await writeFile(
    join(root, "styles", "custom", "theme.css"),
    "body { color: blue; }\n",
  );
  const config = {
    paths: { contents: "../guide", themes: "../styles" },
    theme: "custom",
  };
  const configPath = join(root, "mdd", "config.json");
  await writeFile(configPath, JSON.stringify(config));
  const process = launch(root, "dev");
  await until(
    async () => {
      if (process.child.exitCode !== null) throw new Error(process.output());
      return process.output().includes("Preview on");
    },
    "Preview did not start.",
    process.output,
  );
  const origin = process.output().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  expect(origin).toBeDefined();
  const page = join(root, "mdd-dist", "index.html");
  await writeFile(join(root, "guide", "index.md"), "# Updated preview\n");
  await until(
    () => serves(`${origin}/`, "Updated preview"),
    "Content change did not rebuild.",
    process.output,
  );
  expect((await fetch(`${origin}/healthz`)).status).toBe(200);
  await writeFile(
    join(root, "styles", "custom", "theme.css"),
    "body { color: green; }\n",
  );
  await until(
    () => serves(`${origin}/_mdd/theme/theme.css`, "green"),
    "Theme change did not rebuild.",
    process.output,
  );
  await writeFile(
    join(root, "guide", "index.md"),
    "# Broken\n\n[Missing](missing.md)\n",
  );
  await until(
    async () => process.output().includes("error"),
    "Invalid content was not reported.",
    process.output,
  );
  expect(await readFile(page, "utf8")).toContain("Updated preview");
  expect(await serves(`${origin}/`, "Updated preview")).toBe(true);
  expect((await fetch(`${origin}/healthz`)).status).toBe(200);
  await writeFile(
    configPath,
    JSON.stringify({
      ...config,
      paths: { ...config.paths, contents: "../replacement" },
    }),
  );
  await new Promise((done) => setTimeout(done, 200));
  await mkdir(join(root, "replacement"));
  await writeFile(
    join(root, "replacement", "index.md"),
    "# Recovered preview\n",
  );
  await until(
    () => serves(`${origin}/`, "Recovered preview"),
    "New configured content root did not recover.",
    process.output,
  );
  await writeFile(join(root, "replacement", "next.md"), "# Next article\n");
  await until(
    () => serves(`${origin}/next/`, "Next article"),
    "New pages in the replacement content root were not served.",
    process.output,
  );
  expect(await serves(`${origin}/`, "Recovered preview")).toBe(true);
  expect((await fetch(`${origin}/healthz`)).status).toBe(200);
}, 30_000);

test("dev rebuilds when a symlinked configuration target changes", async () => {
  const root = await fixture();
  await mkdir(join(root, "settings"));
  const target = join(root, "settings", "config.json");
  await writeFile(target, JSON.stringify({ title: "Original site title" }));
  await symlink("../settings/config.json", join(root, "mdd", "config.json"));
  const process = launch(root, "dev");
  await until(
    async () => {
      if (process.child.exitCode !== null) throw new Error(process.output());
      return process.output().includes("Preview on");
    },
    "Preview did not start for the symlinked configuration.",
    process.output,
  );
  const origin = process.output().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
  expect(origin).toBeDefined();
  expect(await serves(`${origin}/`, "Original site title")).toBe(true);
  await writeFile(target, JSON.stringify({ title: "Updated site title" }));
  await until(
    () => serves(`${origin}/`, "Updated site title"),
    "Editing the configuration symlink target did not update the served site.",
    process.output,
  );
  expect((await fetch(`${origin}/healthz`)).status).toBe(200);
}, 15_000);
