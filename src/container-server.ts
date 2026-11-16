import { lstat, realpath } from "node:fs/promises";
import type { Server } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "./build.js";
import { isMissing, isWithin } from "./files.js";
import { resolveContentFolder } from "./project-folder.js";
import { serve } from "./server.js";

export const defaultPrebuiltDir = "/app/site";

export function serverListenOptions(env: NodeJS.ProcessEnv): {
  host: string;
  port: number;
} {
  const input = env.PORT ?? "3000";
  if (!/^\d+$/.test(input) || Number(input) < 1 || Number(input) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port: Number(input),
  };
}

/** A baked site is a real directory whose manifest is a regular file inside it. */
export async function findPrebuiltSite(
  directory: string,
): Promise<string | undefined> {
  let rootStat: Awaited<ReturnType<typeof lstat>>;
  try {
    rootStat = await lstat(directory);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Prebuilt site directory must be a real directory.");
  }
  const manifestPath = path.join(directory, "mdd-build.json");
  let manifestStat: Awaited<ReturnType<typeof lstat>>;
  try {
    manifestStat = await lstat(manifestPath);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new Error("Prebuilt site manifest must be a regular file.");
  }
  const root = await realpath(directory);
  const manifest = await realpath(manifestPath);
  if (!isWithin(root, manifest)) {
    throw new Error(
      "Prebuilt site manifest must stay inside the site directory.",
    );
  }
  return root;
}

/** Serve a site baked into the image, or build and serve a mounted project. */
export async function startContainer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<Server> {
  const listen = serverListenOptions(env);
  const prebuilt = await findPrebuiltSite(
    env.MDD_PREBUILT_DIR ?? defaultPrebuiltDir,
  );
  if (prebuilt) {
    console.log("Serving the baked documentation site.");
    return serve({ directory: prebuilt, ...listen });
  }

  console.log("No baked site found. Building the mounted project.");
  const projectDir = path.resolve(env.MDD_PROJECT_DIR ?? process.cwd());
  const mddDir = await resolveContentFolder(
    projectDir,
    env.MDD_DOCS_DIR,
    "MDD_DOCS_DIR",
  );
  console.log(`Using the MDD folder ${mddDir}/.`);
  const result = await build({
    projectDir,
    mddDir,
    outDir: env.MDD_OUTPUT_DIR ?? "/tmp/mdd-dist",
    basePath: env.MDD_BASE_PATH,
    editBaseUrl: env.MDD_EDIT_BASE_URL,
  });
  for (const diagnostic of result.diagnostics) {
    const location = diagnostic.file
      ? `${diagnostic.file}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ""}` : ""}: `
      : "";
    console.error(
      `${location}${diagnostic.severity} ${diagnostic.code}: ${diagnostic.message}`,
    );
  }
  if (!result.site || !result.directory) {
    throw new Error("Fix the documentation errors before starting the server.");
  }
  return serve({ directory: result.directory, ...listen });
}

function invokedDirectly(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  await startContainer()
    .then((server) => {
      const address = server.address();
      if (address && typeof address !== "string") {
        const host =
          address.family === "IPv6" ? `[${address.address}]` : address.address;
        console.log(`Serving on http://${host}:${address.port}/`);
      }
      let stopping = false;
      const stop = () => {
        if (stopping) return;
        stopping = true;
        server.close((error) => {
          if (error) {
            console.error(error.message);
            process.exitCode = 1;
          }
        });
        server.closeIdleConnections();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
