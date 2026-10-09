import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const inventoryName = ".mdd-output.json";

export function isWithin(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export function protectedName(name: string): boolean {
  return (
    name.startsWith(".") ||
    Array.from(name).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    /^(?:node_modules|package(?:-lock)?\.json|bun\.lockb?|yarn\.lock|pnpm-lock\.yaml|credentials?(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?)$/i.test(
      name,
    ) ||
    /\.(?:pem|key|p12|pfx)$/i.test(name)
  );
}

/** Resolve absent paths too, so an existing ancestor cannot hide source overlap. */
export async function resolveDestination(file: string): Promise<string> {
  const entry = await lstat(file).catch((error) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (entry) {
    if (entry.isSymbolicLink())
      throw new Error(`Output paths cannot use symlinks: ${file}`);
    if (!entry.isDirectory())
      throw new Error(`Output path must be a directory: ${file}`);
    return realpath(file);
  }
  return path.join(
    await resolveDestination(path.dirname(file)),
    path.basename(file),
  );
}

/** Read only a regular file, with no symlink in its path below the supplied root. */
export async function readSafeFile(
  root: string,
  relative: string,
): Promise<Buffer> {
  const parts = relative.split("/");
  if (
    !parts.length ||
    parts.some(
      (part) => !part || part === "." || part === ".." || part.includes("\\"),
    )
  ) {
    throw new Error(`Unsafe file path: ${relative}`);
  }
  let target = root;
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    const entry = await lstat(target);
    if (
      entry.isSymbolicLink() ||
      (index < parts.length - 1 && !entry.isDirectory())
    ) {
      throw new Error(`Cannot export a symlink or special file: ${relative}`);
    }
  }
  const entry = await lstat(target);
  if (!entry.isFile()) throw new Error(`Expected a regular file: ${relative}`);
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.ino !== entry.ino ||
      opened.dev !== entry.dev ||
      !isWithin(root, await realpath(target))
    ) {
      throw new Error(`File changed while reading: ${relative}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function listTree(
  root: string,
): Promise<{ files: string[]; directories: string[] }> {
  const files: string[] = [];
  const directories: string[] = [];
  async function visit(relative: string): Promise<void> {
    for (const entry of await readdir(path.join(root, relative), {
      withFileTypes: true,
    })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink())
        throw new Error(`Cannot export or replace a symlink: ${name}`);
      if (entry.isDirectory()) {
        directories.push(name);
        await visit(name);
      } else if (entry.isFile()) files.push(name);
      else throw new Error(`Cannot export or replace a special file: ${name}`);
    }
  }
  await visit("");
  return { files: files.sort(), directories: directories.sort() };
}

function digest(contents: Uint8Array): string {
  return createHash("sha256").update(contents).digest("hex");
}

function inventory(files: Map<string, Buffer>): string {
  return `${JSON.stringify({ schemaVersion: 1, files: Object.fromEntries([...files].map(([file, contents]) => [file, digest(contents)])) }, null, 2)}\n`;
}

async function assertReplaceable(directory: string): Promise<boolean> {
  const entry = await lstat(directory).catch((error) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (!entry) return false;
  if (!entry.isDirectory() || entry.isSymbolicLink())
    throw new Error(`Refusing to replace a non-directory output: ${directory}`);
  const tree = await listTree(directory);
  if (tree.files.length === 0 && tree.directories.length === 0) return true;
  let manifest: unknown;
  try {
    manifest = JSON.parse(
      (await readSafeFile(directory, inventoryName)).toString("utf8"),
    );
  } catch (cause) {
    throw new Error(
      `Refusing to replace an unrelated output directory. Choose an empty directory: ${directory}`,
      { cause },
    );
  }
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !("schemaVersion" in manifest) ||
    manifest.schemaVersion !== 1 ||
    !("files" in manifest) ||
    !manifest.files ||
    typeof manifest.files !== "object" ||
    Array.isArray(manifest.files)
  ) {
    throw new Error(`Invalid output ownership inventory: ${directory}`);
  }
  const entries = Object.entries(manifest.files);
  const names = entries.map(([name]) => name).sort();
  const actual = tree.files.filter((name) => name !== inventoryName);
  const expectedDirectories = new Set<string>();
  for (const name of names) {
    const segments = name.split("/");
    for (let count = 1; count < segments.length; count++)
      expectedDirectories.add(segments.slice(0, count).join("/"));
  }
  if (
    JSON.stringify(names) !== JSON.stringify(actual) ||
    JSON.stringify([...expectedDirectories].sort()) !==
      JSON.stringify(tree.directories)
  ) {
    throw new Error(
      `Output contains unrecognized files or directories; move them before rebuilding: ${directory}`,
    );
  }
  for (const [name, hash] of entries) {
    if (
      typeof hash !== "string" ||
      digest(await readSafeFile(directory, name)) !== hash
    ) {
      throw new Error(
        `Generated output was edited; move or remove the edited file before rebuilding: ${name}`,
      );
    }
  }
  return true;
}

/** Stage everything, verify ownership, then exchange directories with rollback on failure. */
export async function writeOutput(
  directory: string,
  files: Map<string, Buffer>,
): Promise<void> {
  await assertReplaceable(directory);
  await mkdir(path.dirname(directory), { recursive: true });
  const lockPath = path.join(
    path.dirname(directory),
    `.${path.basename(directory)}.mdd-lock`,
  );
  const lock = await open(lockPath, "wx").catch((cause) => {
    throw new Error(
      `Cannot lock output; another build may be running: ${directory}`,
      { cause },
    );
  });
  let staging: string | undefined;
  let backup: string | undefined;
  try {
    staging = await mkdtemp(path.join(path.dirname(directory), ".mdd-build-"));
    for (const [name, contents] of files) {
      const target = path.join(staging, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents, { flag: "wx" });
    }
    await writeFile(path.join(staging, inventoryName), inventory(files), {
      flag: "wx",
    });
    if (await assertReplaceable(directory)) {
      backup = `${staging}-previous`;
      await rename(directory, backup);
    }
    try {
      await rename(staging, directory);
      staging = undefined;
    } catch (error) {
      if (backup) {
        await rename(backup, directory);
        backup = undefined;
      }
      throw error;
    }
    if (backup) {
      await rm(backup, { recursive: true });
      backup = undefined;
    }
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
