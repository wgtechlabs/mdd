import { afterEach, describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { build } from "../src/build.js";
import {
  assertRepositoryRef,
  fetchAndCompile,
  fetchContentRepository,
  type GitRunner,
  gitSafetyArgs,
  normalizeCommitSha,
  parseRepositoryUrl,
  runGit,
} from "../src/content-fetch.js";

const run = promisify(execFile);
const roots: string[] = [];
const sha = "a".repeat(40);
const otherSha = "b".repeat(40);

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "mdd-fetch-"));
  roots.push(root);
  return root;
}

describe("repository URL", () => {
  test("accepts a public GitHub HTTPS repository", () => {
    expect(parseRepositoryUrl("https://github.com/wgtechlabs/mdd")).toBe(
      "https://github.com/wgtechlabs/mdd.git",
    );
    expect(parseRepositoryUrl("https://github.com/wgtechlabs/mdd.git")).toBe(
      "https://github.com/wgtechlabs/mdd.git",
    );
    expect(parseRepositoryUrl("https://GitHub.com/wgtechlabs/mdd/")).toBe(
      "https://github.com/wgtechlabs/mdd.git",
    );
  });

  test("rejects credentials, non-HTTPS URLs, and other hosts before Git runs", async () => {
    const rejected = [
      "http://github.com/wgtechlabs/mdd",
      "https://user:token@github.com/wgtechlabs/mdd.git",
      "https://token@github.com/wgtechlabs/mdd.git",
      "git@github.com:wgtechlabs/mdd.git",
      "ssh://git@github.com/wgtechlabs/mdd.git",
      "https://gitlab.com/wgtechlabs/mdd.git",
      "https://github.com.evil/wgtechlabs/mdd",
      "https://evil.com/github.com/wgtechlabs/mdd",
      "https://www.github.com/wgtechlabs/mdd",
      "https://gist.github.com/wgtechlabs/mdd",
      "https://github.com/wgtechlabs/mdd.git?token=secret",
      "https://github.com/wgtechlabs/mdd.git#fragment",
      "https://github.com/wgtechlabs",
      "https://github.com/wgtechlabs/mdd/tree/main",
      "https://github.com:8443/wgtechlabs/mdd",
      "file:///tmp/repo",
      "",
    ];
    let called = false;
    const git: GitRunner = async () => {
      called = true;
      return { stdout: "", stderr: "" };
    };
    for (const url of rejected) {
      expect(() => parseRepositoryUrl(url)).toThrow(
        /public https:\/\/github.com/,
      );
      await expect(
        fetchContentRepository({
          repoUrl: url,
          destination: path.join(await tempDir(), "repo"),
          git,
        }),
      ).rejects.toThrow(/public https:\/\/github.com/);
    }
    expect(called).toBe(false);
  });
});

