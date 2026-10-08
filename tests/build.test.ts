import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
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
import path from "node:path";
import { promisify } from "node:util";
import { build } from "../src/build.js";

const roots: string[] = [];
const run = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture(config: object = {}): Promise<string> {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "mdd-export-test-")),
  );
  roots.push(root);
  await mkdir(path.join(root, "mdd/contents/get-started"), { recursive: true });
  await mkdir(path.join(root, "mdd/contents/images"));
  await writeFile(path.join(root, "mdd/config.json"), JSON.stringify(config));
  await writeFile(
    path.join(root, "mdd/contents/index.md"),
    "# Welcome\n\n[Installation](get-started/installation.md)\n\n![Logo](images/logo.png)\n",
  );
  await writeFile(
    path.join(root, "mdd/contents/get-started/installation.md"),
    "# Installation\n\n## Set up\n\nRun `mdd build`.\n",
  );
  await writeFile(
    path.join(root, "mdd/contents/images/logo.png"),
    Buffer.from([137, 80, 78, 71]),
  );
  return root;
}

describe("static export", () => {
  for (const basePath of ["/", "/docs/", "/repository/docs/", "/caf%C3%A9/"]) {
    test(`exports complete static output under ${basePath}`, async () => {
      const root = await fixture({ title: "Example documentation" });
      const result = await build({ projectDir: root, basePath });
      expect(result.diagnostics).toEqual([]);
      expect(result.directory).toBe(path.join(root, "mdd-dist"));
      const out = result.directory as string;
      const html = await readFile(path.join(out, "index.html"), "utf8");
      expect(html).toContain(`${basePath}get-started/installation/`);
      expect(html).toContain(`${basePath}_assets/images/logo.png`);
      expect(
        await readFile(
          path.join(out, "get-started/installation/index.html"),
          "utf8",
        ),
      ).toContain("Installation");
      expect(
        await readFile(
          path.join(out, "markdown/get-started/installation/index.md"),
          "utf8",
        ),
      ).toContain("# Installation");
      expect(await readFile(path.join(out, "llms.txt"), "utf8")).toContain(
        `${basePath}markdown/get-started/installation/index.md`,
      );
      expect(await readFile(path.join(out, "_assets/images/logo.png"))).toEqual(
        Buffer.from([137, 80, 78, 71]),
      );
      expect(
        (await readFile(path.join(out, "_mdd/reader.css"))).length,
      ).toBeGreaterThan(0);
      expect(
        (await readFile(path.join(out, "_mdd/reader.js"))).length,
      ).toBeGreaterThan(0);
      expect(
        (await readFile(path.join(out, "404.html"), "utf8")).length,
      ).toBeGreaterThan(0);
      const manifest = JSON.parse(
        await readFile(path.join(out, "mdd-build.json"), "utf8"),
      );
      expect(manifest).toMatchObject({
        schemaVersion: 1,
        engineVersion: "0.1.1",
        basePath,
        source: { commit: null, dirty: null },
      });
      expect(JSON.stringify(manifest)).not.toContain(root);
      if (basePath !== "/")
        expect(
          await readFile(path.join(out, "docs/index.html")).catch(() => null),
        ).toBeNull();
    });
  }

  test("copies only selected theme assets without executing scripts", async () => {
    const root = await fixture({ theme: "custom" });
    await mkdir(path.join(root, "mdd/themes/custom/fonts"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "mdd/themes/custom/theme.css"),
      '@font-face { src: url("fonts/body.woff2"); }',
    );
    await writeFile(
      path.join(root, "mdd/themes/custom/theme.js"),
      'throw new Error("theme JavaScript must run only in a browser");',
    );
    await writeFile(
      path.join(root, "mdd/themes/custom/fonts/body.woff2"),
      "font-data",
    );
    await writeFile(
      path.join(root, "mdd/themes/custom/README.md"),
      "This is source documentation, not a browser asset.",
    );
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { preinstall: "exit 1", build: "exit 1" } }),
    );
    const result = await build({ projectDir: root, basePath: "/docs/" });
    expect(result.site).toBeDefined();
    const out = result.directory as string;
    expect(
      await readFile(path.join(out, "_mdd/theme/fonts/body.woff2"), "utf8"),
    ).toBe("font-data");
    expect(
      await readFile(path.join(out, "_mdd/theme/theme.js"), "utf8"),
    ).toContain("throw new Error");
    expect(
      await readFile(path.join(out, "_mdd/theme/README.md")).catch(() => null),
    ).toBeNull();
    expect(
      await readFile(path.join(out, "package.json")).catch(() => null),
    ).toBeNull();
  });

  test("preserves last output on author errors and removes stale files on successful rebuild", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "mdd/contents/old.md"), "# Old page\n");
    const first = await build({ projectDir: root });
    const out = first.directory as string;
    const original = await readFile(path.join(out, "index.html"));
    await writeFile(
      path.join(root, "mdd/contents/index.md"),
      "# Invalid\n\n[Missing](missing.md)\n",
    );
    const failed = await build({ projectDir: root });
    expect(failed.site).toBeUndefined();
    expect(
      failed.diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    ).toBe(true);
    expect(await readFile(path.join(out, "index.html"))).toEqual(original);
    await writeFile(path.join(root, "mdd/contents/index.md"), "# Updated\n");
    await rm(path.join(root, "mdd/contents/old.md"));
    const rebuilt = await build({ projectDir: root });
    expect(rebuilt.site).toBeDefined();
    expect(await readFile(path.join(out, "index.html"), "utf8")).toContain(
      "Updated",
    );
    expect(
      await readFile(path.join(out, "old/index.html")).catch(() => null),
    ).toBeNull();
  });

  test("preserves unknown output files, edited output, and unrelated directories", async () => {
    const root = await fixture();
    await mkdir(path.join(root, "unrelated"));
    await writeFile(path.join(root, "unrelated/important.txt"), "keep");
    await expect(
      build({ projectDir: root, outDir: "unrelated" }),
    ).rejects.toThrow("unrelated");
    expect(
      await readFile(path.join(root, "unrelated/important.txt"), "utf8"),
    ).toBe("keep");
    const first = await build({ projectDir: root });
    const out = first.directory as string;
    await writeFile(path.join(out, "important.txt"), "keep");
    await expect(build({ projectDir: root })).rejects.toThrow("unrecognized");
    expect(await readFile(path.join(out, "important.txt"), "utf8")).toBe(
      "keep",
    );
    await rm(path.join(out, "important.txt"));
    await writeFile(path.join(out, "index.html"), "manual edit");
    await expect(build({ projectDir: root })).rejects.toThrow("edited");
    expect(await readFile(path.join(out, "index.html"), "utf8")).toBe(
      "manual edit",
    );
  });

  test("refuses project, content, theme, hidden, and symlink output destinations", async () => {
    const root = await fixture({ paths: { themes: "../shared-themes" } });
    for (const outDir of [
      ".",
      "..",
      "mdd",
      "mdd/contents/nested",
      "shared-themes",
      ".git/build",
      "node_modules/docs",
    ]) {
      await expect(build({ projectDir: root, outDir })).rejects.toThrow();
    }
    await mkdir(path.join(root, "output"));
    await symlink(path.join(root, "output"), path.join(root, "alias"));
    await expect(build({ projectDir: root, outDir: "alias" })).rejects.toThrow(
      "symlink",
    );
    expect(
      await readFile(path.join(root, "mdd/contents/index.md"), "utf8"),
    ).toContain("Welcome");
  });

  test("protects a custom contents root outside the mdd folder", async () => {
    const root = await fixture({ paths: { contents: "../articles" } });
    await mkdir(path.join(root, "articles"));
    await writeFile(
      path.join(root, "articles/index.md"),
      "# External content root\n",
    );
    await expect(
      build({ projectDir: root, outDir: "articles/generated" }),
    ).rejects.toThrow("documentation inputs");
  });

  test("refuses theme symlinks and sensitive theme files before replacing output", async () => {
    const root = await fixture({ theme: "custom" });
    const theme = path.join(root, "mdd/themes/custom");
    await mkdir(theme, { recursive: true });
    await writeFile(path.join(theme, "theme.css"), "body { color: black; }");
    const first = await build({ projectDir: root });
    const original = await readFile(
      path.join(first.directory as string, "index.html"),
    );
    await writeFile(path.join(theme, "secret.json"), '{"token":"do-not-copy"}');
    await expect(build({ projectDir: root })).rejects.toThrow("sensitive");
    await rm(path.join(theme, "secret.json"));
    await symlink(
      path.join(root, "mdd/config.json"),
      path.join(theme, "alias.json"),
    );
    await expect(build({ projectDir: root })).rejects.toThrow("symlink");
    expect(
      await readFile(path.join(first.directory as string, "index.html")),
    ).toEqual(original);
  });

  test("rejects portable filename collisions and decodes route segments once", async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, "mdd/contents/100%25.md"),
      "# Literal percent\n",
    );
    const exported = await build({ projectDir: root });
    expect(exported.site).toBeDefined();
    expect(
      await readFile(
        path.join(exported.directory as string, "100%25/index.html"),
        "utf8",
      ),
    ).toContain("Literal percent");
    await writeFile(
      path.join(root, "mdd/contents/index.html.md"),
      "# Conflicting output\n",
    );
    await expect(build({ projectDir: root })).rejects.toThrow("collide");
  });

  test("rejects control characters in generated paths before replacing the last valid output", async () => {
    const root = await fixture();
    const result = await build({ projectDir: root });
    const home = path.join(result.directory as string, "index.html");
    const before = await readFile(home, "utf8");
    await expect(
      build({ projectDir: root, basePath: "/%7F/" }),
    ).rejects.toThrow("Unsupported public base path");
    expect(await readFile(home, "utf8")).toBe(before);
    for (const character of ["\n", String.fromCharCode(127)]) {
      const unsafe = path.join(root, `mdd/contents/bad${character}name.md`);
      await writeFile(unsafe, "# Invalid route\n");
      await expect(build({ projectDir: root })).rejects.toThrow(
        "Unsafe generated path",
      );
      expect(await readFile(home, "utf8")).toBe(before);
      await rm(unsafe);
    }
  });

  test("records a commit without executing Git filters or claiming source cleanliness", async () => {
    const root = await fixture();
    await writeFile(path.join(root, ".gitignore"), "mdd-dist/\n");
    await writeFile(
      path.join(root, ".gitattributes"),
      "*.md filter=mdd-probe\n",
    );
    await run("git", ["init", "-q"], { cwd: root });
    await run("git", ["add", "."], { cwd: root });
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
      { cwd: root },
    );
    await writeFile(
      path.join(root, "filter.sh"),
      "#!/bin/sh\nprintf executed > filter-executed\ncat\n",
    );
    await run("git", ["config", "filter.mdd-probe.clean", "sh ./filter.sh"], {
      cwd: root,
    });
    const first = await build({ projectDir: root });
    expect(
      await readFile(path.join(root, "filter-executed")).catch(() => null),
    ).toBeNull();
    const manifestPath = path.join(first.directory as string, "mdd-build.json");
    const clean = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(clean.source.commit).toMatch(/^[a-f0-9]{40,64}$/);
    expect(clean.source.dirty).toBeNull();
    const home = path.join(root, "mdd/contents/index.md");
    const original = await readFile(home, "utf8");
    // Equal size forces Git to inspect content instead of deciding from size alone.
    const changed = original.replace("Welcome", "Changed");
    expect(changed.length).toBe(original.length);
    await writeFile(home, changed);
    await build({ projectDir: root });
    expect(JSON.parse(await readFile(manifestPath, "utf8")).source).toEqual({
      commit: clean.source.commit,
      dirty: null,
    });
    expect(
      await readFile(path.join(root, "filter-executed")).catch(() => null),
    ).toBeNull();
  });
});
