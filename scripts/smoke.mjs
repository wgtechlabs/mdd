import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Pass the installed package directory to verify its actual packed contents.
const packageDirectory = await realpath(resolve(process.argv[2] ?? "."));
const cli = join(packageDirectory, "dist", "cli.js");
const project = await mkdtemp(join(tmpdir(), "mdd-node-smoke-"));
const editBaseUrl = "https://github.com/example/docs/edit/feature%2Fdocs/";
let server;
const themeMetadataFile = join(packageDirectory, "themes", "d", "theme.json");
const themeStylesheet = join(packageDirectory, "themes", "d", "theme.css");
let originalThemeMetadata;
let originalThemeStylesheet;

async function startServer(...args) {
  server = spawn(process.execPath, [cli, ...args], {
    cwd: project,
    env: { ...process.env, PORT: "0", MDD_EDIT_BASE_URL: undefined },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((done, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`Server start timed out: ${output}`)),
      10_000,
    );
    const collect = (chunk) => {
      output += chunk;
      const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (address) {
        clearTimeout(timer);
        done(address);
      }
    };
    server.stdout.on("data", collect);
    server.stderr.on("data", collect);
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${output}`));
    });
  });
}

async function stopServer() {
  if (server && server.exitCode === null && server.signalCode === null) {
    const stopped = new Promise((done) => server.once("exit", done));
    server.kill("SIGTERM");
    const timer = setTimeout(() => server.kill("SIGKILL"), 3000);
    await stopped;
    clearTimeout(timer);
  }
}

async function waitForPage(url, text) {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200 && (await response.text()).includes(text))
        return;
    } catch {
      /* A preview rebuild briefly restarts the listener. */
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`Preview did not serve the expected content at ${url}`);
}

try {
  assert.equal(
    globalThis.Bun,
    undefined,
    "Run the packaged smoke test with Node.js.",
  );
  assert.ok(
    packageDirectory.endsWith(join("node_modules", "@wgtechlabs", "mdd")),
    "Pass an isolated installed package; the smoke test must not edit a source checkout.",
  );
  originalThemeMetadata = await readFile(themeMetadataFile);
  originalThemeStylesheet = await readFile(themeStylesheet);
  const theme = JSON.parse(originalThemeMetadata.toString("utf8"));
  assert.equal(theme.name, "D Theme");
  assert.match(theme.release, /^D\d+$/);
  assert.match(theme.version, /^\d+\.\d+\.\d+$/);
  const themeLabel = `D Theme — ${theme.release} · v${theme.version}`;
  await mkdir(join(project, "mdd", "contents"), { recursive: true });
  await writeFile(
    join(project, "mdd", "contents", "index.md"),
    "# Node runtime\n\n[Installation](installation.md)\n",
  );
  await writeFile(
    join(project, "mdd", "contents", "installation.md"),
    "# Installation\n\n## Start here\n\n```sh\nnpm install @wgtechlabs/mdd\n```\n\n> [!CAUTION]\n> Review trusted theme scripts.\n",
  );
  await writeFile(
    join(project, "mdd", "footer.md"),
    ":::socials\n- [GitHub](https://github.com/wgtechlabs/mdd)\n:::\n",
  );
  function run(...args) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: project,
      encoding: "utf8",
      env: { ...process.env, MDD_EDIT_BASE_URL: undefined },
      timeout: 15_000,
    });
    assert.equal(
      result.status,
      0,
      `${args.join(" ")}: ${result.stderr || result.error || result.stdout}`,
    );
    return result.stdout;
  }
  const metadata = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8"),
  );
  assert.equal(run("--version").trim(), metadata.version);
  run("check", "--theme", "d", "--edit-base-url", editBaseUrl);
  for (const [index, prefix] of [
    "/",
    "/docs/",
    "/repository/docs/",
  ].entries()) {
    const out = `output-${index}`;
    run(
      "build",
      "--out",
      out,
      "--base-path",
      prefix,
      "--theme",
      "d",
      "--edit-base-url",
      editBaseUrl,
    );
    const manifest = JSON.parse(
      await readFile(join(project, out, "mdd-build.json"), "utf8"),
    );
    assert.equal(manifest.basePath, prefix);
    assert.equal(manifest.mddVersion, metadata.version);
    assert.equal(manifest.engineVersion, "1.0.1");
    const searchIndex = JSON.parse(
      await readFile(join(project, out, "_mdd", "search-index.json"), "utf8"),
    );
    // Static output has no package.json. Load the exact browser module bytes
    // explicitly as ESM, including on Node versions before syntax detection.
    const searchModule = await readFile(
      join(project, out, "_mdd", "search.js"),
    );
    const { search, validateSearchIndex } = await import(
      `data:text/javascript;base64,${searchModule.toString("base64")}`
    );
    validateSearchIndex(searchIndex);
    assert.equal(
      search(searchIndex, "Start here")[0]?.url,
      `${prefix}installation/#mdd-start-here`,
    );
    assert.equal(search(searchIndex, "GitHub").length, 0);
    const html = await readFile(
      join(project, out, "installation", "index.html"),
      "utf8",
    );
    assert.ok(html.includes(`${prefix}_mdd/reader.css`));
    assert.ok(html.includes("Start here"));
    assert.ok(html.includes('class="mdd-alert mdd-caution"'));
    assert.ok(html.includes('aria-label="Social links"'));
    assert.ok(html.includes(`${prefix}_mdd/search-ui.js`));
    assert.ok(html.includes(`MDD v${metadata.version}`));
    assert.ok(html.includes(themeLabel));
    assert.ok(html.includes("Edit this markdown</a>"));
    assert.ok(
      html.includes(`href="${editBaseUrl}mdd/contents/installation.md"`),
    );
    const notFound = await readFile(join(project, out, "404.html"), "utf8");
    assert.ok(notFound.includes(themeLabel));
    assert.ok(!notFound.includes("Edit this markdown"));
    assert.ok(
      (
        await readFile(
          join(project, out, "markdown", "installation", "index.md"),
          "utf8",
        )
      ).includes("# Installation"),
    );
    assert.ok(
      (await readFile(join(project, out, "llms.txt"), "utf8")).includes(
        `${prefix}markdown/installation/index.md`,
      ),
    );
  }
  // The runtime must not depend on the content checkout or Bun after exporting.
  await rm(join(project, "mdd"), { recursive: true });
  const origin = await startServer(
    "serve",
    "--out",
    "output-2",
    "--host",
    "127.0.0.1",
  );
  for (const [path, status, text] of [
    ["/healthz", 200, "ok"],
    ["/repository/docs/", 200, "Node runtime"],
    ["/repository/docs/installation/", 200, "Start here"],
    ["/repository/docs/_mdd/reader.css", 200, ":root"],
    ["/repository/docs/_mdd/reader.js", 200, ""],
    ["/repository/docs/_mdd/search-ui.js", 200, "validateSearchIndex"],
    ["/repository/docs/_mdd/search.js", 200, "validateSearchIndex"],
    ["/repository/docs/_mdd/search-index.json", 200, "Start here"],
    ["/repository/docs/llms.txt", 200, "## Documentation"],
    ["/repository/docs/markdown/installation/index.md", 200, "# Installation"],
    ["/repository/docs/missing/", 404, ""],
    ["/repository/docs/.mdd-output.json", 404, ""],
    ["/", 404, ""],
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, status, path);
    assert.ok((await response.text()).includes(text), path);
  }
  const llmsResponse = await fetch(`${origin}/repository/docs/llms.txt`);
  assert.match(llmsResponse.headers.get("content-type") ?? "", /^text\/plain/);
  const llms = await llmsResponse.text();
  const markdownLinks = [...llms.matchAll(/\]\(<([^>]+)>\)/g)].map(
    (match) => match[1],
  );
  assert.equal(markdownLinks.length, 2);
  for (const link of markdownLinks) {
    assert.ok(link.startsWith("/repository/docs/markdown/"));
    const response = await fetch(new URL(link, origin));
    assert.equal(response.status, 200, link);
    assert.match(await response.text(), /^# /);
  }
  await stopServer();

  // Native Node file watching must update the immutable server inventory, too.
  await mkdir(join(project, "mdd", "contents"), { recursive: true });
  await mkdir(join(project, "settings"));
  const configTarget = join(project, "settings", "config.json");
  await writeFile(configTarget, JSON.stringify({ title: "Preview original" }));
  await symlink("../settings/config.json", join(project, "mdd", "config.json"));
  await writeFile(
    join(project, "mdd", "contents", "index.md"),
    "# Preview home\n",
  );
  const preview = await startServer(
    "dev",
    "--base-path",
    "/docs/",
    "--theme",
    "d",
    "--edit-base-url",
    editBaseUrl,
  );
  await waitForPage(`${preview}/docs/`, "Preview original");
  await waitForPage(
    `${preview}/docs/`,
    `href="${editBaseUrl}mdd/contents/index.md"`,
  );
  await writeFile(configTarget, JSON.stringify({ title: "Preview updated" }));
  await waitForPage(`${preview}/docs/`, "Preview updated");
  await writeFile(
    join(project, "mdd", "contents", "added.md"),
    "# Newly added page\n",
  );
  await waitForPage(`${preview}/docs/added/`, "Newly added page");
  await waitForPage(
    `${preview}/docs/added/`,
    `href="${editBaseUrl}mdd/contents/added.md"`,
  );
  await waitForPage(`${preview}/docs/`, "Preview updated");
  await waitForPage(`${preview}/healthz`, "ok");

  // Edit only this isolated installed copy: a theme release is independent of MDD.
  await writeFile(
    themeMetadataFile,
    JSON.stringify({ ...theme, release: "D99", version: "99.0.0-smoke" }),
  );
  await waitForPage(`${preview}/docs/`, "D Theme — D99 · v99.0.0-smoke");
  await waitForPage(`${preview}/docs/`, `MDD v${metadata.version}`);
  assert.equal(
    JSON.parse(
      await readFile(join(project, "mdd-dist", "mdd-build.json"), "utf8"),
    ).mddVersion,
    metadata.version,
  );
  await writeFile(
    themeStylesheet,
    `${originalThemeStylesheet.toString("utf8")}\n.mdd-smoke-probe { --theme-watched: true; }\n`,
  );
  await waitForPage(`${preview}/docs/_mdd/reader.css`, "--theme-watched: true");
  await waitForPage(`${preview}/healthz`, "ok");
  console.log(
    `Packaged CLI/server smoke passed under Node ${process.versions.node}.`,
  );
} finally {
  await stopServer();
  if (originalThemeMetadata)
    await writeFile(themeMetadataFile, originalThemeMetadata);
  if (originalThemeStylesheet)
    await writeFile(themeStylesheet, originalThemeStylesheet);
  await rm(project, { recursive: true, force: true });
}