describe("exact commit", () => {
  test("fails closed when the SHA cannot be fetched and does not check out a branch", async () => {
    const calls: string[][] = [];
    const git: GitRunner = async (args) => {
      calls.push([...args]);
      if (args.includes("fetch")) throw new Error("couldn't find remote ref");
      if (args.includes("checkout")) throw new Error("checkout must not run");
      return { stdout: "", stderr: "" };
    };
    await expect(
      fetchContentRepository({
        repoUrl: "https://github.com/acme/docs",
        repoRef: "main",
        sourceSha: sha,
        destination: path.join(await tempDir(), "repo"),
        git,
      }),
    ).rejects.toThrow(/unavailable.*branch HEAD/s);
    expect(calls.some((args) => args.includes("checkout"))).toBe(false);
    expect(
      calls.some((args) => args.includes("clone") || args.includes("main")),
    ).toBe(false);
    const fetches = calls.filter((args) => args.includes("fetch"));
    expect(fetches.length).toBeGreaterThan(0);
    expect(fetches.every((args) => args.includes(sha))).toBe(true);
    expect(
      fetches.some(
        (args) => args.includes("submodule") || args.includes("status"),
      ),
    ).toBe(false);
  });

  test("rejects a non-SHA before running Git", async () => {
    const calls: string[][] = [];
    const git: GitRunner = async (args) => {
      calls.push([...args]);
      return { stdout: "", stderr: "" };
    };
    await expect(
      fetchContentRepository({
        repoUrl: "https://github.com/acme/docs",
        sourceSha: "main",
        destination: path.join(await tempDir(), "repo"),
        git,
      }),
    ).rejects.toThrow(/full commit SHA/);
    expect(calls).toEqual([]);
    expect(() => normalizeCommitSha(`A${"b".repeat(39)}`)).not.toThrow();
  });

  test("deepens a shallow fetch of the requested SHA", async () => {
    const root = await tempDir();
    const destination = path.join(root, "repo");
    await mkdir(path.join(destination, "mdd/contents"), { recursive: true });
    await writeFile(path.join(destination, "mdd/contents/index.md"), "# Hi\n");
    const calls: string[][] = [];
    let deepened = false;
    const git: GitRunner = async (args) => {
      calls.push([...args]);
      if (args.includes("cat-file")) {
        if (!deepened) throw new Error("missing");
        return { stdout: "commit\n", stderr: "" };
      }
      if (args.includes("--deepen")) {
        deepened = true;
        return { stdout: "", stderr: "" };
      }
      if (args.includes("rev-parse")) return { stdout: `${sha}\n`, stderr: "" };
      return { stdout: "", stderr: "" };
    };
    const fetched = await fetchContentRepository({
      repoUrl: "https://github.com/acme/docs",
      repoRef: "main",
      sourceSha: sha.toUpperCase(),
      destination,
      git,
    });
    expect(fetched.commit).toBe(sha);
    expect(
      calls.some((args) => args.includes("--depth") && args.includes(sha)),
    ).toBe(true);
    expect(
      calls.some((args) => args.includes("--deepen") && args.includes(sha)),
    ).toBe(true);
    expect(
      calls.some((args) => args.includes("clone") || args.includes("main")),
    ).toBe(false);
    expect(
      calls.some((args) => args[0] === "checkout" || args.includes("checkout")),
    ).toBe(true);
  });

  test("does not publish a different commit than the requested SHA", async () => {
    const root = await tempDir();
    const destination = path.join(root, "repo");
    await mkdir(path.join(destination, "mdd"), { recursive: true });
    const git: GitRunner = async (args) => {
      if (args.includes("cat-file")) return { stdout: "commit\n", stderr: "" };
      if (args.includes("rev-parse"))
        return { stdout: `${otherSha}\n`, stderr: "" };
      return { stdout: "", stderr: "" };
    };
    await expect(
      fetchContentRepository({
        repoUrl: "https://github.com/acme/docs",
        sourceSha: sha,
        destination,
        git,
      }),
    ).rejects.toThrow(new RegExp(otherSha));
  });
});

describe("hooks", () => {
  test("runs git through execFile with hooks disabled and no shell", async () => {
    const root = await tempDir();
    const log = path.join(root, "args");
    const bin = path.join(root, "bin");
    await mkdir(bin);
    const git = path.join(bin, "git");
    await writeFile(
      git,
      `#!/bin/sh
printf '%s\\n' "$@" >> ${JSON.stringify(log)}
printf 'HOOKS=%s\\n' "$GIT_CONFIG_VALUE_0" >> ${JSON.stringify(log)}
`,
    );
    await chmod(git, 0o755);
    const previousPath = process.env.PATH;
    const previousHooks = process.env.GIT_CONFIG_VALUE_0;
    process.env.PATH = `${bin}${path.delimiter}${previousPath ?? ""}`;
    process.env.GIT_CONFIG_VALUE_0 = "/tmp/evil-hooks";
    try {
      await runGit(["rev-parse", "$(touch pwned)"]);
    } finally {
      process.env.PATH = previousPath;
      if (previousHooks === undefined) delete process.env.GIT_CONFIG_VALUE_0;
      else process.env.GIT_CONFIG_VALUE_0 = previousHooks;
    }
    const recorded = await readFile(log, "utf8");
    expect(recorded.startsWith(gitSafetyArgs.join("\n"))).toBe(true);
    expect(recorded).toContain("core.hooksPath=/dev/null");
    expect(recorded).toContain("$(touch pwned)");
    expect(recorded).toContain("HOOKS=/dev/null");
    expect(
      await readFile(path.join(root, "pwned")).catch(() => null),
    ).toBeNull();
    expect(
      await readFile(path.join(process.cwd(), "pwned")).catch(() => null),
    ).toBeNull();
  });
});

describe("repository ref", () => {
  test("rejects an unsafe ref", () => {
    expect(assertRepositoryRef("feature/docs")).toBe("feature/docs");
    for (const ref of ["-evil", "main;rm", "feature/../docs", "main lock"]) {
      expect(() => assertRepositoryRef(ref)).toThrow(/branch or tag/);
    }
  });
});

