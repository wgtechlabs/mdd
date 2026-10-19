import { resolve } from "node:path";
import { build } from "./build.js";
import { serve } from "./server.js";

function portNumber(value: string | undefined): number {
  const input = value ?? "3000";
  if (!/^\d+$/.test(input) || Number(input) < 1 || Number(input) > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return Number(input);
}

async function main(): Promise<void> {
  const projectDir = resolve(process.env.MDD_PROJECT_DIR ?? process.cwd());
  const result = await build({
    projectDir,
    mddDir: process.env.MDD_DOCS_DIR,
    outDir: process.env.MDD_OUTPUT_DIR ?? "/tmp/mdd-dist",
    basePath: process.env.MDD_BASE_PATH,
    editBaseUrl: process.env.MDD_EDIT_BASE_URL,
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

  const server = await serve({
    directory: result.directory,
    port: portNumber(process.env.PORT),
    host: process.env.HOST ?? "0.0.0.0",
  });
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
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
