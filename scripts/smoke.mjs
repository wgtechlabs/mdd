import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const packageDirectory = await realpath(resolve(process.argv[2] ?? "."));
const project = await mkdtemp(join(tmpdir(), "mdd-node-smoke-"));
const editBaseUrl = "https://github.com/example/docs/edit/feature%2Fdocs/";
const serverEntry = join(packageDirectory, "dist", "container-server.js");
const themeMetadataFile = join(packageDirectory, "themes", "d", "theme.json");
let server;
let output = "";

async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    const stopped = new Promise((done) => server.once("exit", done));
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 3000);
    await stopped;
    clearTimeout(timer);
  }
}

async function waitForServer(url) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Server exited ${server.exitCode}: ${output}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return response;
    } catch {
      await new Promise((done) => setTimeout(done, 50));
    }
  }
  throw new Error(`Server did not become ready at ${url}: ${output}`);
}

try {
  assert.equal(globalThis.Bun, undefined, "Run this smoke check with Node.js.");
  assert.ok(
    packageDirectory.endsWith(join("node_modules", "@wgtechlabs", "mdd")),
    "Pass an isolated installed package; the smoke check must not edit a source checkout.",
  );

  const metadata = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8"),
  );
  assert.equal(
    metadata.bin,
    undefined,
    "The application must not expose a CLI binary.",
  );
  const theme = JSON.parse(await readFile(themeMetadataFile, "utf8"));
  assert.equal(theme.name, "D Theme");
  assert.match(theme.release, /^D\d+$/);
  assert.match(theme.version, /^\d+\.\d+\.\d+$/);

  await mkdir(join(project, "mdd", "contents"), { recursive: true });
  await writeFile(
    join(project, "mdd", "contents", "index.md"),
    "# Node runtime\n\n[Installation](installation.md)\n",
  );
  await writeFile(
    join(project, "mdd", "contents", "installation.md"),
    "# Installation\n\n## Start here\n\n```sh\nnpm install @wgtechlabs/mdd\n```\n",
  );
  await writeFile(
    join(project, "mdd", "footer.md"),
    ":::socials\n- [GitHub](https://github.com/wgtechlabs/mdd)\n:::\n",
  );

  const { build } = await import(
    pathToFileURL(join(packageDirectory, "dist", "index.js")).href
  );
  for (const [index, basePath] of [
    "/",
    "/docs/",
    "/repository/docs/",
  ].entries()) {
    const result = await build({
      projectDir: project,
      outDir: `output-${index}`,
      basePath,
      editBaseUrl,
    });
    assert.ok(
      result.site,
      result.diagnostics.map((item) => item.message).join("\n"),
    );
    const output = result.directory;
    const manifest = JSON.parse(
      await readFile(join(output, "mdd-build.json"), "utf8"),
    );
    assert.equal(manifest.basePath, basePath);
    assert.equal(manifest.mddVersion, metadata.version);
    assert.equal(manifest.engineVersion, "1.1.0");
    const html = await readFile(join(output, "index.html"), "utf8");
    assert.match(html, /Node runtime/);
    assert.ok(html.includes(`${basePath}installation/`));
    assert.match(
      html,
      /https:\/\/github\.com\/example\/docs\/edit\/feature%2Fdocs\//,
    );
    assert.ok(
      await readFile(join(output, "_mdd", "search-index.json"), "utf8"),
    );
    assert.ok((await readFile(join(output, "_mdd", "reader.css"))).length > 0);
  }

  const portProbe = await import("node:net");
  const probe = portProbe.createServer();
  await new Promise((done) => probe.listen(0, "127.0.0.1", done));
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((done, reject) =>
    probe.close((error) => (error ? reject(error) : done())),
  );

  server = spawn(process.execPath, [serverEntry], {
    cwd: project,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      MDD_PROJECT_DIR: project,
      MDD_OUTPUT_DIR: join(project, "server-output"),
      MDD_BASE_PATH: "/docs/",
      MDD_EDIT_BASE_URL: editBaseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => (output += chunk));
  server.stderr.on("data", (chunk) => (output += chunk));
  const baseUrl = `http://127.0.0.1:${port}`;
  const page = await waitForServer(`${baseUrl}/docs/`);
  assert.match(await page.text(), /Node runtime/);
  assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
  assert.match(
    output,
    new RegExp(`Serving on http://127\\.0\\.0\\.1:${port}/`),
  );

  console.log(
    `Renderer and server smoke passed under Node ${process.versions.node}.`,
  );
} finally {
  await stopServer();
  await rm(project, { recursive: true, force: true });
}
