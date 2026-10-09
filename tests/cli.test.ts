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

// Package scripts build first; exercise the same Node entry point users run.
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
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
  return runWithEnv(root, {}, ...args);
}

function runWithEnv(
  root: string,
  environment: NodeJS.ProcessEnv,
  ...args: string[]
) {
  return spawnSync("node", [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PORT: "0",
      MDD_EDIT_BASE_URL: undefined,
      ...environment,
    },
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
  const child = spawn("node", [cli, ...args], {
    cwd: root,
    env: { ...process.env, PORT: "0", MDD_EDIT_BASE_URL: undefined },
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
    ["serve", "--theme", "d"],
    ["serve", "--edit-base-url", "https://github.com/example/docs/edit/main/"],
    ["build", "--edit-base-url="],
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

test("CLI edit destination uses the environment by default and an explicit flag takes precedence", async () => {
  const root = await fixture();
  const environment = {
    MDD_EDIT_BASE_URL: "https://github.com/example/docs/edit/dev",
  };
  const checked = runWithEnv(root, environment, "check");
  expect(checked.status, checked.stderr).toBe(0);
  await expect(readFile(join(root, "mdd-dist/index.html"))).rejects.toThrow();
  const built = runWithEnv(root, environment, "build", "--base-path", "/docs/");
  expect(built.status, built.stderr).toBe(0);
  const home = join(root, "mdd-dist/index.html");
  expect(await readFile(home, "utf8")).toContain(
    'href="https://github.com/example/docs/edit/dev/mdd/contents/index.md"',
  );
  const overridden = runWithEnv(
    root,
    { MDD_EDIT_BASE_URL: "javascript:invalid-environment" },
    "build",
    "--edit-base-url",
    "https://github.com/example/docs/edit/main/",
  );
  expect(overridden.status, overridden.stderr).toBe(0);
  expect(await readFile(home, "utf8")).toContain(
    'href="https://github.com/example/docs/edit/main/mdd/contents/index.md"',
  );
  const unconfigured = run(root, "build");
  expect(unconfigured.status, unconfigured.stderr).toBe(0);
  expect(await readFile(home, "utf8")).not.toContain("Edit this markdown");
});

test("check, build, and dev reject invalid edit destinations without replacing output", async () => {
  const root = await fixture();
  expect(run(root, "build").status).toBe(0);
  const home = join(root, "mdd-dist/index.html");
  const original = await readFile(home, "utf8");
  await writeFile(join(root, "mdd/contents/index.md"), "# New source\n");
  for (const command of ["check", "build", "dev"]) {
    for (const result of [
      run(root, command, "--edit-base-url", "javascript:alert(1)"),
      runWithEnv(
        root,
        { MDD_EDIT_BASE_URL: "http://example.test/edit/main/" },
        command,
      ),
    ]) {
      expect(result.status, result.stderr).toBe(1);
      expect(result.stderr).toContain("mdd:");
      expect(await readFile(home, "utf8")).toBe(original);
    }
  }
});

test("check, build, and dev reject unknown theme names before changing the site", async () => {
  const root = await fixture();
  expect(run(root, "check", "--theme", "d").status).toBe(0);
  await expect(readFile(join(root, "mdd-dist/index.html"))).rejects.toThrow();
  const built = run(root, "build", "--theme", "d");
  expect(built.status, built.stderr).toBe(0);
  const home = join(root, "mdd-dist/index.html");
  const original = await readFile(home, "utf8");
  expect(original).toContain("D Theme — ");
  for (const command of ["check", "build", "dev"]) {
    const result = run(root, command, "--theme", "d26");
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("mdd:");
    expect(await readFile(home, "utf8")).toBe(original);
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

test("check validates optional custom theme metadata without writing a site", async () => {
  const root = await fixture();
  const theme = join(root, "mdd/themes/custom");
  await mkdir(theme, { recursive: true });
  await writeFile(join(root, "mdd/config.json"), '{"theme":"custom"}');
  await writeFile(join(theme, "theme.css"), "body { color: red; }");
  expect(run(root, "check").status).toBe(0);
  await writeFile(
    join(theme, "theme.json"),
    '{"name":"Field","version":"2.0.0-dev.1","release":"Spring"}',
  );
  expect(run(root, "check").status).toBe(0);
  await writeFile(join(theme, "theme.json"), '{"name":"Field"}');
  const invalid = run(root, "check");
  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toContain(
    "Invalid theme metadata in mdd/themes/custom/theme.json",
  );
  await expect(readFile(join(root, "mdd-dist/index.html"))).rejects.toThrow();
});

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
  const process = launch(
    root,
    "dev",
    "--edit-base-url",
    "https://github.com/example/docs/edit/main/",
  );
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
  expect(await readFile(page, "utf8")).toContain(
    'href="https://github.com/example/docs/edit/main/guide/index.md"',
  );
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
  expect(await readFile(page, "utf8")).toContain(
    'href="https://github.com/example/docs/edit/main/replacement/index.md"',
  );
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

test.each(["mdd", "documentation/settings"])(
  "dev watches shared footer creation, edits, and removal in %s",
  async (mddDir) => {
    const root = await fixture();
    const authoring = join(root, mddDir);
    if (mddDir !== "mdd") {
      await mkdir(authoring, { recursive: true });
      await writeFile(
        join(authoring, "config.json"),
        JSON.stringify({ paths: { contents: "../../mdd/contents" } }),
      );
    }
    const process = launch(root, "dev", "--dir", mddDir);
    await until(
      async () => {
        if (process.child.exitCode !== null) throw new Error(process.output());
        return process.output().includes("Preview on");
      },
      "Preview did not start for the shared footer.",
      process.output,
    );
    const origin = process.output().match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    expect(origin).toBeDefined();
    const footer = join(authoring, "footer.md");
    const page = join(root, "mdd-dist/index.html");
    await writeFile(
      footer,
      ":::socials\n- [Created shared footer.](https://example.com/created)\n:::\n",
    );
    await until(
      () => serves(`${origin}/`, "Created shared footer."),
      "Creating a shared footer did not rebuild.",
      process.output,
    );
    await writeFile(
      footer,
      ":::socials\n- [Updated shared footer.](https://example.com/updated)\n:::\n",
    );
    await until(
      () => serves(`${origin}/`, "Updated shared footer."),
      "Editing a shared footer did not rebuild.",
      process.output,
    );
    const lastValid = await readFile(page, "utf8");
    await writeFile(footer, "<script>Invalid footer</script>\n");
    await until(
      async () =>
        process.output().includes("footer.md") &&
        process.output().includes("error"),
      "Invalid footer content was not reported.",
      process.output,
    );
    expect(await readFile(page, "utf8")).toBe(lastValid);
    expect(await serves(`${origin}/`, "Updated shared footer.")).toBe(true);
    await rm(footer);
    await until(
      async () => {
        try {
          const response = await fetch(`${origin}/`, {
            signal: AbortSignal.timeout(1000),
          });
          const body = await response.text();
          return (
            response.status === 200 &&
            body.includes("Hello reader.") &&
            !body.includes("Updated shared footer.")
          );
        } catch {
          return false;
        }
      },
      "Removing an invalid shared footer did not restore the default footer.",
      process.output,
    );
    expect(await readFile(page, "utf8")).not.toContain(
      "Updated shared footer.",
    );
    expect(await serves(`${origin}/healthz`, "ok")).toBe(true);
  },
  20_000,
);
