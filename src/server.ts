import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, lstat, open, realpath } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import { listTree, protectedName, readSafeFile } from "./files.js";
import { type BuildManifest, isBasePath } from "./manifest.js";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

const inventoryName = ".mdd-output.json";

function outputPath(filename: string): boolean {
  return !filename
    .split("/")
    .some((part) => !part || part.includes("\\") || protectedName(part));
}

function parseInventory(contents: Buffer): Map<string, string> {
  const value: unknown = JSON.parse(contents.toString("utf8"));
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("files" in value) ||
    !value.files ||
    typeof value.files !== "object" ||
    Array.isArray(value.files) ||
    Object.keys(value).some((key) => !["schemaVersion", "files"].includes(key))
  ) {
    throw new Error("Invalid mdd output inventory. Rebuild before serving.");
  }
  const files = new Map<string, string>();
  for (const [name, hash] of Object.entries(value.files)) {
    if (
      !outputPath(name) ||
      typeof hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(hash)
    ) {
      throw new Error(`Invalid output inventory entry: ${name}`);
    }
    files.set(name, hash);
  }
  for (const name of [
    "index.html",
    "404.html",
    "mdd-build.json",
    "_mdd/reader.css",
    "_mdd/reader.js",
    "llms.txt",
    "markdown/index.md",
  ]) {
    if (!files.has(name))
      throw new Error(`Incomplete mdd build: missing ${name}.`);
  }
  return files;
}

/** Decode the request target ourselves: URL normalization would hide traversal. */
function requestPath(target: string): string | null {
  const rawPath = target.split("?")[0] ?? "";
  if (
    !rawPath.startsWith("/") ||
    rawPath.includes("#") ||
    rawPath.includes("//")
  )
    return null;
  try {
    const parts = rawPath.split("/").map(decodeURIComponent);
    if (
      parts.some(
        (part) =>
          part === "." ||
          part === ".." ||
          /[/\\]/.test(part) ||
          Array.from(part).some(
            (character) =>
              character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ),
      )
    )
      return null;
    return parts.join("/");
  } catch {
    return null;
  }
}

function encodePath(pathname: string): string {
  return pathname.split("/").map(encodeURIComponent).join("/");
}

function parseManifest(contents: Buffer): BuildManifest {
  const value: unknown = JSON.parse(contents.toString("utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("mddVersion" in value) ||
    typeof value.mddVersion !== "string" ||
    !value.mddVersion.trim() ||
    !("engineVersion" in value) ||
    typeof value.engineVersion !== "string" ||
    !value.engineVersion.trim() ||
    !("basePath" in value) ||
    typeof value.basePath !== "string" ||
    !isBasePath(value.basePath) ||
    !("source" in value) ||
    typeof value.source !== "object" ||
    value.source === null ||
    !("commit" in value.source) ||
    !(
      value.source.commit === null || typeof value.source.commit === "string"
    ) ||
    !("dirty" in value.source) ||
    !(value.source.dirty === null || typeof value.source.dirty === "boolean") ||
    Object.keys(value).some(
      (key) =>
        ![
          "schemaVersion",
          "mddVersion",
          "engineVersion",
          "basePath",
          "source",
        ].includes(key),
    ) ||
    Object.keys(value.source).some((key) => !["commit", "dirty"].includes(key))
  ) {
    throw new Error(
      "Invalid mdd-build.json manifest. Rebuild the site before serving.",
    );
  }
  return {
    schemaVersion: 1,
    mddVersion: value.mddVersion,
    engineVersion: value.engineVersion,
    basePath: value.basePath,
    source: { commit: value.source.commit, dirty: value.source.dirty },
  };
}

/** Reject symlinks at every level and open only the checked regular file. */
async function openBuiltFile(
  root: string,
  filename: string,
): Promise<FileHandle | null> {
  const parts = filename.split("/");
  if (!outputPath(filename)) return null;
  try {
    let path = root;
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return null;
    for (const part of parts.slice(0, -1)) {
      path = join(path, part);
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
    }
    path = join(path, parts.at(-1) ?? "");
    const expected = await lstat(path);
    if (!expected.isFile() || expected.isSymbolicLink()) return null;
    const resolved = relative(root, await realpath(path));
    if (
      resolved === ".." ||
      resolved.startsWith(`..${sep}`) ||
      resolve(root, resolved) !== path
    )
      return null;
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const actual = await file.stat();
      if (
        !actual.isFile() ||
        actual.dev !== expected.dev ||
        actual.ino !== expected.ino
      ) {
        await file.close();
        return null;
      }
      return file;
    } catch (error) {
      await file.close();
      throw error;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ["ENOENT", "ENOTDIR", "ELOOP", "EACCES"].includes(String(error.code))
    ) {
      return null;
    }
    throw error;
  }
}

async function readBuiltFile(
  root: string,
  filename: string,
): Promise<Buffer | null> {
  const file = await openBuiltFile(root, filename);
  if (!file) return null;
  try {
    return await file.readFile();
  } finally {
    await file.close();
  }
}

