import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { lexicalFolder, resolveContentFolder } from "../src/project-folder.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mdd-folder-"));
  roots.push(root);
  return root;
}

async function mddFolder(root: string, folder: string): Promise<void> {
  await mkdir(path.join(root, folder, "contents"), { recursive: true });
  await writeFile(path.join(root, folder, "contents/index.md"), "# Hi\n");
}

describe("default folders", () => {
  test("uses mdd/ when it is an MDD folder", async () => {
    const root = await tempDir();
    await mddFolder(root, "mdd");
    await mddFolder(root, "docs");
    expect(await resolveContentFolder(root, undefined, "MDD_DOCS_DIR")).toBe(
      "mdd",
    );
  });

  test("falls back to docs/ only when mdd/ is not an MDD folder", async () => {
    const root = await tempDir();
    await mkdir(path.join(root, "mdd"));
    await mddFolder(root, "docs");
    expect(await resolveContentFolder(root, "", "MDD_DOCS_DIR")).toBe("docs");
  });

  test("rejects a docs/ folder of plain Markdown", async () => {
    const root = await tempDir();
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs/SPEC.md"), "# Spec\n");
    await writeFile(path.join(root, "docs/config.json"), "{}");
    const error = await resolveContentFolder(
      root,
      undefined,
      "MDD_SOURCE_DIR",
    ).catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("Checked mdd/ and docs/");
    expect(message).toContain("mdd/ does not exist");
    expect(message).toContain("docs/contents/index.md is missing");
    expect(message).toContain("contents/index.md");
    expect(message).toContain("set MDD_SOURCE_DIR");
  });

  test("honors paths.contents from config.json", async () => {
    const root = await tempDir();
    await mkdir(path.join(root, "mdd/pages"), { recursive: true });
    await writeFile(
      path.join(root, "mdd/config.json"),
      JSON.stringify({ paths: { contents: "./pages" } }),
    );
    await writeFile(path.join(root, "mdd/pages/index.md"), "# Hi\n");
    expect(await resolveContentFolder(root, undefined, "MDD_DOCS_DIR")).toBe(
      "mdd",
    );
  });

  test("does not follow a symlinked default folder", async () => {
    const root = await tempDir();
    const outside = await tempDir();
    await mddFolder(outside, "mdd");
    await symlink(path.join(outside, "mdd"), path.join(root, "mdd"));
    await expect(
      resolveContentFolder(root, undefined, "MDD_DOCS_DIR"),
    ).rejects.toThrow(/mdd\/ is not a real directory/);
  });
});

describe("explicit folder", () => {
  test("wins over the defaults", async () => {
    const root = await tempDir();
    await mddFolder(root, "mdd");
    await mddFolder(root, "examples/basic/mdd");
    expect(
      await resolveContentFolder(root, "examples/basic/mdd", "MDD_SOURCE_DIR"),
    ).toBe("examples/basic/mdd");
  });

  test("does not fall back when the explicit folder is invalid", async () => {
    const root = await tempDir();
    await mddFolder(root, "mdd");
    await mkdir(path.join(root, "site"));
    await expect(
      resolveContentFolder(root, "site", "MDD_SOURCE_DIR"),
    ).rejects.toThrow(
      /MDD_SOURCE_DIR=site is not an MDD folder: site\/contents\/index\.md is missing/,
    );
    await expect(
      resolveContentFolder(root, "missing", "MDD_DOCS_DIR"),
    ).rejects.toThrow(/MDD_DOCS_DIR=missing.*missing\/ does not exist/);
  });

  test("rejects paths that can leave the project", () => {
    for (const folder of [
      "../mdd",
      "/etc",
      "mdd/../../etc",
      "mdd/./secret",
      "mdd\\..\\secret",
      "",
      " mdd",
      "mdd ",
    ]) {
      expect(() => lexicalFolder(folder, "MDD_SOURCE_DIR")).toThrow(
        /MDD_SOURCE_DIR must be a relative folder inside the project/,
      );
    }
    expect(lexicalFolder("examples\\basic", "MDD_SOURCE_DIR")).toBe(
      "examples/basic",
    );
  });

  test("rejects paths.contents that leaves the project", async () => {
    const root = await tempDir();
    await mkdir(path.join(root, "mdd"));
    await writeFile(
      path.join(root, "mdd/config.json"),
      JSON.stringify({ paths: { contents: "../../elsewhere" } }),
    );
    await expect(
      resolveContentFolder(root, "mdd", "MDD_SOURCE_DIR"),
    ).rejects.toThrow(/outside the project/);
  });
});
