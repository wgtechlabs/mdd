import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isMissing, isWithin } from "./files.js";

/** Folders checked, in order, when no content folder is configured. */
export const defaultContentFolders = ["mdd", "docs"] as const;

const expectedStructure =
  "An MDD folder needs contents/index.md (or the index.md of paths.contents in its config.json). config.json is optional.";

/** Reject absolute paths, traversal, and empty segments before touching the disk. */
export function lexicalFolder(folder: string, variable: string): string {
  const invalid = new Error(
    `${variable} must be a relative folder inside the project, such as "mdd" or "docs".`,
  );
  if (
    !folder ||
    folder !== folder.trim() ||
    path.isAbsolute(folder) ||
    path.win32.isAbsolute(folder)
  ) {
    throw invalid;
  }
  const parts = folder.split(/[/\\]/);
  if (
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes("\0"),
    )
  ) {
    throw invalid;
  }
  return parts.join("/");
}

type Inspection = { valid: true } | { valid: false; reason: string };

async function entry(file: string) {
  try {
    return await lstat(file);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function contentsFolder(folder: string): Promise<string> {
  const configPath = path.join(folder, "config.json");
  const config = await entry(configPath);
  if (!config?.isFile()) return "contents";
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as {
      paths?: { contents?: unknown };
    };
    const contents = parsed?.paths?.contents;
    return typeof contents === "string" && contents ? contents : "contents";
  } catch {
    // The engine reports invalid JSON with its own diagnostic.
    return "contents";
  }
}

/** Check one folder for the MDD structure without following symlinked segments. */
export async function inspectContentFolder(
  root: string,
  folder: string,
): Promise<Inspection> {
  let current = root;
  for (const part of folder.split("/")) {
    current = path.join(current, part);
    const found = await entry(current);
    if (!found) return { valid: false, reason: `${folder}/ does not exist` };
    if (found.isSymbolicLink() || !found.isDirectory()) {
      return { valid: false, reason: `${folder}/ is not a real directory` };
    }
  }
  const resolved = await realpath(current);
  if (!isWithin(root, resolved)) {
    return { valid: false, reason: `${folder}/ is outside the project` };
  }
  const contents = await contentsFolder(resolved);
  const index = path.resolve(resolved, contents, "index.md");
  const relative = path.relative(root, index).split(path.sep).join("/");
  if (!isWithin(root, index)) {
    return {
      valid: false,
      reason: `${folder}/ points paths.contents outside the project`,
    };
  }
  const found = await entry(index);
  if (!found?.isFile()) {
    return { valid: false, reason: `${relative} is missing` };
  }
  return { valid: true };
}

/**
 * Pick the MDD folder inside a project. An explicit folder always wins and must
 * be valid. Otherwise use mdd/, then docs/. Never fall back to an empty site.
 */
export async function resolveContentFolder(
  projectDir: string,
  explicit: string | undefined,
  variable: string,
): Promise<string> {
  const root = await realpath(projectDir);
  const configured = explicit?.trim() ? explicit : undefined;
  if (configured !== undefined) {
    const folder = lexicalFolder(configured, variable);
    const result = await inspectContentFolder(root, folder);
    if (!result.valid) {
      throw new Error(
        `${variable}=${folder} is not an MDD folder: ${result.reason}. ${expectedStructure}`,
      );
    }
    return folder;
  }
  const reasons: string[] = [];
  for (const folder of defaultContentFolders) {
    const result = await inspectContentFolder(root, folder);
    if (result.valid) return folder;
    reasons.push(result.reason);
  }
  throw new Error(
    `No MDD folder found. Checked mdd/ and docs/: ${reasons.join("; ")}. ${expectedStructure} Add an mdd/ folder, or set ${variable} to your MDD folder.`,
  );
}