async function validateBuild(root: string): Promise<{
  manifest: BuildManifest;
  inventory: Buffer;
  files: Map<string, string>;
}> {
  const inventory = await readSafeFile(root, inventoryName);
  const files = parseInventory(inventory);
  const tree = await listTree(root);
  const expected = [...files.keys(), inventoryName].sort();
  if (JSON.stringify(tree.files) !== JSON.stringify(expected)) {
    throw new Error(
      "Incomplete mdd build: output files do not match the inventory.",
    );
  }
  let manifest: BuildManifest | undefined;
  for (const [name, hash] of files) {
    const contents = await readBuiltFile(root, name);
    if (
      !contents ||
      createHash("sha256").update(contents).digest("hex") !== hash
    ) {
      throw new Error(`Incomplete mdd build: missing or changed ${name}.`);
    }
    if (name === "mdd-build.json") manifest = parseManifest(contents);
  }
  if (!manifest) throw new Error("Incomplete mdd build: missing manifest.");
  return { manifest, inventory, files };
}

/** Content is immutable after startup; readiness checks presence without rehashing assets. */
async function checkReadiness(
  root: string,
  inventory: Buffer,
  files: Map<string, string>,
): Promise<void> {
  if (!(await readSafeFile(root, inventoryName)).equals(inventory)) {
    throw new Error(
      "Build inventory changed. Restart the server for the new build.",
    );
  }
  for (const name of files.keys()) {
    const file = await openBuiltFile(root, name);
    if (!file) throw new Error(`Build file unavailable: ${name}`);
    await file.close();
  }
}

function respond(
  response: ServerResponse,
  method: string | undefined,
  status: number,
  body: Buffer | string,
  type: string,
): void {
  response.writeHead(status, {
    "Content-Type": type,
    "Content-Length": Buffer.byteLength(body),
    "X-Content-Type-Options": "nosniff",
  });
  response.end(method === "HEAD" ? undefined : body);
}

/** Serve a finished static build without compiling content or fetching sources. */
export async function serve(options: {
  directory: string;
  port?: number;
  host?: string;
}): Promise<Server> {
  const root = await realpath(resolve(options.directory));
  const { manifest, inventory, files } = await validateBuild(root);
  const prefix = decodeURIComponent(manifest.basePath);
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        respond(
          response,
          request.method,
          405,
          "Method Not Allowed\n",
          "text/plain; charset=utf-8",
        );
        return;
      }
      const pathname = requestPath(request.url ?? "");
      if (pathname === "/healthz") {
        response.setHeader("Cache-Control", "no-store");
        try {
          await checkReadiness(root, inventory, files);
          respond(
            response,
            request.method,
            200,
            "ok\n",
            "text/plain; charset=utf-8",
          );
        } catch {
          respond(
            response,
            request.method,
            503,
            "Build unavailable\n",
            "text/plain; charset=utf-8",
          );
        }
        return;
      }
      if (prefix !== "/" && pathname === prefix.slice(0, -1)) {
        const queryIndex = (request.url ?? "").indexOf("?");
        response.setHeader(
          "Location",
          manifest.basePath +
            (queryIndex < 0 ? "" : request.url?.slice(queryIndex)),
        );
        respond(response, request.method, 308, "", "text/plain; charset=utf-8");
        return;
      }
      if (pathname?.startsWith(prefix)) {
        const relativePath = pathname.slice(prefix.length);
        const filename =
          relativePath === "" || relativePath.endsWith("/")
            ? `${relativePath}index.html`
            : relativePath;
        const type = contentTypes[extname(filename).toLowerCase()];
        if (type && files.has(filename)) {
          const file = await readBuiltFile(root, filename);
          if (file !== null) {
            respond(response, request.method, 200, file, type);
            return;
          }
        }
        // Canonical directory URLs keep relative links valid, even without JavaScript.
        if (
          !relativePath.endsWith("/") &&
          files.has(`${relativePath}/index.html`) &&
          (await readBuiltFile(root, `${relativePath}/index.html`)) !== null
        ) {
          const queryIndex = (request.url ?? "").indexOf("?");
          response.setHeader(
            "Location",
            encodePath(`${pathname}/`) +
              (queryIndex < 0 ? "" : request.url?.slice(queryIndex)),
          );
          respond(
            response,
            request.method,
            308,
            "",
            "text/plain; charset=utf-8",
          );
          return;
        }
      }
      const notFound = await readBuiltFile(root, "404.html");
      respond(
        response,
        request.method,
        404,
        notFound ?? "Not Found\n",
        notFound
          ? (contentTypes[".html"] ?? "text/html")
          : "text/plain; charset=utf-8",
      );
    } catch {
      respond(
        response,
        request.method,
        500,
        "Internal Server Error\n",
        "text/plain; charset=utf-8",
      );
    }
  });
  await new Promise<void>((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 3000, options.host ?? "127.0.0.1", () => {
      server.off("error", reject);
      resolveListening();
    });
  });
  return server;
}