describe("manifest SHA", () => {
  test("records the verified SHA and does not ask the checkout for HEAD", async () => {
    const root = await tempDir();
    await mkdir(path.join(root, "mdd/contents"), { recursive: true });
    await writeFile(path.join(root, "mdd/config.json"), "{}");
    await writeFile(path.join(root, "mdd/contents/index.md"), "# Welcome\n");
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
    const head = (
      await run("git", ["rev-parse", "HEAD"], { cwd: root })
    ).stdout.trim();
    const result = await build({ projectDir: root, sourceCommit: sha });
    const manifest = JSON.parse(
      await readFile(
        path.join(result.directory as string, "mdd-build.json"),
        "utf8",
      ),
    );
    expect(manifest.source).toEqual({ commit: sha, dirty: null });
    expect(manifest.source.commit).not.toBe(head);
    await expect(
      build({ projectDir: root, sourceCommit: "main" }),
    ).rejects.toThrow(/full Git SHA/);
    expect(
      JSON.parse(
        await readFile(
          path.join(result.directory as string, "mdd-build.json"),
          "utf8",
        ),
      ).source.commit,
    ).toBe(sha);
  });

  test("writes the branch SHA resolved during fetch", async () => {
    const parent = await tempDir();
    const destination = path.join(parent, "checkout");
    const output = path.join(parent, "site");
    const git: GitRunner = async (args) => {
      if (args[0] === "ls-remote") {
        return { stdout: "ref: refs/heads/main\tHEAD\n", stderr: "" };
      }
      if (args[0] === "clone") {
        await mkdir(path.join(destination, "mdd/contents"), {
          recursive: true,
        });
        await writeFile(path.join(destination, "mdd/config.json"), "{}");
        await writeFile(
          path.join(destination, "mdd/contents/index.md"),
          "# Welcome\n",
        );
        expect(args).toContain("--config");
        expect(args).toContain("core.hooksPath=/dev/null");
        expect(args).toContain("--branch");
        expect(args).toContain("main");
        return { stdout: "", stderr: "" };
      }
      if (args.includes("rev-parse")) return { stdout: `${sha}\n`, stderr: "" };
      throw new Error(`unexpected git ${args.join(" ")}`);
    };
    const commit = await fetchAndCompile(
      {
        MDD_REPO_URL: "https://github.com/acme/docs",
        MDD_CONTENT_CHECKOUT: destination,
        MDD_OUTPUT_DIR: output,
      },
      git,
    );
    expect(commit).toBe(sha);
    expect(
      JSON.parse(await readFile(path.join(output, "mdd-build.json"), "utf8"))
        .source,
    ).toEqual({ commit: sha, dirty: null });
  });

  test("falls back to docs/ and rejects an invalid explicit MDD_SOURCE_DIR", async () => {
    const parent = await tempDir();
    const git =
      (destination: string): GitRunner =>
      async (args) => {
        if (args[0] === "ls-remote") {
          return { stdout: "ref: refs/heads/main\tHEAD\n", stderr: "" };
        }
        if (args[0] === "clone") {
          await mkdir(path.join(destination, "docs/contents"), {
            recursive: true,
          });
          await writeFile(
            path.join(destination, "docs/contents/index.md"),
            "# Docs\n",
          );
          return { stdout: "", stderr: "" };
        }
        if (args.includes("rev-parse"))
          return { stdout: `${sha}\n`, stderr: "" };
        throw new Error(`unexpected git ${args.join(" ")}`);
      };
    const first = path.join(parent, "first");
    const fetched = await fetchContentRepository({
      repoUrl: "https://github.com/acme/docs",
      destination: first,
      git: git(first),
    });
    expect(fetched.mddDir).toBe("docs");
    const second = path.join(parent, "second");
    await expect(
      fetchContentRepository({
        repoUrl: "https://github.com/acme/docs",
        sourceDir: "mdd",
        destination: second,
        git: git(second),
      }),
    ).rejects.toThrow(/MDD_SOURCE_DIR=mdd is not an MDD folder/);
    let called = false;
    await expect(
      fetchContentRepository({
        repoUrl: "https://github.com/acme/docs",
        sourceDir: "../escape",
        destination: path.join(parent, "third"),
        git: async () => {
          called = true;
          return { stdout: "", stderr: "" };
        },
      }),
    ).rejects.toThrow(/relative folder inside the project/);
    expect(called).toBe(false);
  });

  test("does nothing when no content repository is configured", async () => {
    let called = false;
    const git: GitRunner = async () => {
      called = true;
      return { stdout: "", stderr: "" };
    };
    expect(await fetchAndCompile({}, git)).toBeUndefined();
    expect(called).toBe(false);
  });
});
