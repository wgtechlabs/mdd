import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Diagnostic } from "@wgtechlabs/mdd-engine";
import { build } from "./build.js";
import { isMissing, isWithin } from "./files.js";

const execute = promisify(execFile);
const shaPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

/** Every Git invocation gets these arguments. They disable hooks and local file remotes. */
export const gitSafetyArgs = [
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "protocol.file.allow=never",
  "-c",
  "credential.helper=",
] as const;

export interface GitResult {
  stdout: string;
  stderr: string;
}

export type GitRunner = (
  args: readonly string[],
  options?: { cwd?: string },
) => Promise<GitResult>;

export interface FetchContentOptions {
  repoUrl: string;
  repoRef?: string;
  sourceSha?: string;
  sourceDir?: string;
  destination: string;
  git?: GitRunner;
}

export interface FetchedContent {
  commit: string;
  projectDir: string;
  mddDir: string;
}

function invalidRepository(): Error {
  return new Error(
    "MDD_REPO_URL must be a public https://github.com/owner/repository URL without credentials.",
  );
}

/** Accept only a public GitHub HTTPS repository URL. */
export function parseRepositoryUrl(input: string): string {
  if (!input || /[\s\p{Cc}\p{Cf}\\]/u.test(input)) throw invalidRepository();
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw invalidRepository();
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const owner = parts[0];
  const repository = parts[1]?.replace(/\.git$/i, "");
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.port ||
    parts.length !== 2 ||
    !owner ||
    !repository ||
    !githubName(owner) ||
    !githubName(repository)
  ) {
    throw invalidRepository();
  }
  return `https://github.com/${owner}/${repository}.git`;
}

function githubName(value: string): boolean {
  return (
    /^[A-Za-z0-9._-]+$/.test(value) &&
    value !== "." &&
    value !== ".." &&
    !value.startsWith("-") &&
    !value.endsWith(".")
  );
}

/** Reject absolute paths, traversal, and empty segments before touching the checkout. */
export function lexicalSourceDir(sourceDir: string): string {
  if (
    !sourceDir ||
    sourceDir !== sourceDir.trim() ||
    path.isAbsolute(sourceDir) ||
    path.win32.isAbsolute(sourceDir)
  ) {
    throw new Error(
      "MDD_SOURCE_DIR must be a relative directory inside the content checkout.",
    );
  }
  const parts = sourceDir.split(/[/\\]/);
  if (
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes("\0"),
    )
  ) {
    throw new Error(
      "MDD_SOURCE_DIR must be a relative directory inside the content checkout.",
    );
  }
  return parts.join("/");
}

