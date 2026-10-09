import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const temporary = await mkdtemp(join(tmpdir(), "mdd-package-"));
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    result.stderr || String(result.error) || result.stdout,
  );
  return result.stdout;
}
try {
  const archive = JSON.parse(
    run(
      "npm",
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        temporary,
        "--cache",
        join(temporary, "cache"),
      ],
      root,
    ),
  )[0];
  const files = new Set(archive.files.map((file) => file.path));
  for (const required of [
    "dist/cli.js",
    "dist/index.d.ts",
    "assets/reader.js",
    "assets/search-ui.js",
    "themes/d/theme.css",
    "themes/d/theme.json",
    "themes/d/CHANGELOG.md",
    "LICENSE",
  ])
    assert.ok(files.has(required), `Missing packed file: ${required}`);
  assert.ok(
    ![...files].some((file) =>
      /^(src|tests|examples|\.impeccable|themes\/archive)\//.test(file),
    ),
    "Development files must not ship.",
  );
  assert.ok(
    !files.has("assets/reader.css"),
    "Only D Theme owns the reader stylesheet.",
  );
  const consumer = join(temporary, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    '{"private":true,"type":"module"}\n',
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--registry=https://registry.npmjs.org",
      "--cache",
      join(temporary, "cache"),
      join(temporary, archive.filename),
    ],
    consumer,
  );
  const installed = join(consumer, "node_modules", "@wgtechlabs", "mdd");
  const metadata = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  assert.equal(
    resolve(installed, metadata.bin.mdd),
    join(installed, "dist", "cli.js"),
  );
  const binaries = process.env.MDD_TEST_NODE_BINARIES?.split(delimiter).filter(
    Boolean,
  ) ?? [process.execPath];
  for (const binary of binaries) {
    process.stdout.write(
      run(binary, [join(root, "scripts", "smoke.mjs"), installed], consumer),
    );
  }
  console.log(
    `Verified one packed archive (${archive.files.length} files) with ${binaries.length} Node runtime(s).`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