export function assertRepositoryRef(value: string): string {
  const ref = value.trim();
  const parts = ref.split("/");
  if (
    !ref ||
    ref.startsWith("-") ||
    ref.startsWith("/") ||
    ref.endsWith("/") ||
    ref.includes("//") ||
    ref.includes("..") ||
    ref.includes("@{") ||
    ref.endsWith(".") ||
    ref === "@" ||
    /[\s\p{Cc}\p{Cf}~^:?*[\\;&|$`'"<>]/u.test(ref) ||
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.startsWith(".") ||
        part.endsWith(".lock"),
    )
  ) {
    throw new Error("MDD_REPO_REF must be a branch or tag name.");
  }
  return ref;
}

export function normalizeCommitSha(value: string): string {
  const sha = value.trim().toLowerCase();
  if (!shaPattern.test(sha)) {
    throw new Error("MDD_SOURCE_SHA must be a full commit SHA.");
  }
  return sha;
}

function gitEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_")) delete env[key];
  }
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = "/dev/null";
  env.GIT_CONFIG_SYSTEM = "/dev/null";
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_LFS_SKIP_SMUDGE = "1";
  env.GIT_CONFIG_COUNT = "1";
  env.GIT_CONFIG_KEY_0 = "core.hooksPath";
  env.GIT_CONFIG_VALUE_0 = "/dev/null";
  return env;
}

function gitFailure(error: unknown): string {
  if (!(error instanceof Error)) return "Git command failed.";
  const stderr =
    "stderr" in error && error.stderr ? String(error.stderr).trim() : "";
  const text =
    (stderr || error.message).split("\n")[0] ?? "Git command failed.";
  return text.slice(0, 300);
}

/** Run Git without a shell. Hooks cannot run, including hooks from the content repository. */
export async function runGit(
  args: readonly string[],
  options: { cwd?: string } = {},
): Promise<GitResult> {
  try {
    const result = await execute("git", [...gitSafetyArgs, ...args], {
      cwd: options.cwd,
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: gitEnvironment(),
      windowsHide: true,
    });
    return { stdout: String(result.stdout), stderr: String(result.stderr) };
  } catch (error) {
    throw new Error(gitFailure(error));
  }
}

function unavailable(sha: string, cause?: unknown): Error {
  const detail =
    cause instanceof Error && cause.message ? ` ${cause.message}` : "";
  return new Error(
    `Content commit ${sha} is unavailable. Refusing to fall back to branch HEAD.${detail}`,
  );
}

async function hasCommit(
  git: GitRunner,
  destination: string,
  sha: string,
): Promise<boolean> {
  try {
    const result = await git([
      "-C",
      destination,
      "cat-file",
      "-t",
      `${sha}^{commit}`,
    ]);
    return result.stdout.trim() === "commit";
  } catch {
    return false;
  }
}

async function fetchExactCommit(
  git: GitRunner,
  destination: string,
  url: string,
  sha: string,
): Promise<string> {
  await git(["init", "--quiet", destination]);
  await git(["-C", destination, "remote", "add", "origin", url]);
  const fetchCommit = (depth: readonly string[]) =>
    git([
      "-C",
      destination,
      "fetch",
      "--no-tags",
      "--no-recurse-submodules",
      ...depth,
      "origin",
      sha,
    ]);
  try {
    await fetchCommit(["--depth", "1"]);
  } catch (error) {
    try {
      // A failed shallow fetch leaves no shallow history to deepen.
      // Retry the same commit, never a branch name.
      await fetchCommit([]);
    } catch {
      throw unavailable(sha, error);
    }
  }
  if (!(await hasCommit(git, destination, sha))) {
    try {
      await fetchCommit(["--deepen", "10000"]);
    } catch (error) {
      throw unavailable(sha, error);
    }
  }
  if (!(await hasCommit(git, destination, sha))) throw unavailable(sha);
  await git(["-C", destination, "checkout", "--detach", "--force", sha]);
  const head = (
    await git(["-C", destination, "rev-parse", "--verify", "HEAD"])
  ).stdout
    .trim()
    .toLowerCase();
  if (head !== sha) {
    throw new Error(
      `Fetched commit ${head || "unknown"} does not match ${sha}. Refusing to publish.`,
    );
  }
  return sha;
}

function defaultBranch(stdout: string): string {
  for (const line of stdout.split("\n")) {
    const match = /^ref:\s+refs\/heads\/(\S+)\s+HEAD\s*$/.exec(line);
    if (match?.[1]) return assertRepositoryRef(match[1]);
  }
  throw new Error("The content repository has no default branch.");
}

async function fetchBranch(
  git: GitRunner,
  destination: string,
  url: string,
  repoRef: string | undefined,
): Promise<string> {
  const branch = repoRef
    ? assertRepositoryRef(repoRef)
    : defaultBranch((await git(["ls-remote", "--symref", url, "HEAD"])).stdout);
  await git([
    "clone",
    "--quiet",
    "--depth",
    "1",
    "--no-tags",
    "--no-recurse-submodules",
    "--single-branch",
    "--branch",
    branch,
    "--config",
    "core.hooksPath=/dev/null",
    url,
    destination,
  ]);
  const commit = (
    await git(["-C", destination, "rev-parse", "--verify", "HEAD"])
  ).stdout
    .trim()
    .toLowerCase();
  if (!shaPattern.test(commit)) {
    throw new Error("The content repository did not resolve to a commit SHA.");
  }
  return commit;
}

/** Confirm each path segment is a real directory and the final path stays inside the checkout. */
export async function resolveSourceDirectory(
  checkout: string,
  sourceDir: string,
): Promise<string> {
  const relative = lexicalSourceDir(sourceDir);
  const root = await realpath(checkout);
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    let entry: Awaited<ReturnType<typeof lstat>>;
    try {
      entry = await lstat(current);
    } catch (error) {
      if (isMissing(error)) {
        throw new Error(
          "MDD_SOURCE_DIR must be a directory inside the content checkout.",
        );
      }
      throw error;
    }
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      throw new Error(
        "MDD_SOURCE_DIR must be a real directory inside the content checkout.",
      );
    }
  }
  const resolved = await realpath(current);
  if (!isWithin(root, resolved)) {
    throw new Error("MDD_SOURCE_DIR must stay inside the content checkout.");
  }
  return relative;
}

/** Fetch a public GitHub repository without running its hooks or install scripts. */
export async function fetchContentRepository(
  options: FetchContentOptions,
): Promise<FetchedContent> {
  const url = parseRepositoryUrl(options.repoUrl);
  const sourceDir = lexicalSourceDir(options.sourceDir?.trim() || "mdd");
  const git = options.git ?? runGit;
  const sha = options.sourceSha?.trim()
    ? normalizeCommitSha(options.sourceSha)
    : undefined;
  const destination = path.resolve(options.destination);
  const commit = sha
    ? await fetchExactCommit(git, destination, url, sha)
    : await fetchBranch(git, destination, url, options.repoRef);
  const projectDir = await realpath(destination);
  const mddDir = await resolveSourceDirectory(projectDir, sourceDir);
  return { commit, projectDir, mddDir };
}

function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function reportDiagnostics(diagnostics: Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    const location = diagnostic.file
      ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ""}` : ""}: `
      : "";
    console.error(
      `${location}${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`,
    );
  }
}

/**
 * Image-build entry. With no MDD_REPO_URL the image keeps the mounted-project
 * server path and this command does nothing.
 */
export async function fetchAndCompile(
  env: NodeJS.ProcessEnv,
  git: GitRunner = runGit,
): Promise<string | undefined> {
  const repoUrl = blank(env.MDD_REPO_URL);
  if (!repoUrl) return undefined;
  const fetched = await fetchContentRepository({
    repoUrl,
    repoRef: blank(env.MDD_REPO_REF),
    sourceSha: blank(env.MDD_SOURCE_SHA),
    sourceDir: blank(env.MDD_SOURCE_DIR) ?? "mdd",
    destination: env.MDD_CONTENT_CHECKOUT ?? "/tmp/mdd-content",
    git,
  });
  const result = await build({
    projectDir: fetched.projectDir,
    mddDir: fetched.mddDir,
    outDir: env.MDD_OUTPUT_DIR ?? "/out/site",
    basePath: blank(env.MDD_BASE_PATH),
    editBaseUrl: blank(env.MDD_EDIT_BASE_URL),
    sourceCommit: fetched.commit,
  });
  reportDiagnostics(result.diagnostics);
  if (!result.site || !result.directory) {
    throw new Error(
      "Fix the documentation errors before publishing the image.",
    );
  }
  return fetched.commit;
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  await fetchAndCompile(process.env).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
