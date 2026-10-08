#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { compileProject, type Diagnostic } from "@wgtechlabs/mdd-engine";
import { build } from "./build.js";
import { dev } from "./dev.js";
import { serve } from "./server.js";

const help = `Usage: mdd <command> [options]

Commands:
  check    Validate the local documentation
  build    Export a complete static website
  dev      Preview and rebuild when documentation changes
  serve    Serve an already-built website

Options:
  --project <path>     Project directory (default: current directory)
  --dir <path>         Documentation directory within the project (default: mdd)
  --out <path>         Output directory relative to the project (default: mdd-dist)
  --base-path <path>   Public URL prefix, such as /docs/
  --port <number>      Server port (default: PORT or 3000; 0 selects a free port)
  --host <address>     Bind address (dev: 127.0.0.1; serve: 0.0.0.0)
  --help, -h          Show this help
  --version, -v       Show the installed version

check accepts --project, --dir, --base-path.
build accepts those options and --out.
dev accepts all options. serve accepts --project, --out, --port, --host.
`;

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

function portNumber(value: string | undefined): number {
  const input = value ?? process.env.PORT ?? "3000";
  if (!/^\d+$/.test(input) || Number(input) > 65535) {
    throw new Error("Port must be an integer between 0 and 65535.");
  }
  return Number(input);
}

function stopOnSignal(close: () => Promise<void>): void {
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void close().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      project: { type: "string" },
      dir: { type: "string" },
      out: { type: "string" },
      "base-path": { type: "string" },
      port: { type: "string" },
      host: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
    strict: true,
  });
  const command = positionals[0];
  if (
    positionals.length > 1 ||
    (command && !["check", "build", "dev", "serve"].includes(command))
  ) {
    throw new Error("Expected one command: check, build, dev, or serve.");
  }
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "string" && (!value.trim() || value.includes("\0"))) {
      throw new Error(
        `--${name} must have a non-empty value without null bytes.`,
      );
    }
  }
  if (values.version) {
    const metadata = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    console.log(metadata.version);
    return;
  }
  if (values.help || !command) {
    console.log(help);
    return;
  }
  const allowed: Record<string, string[]> = {
    check: ["project", "dir", "base-path"],
    build: ["project", "dir", "base-path", "out"],
    dev: ["project", "dir", "base-path", "out", "port", "host"],
    serve: ["project", "out", "port", "host"],
  };
  for (const name of Object.keys(values)) {
    if (!allowed[command]?.includes(name)) {
      throw new Error(`--${name} is not supported by ${command}.`);
    }
  }
  const options = {
    projectDir: resolve(values.project ?? process.cwd()),
    mddDir: values.dir,
    basePath: values["base-path"],
    outDir: values.out ?? "mdd-dist",
  };
  if (command === "check" || command === "build") {
    const result =
      command === "check"
        ? await compileProject(options)
        : await build(options);
    reportDiagnostics(result.diagnostics);
    if (!result.site) {
      process.exitCode = 1;
      return;
    }
    console.log(
      command === "check"
        ? `Validated ${result.site.pages.length} documentation pages.`
        : `Built ${result.site.pages.length} pages in ${resolve(options.projectDir, options.outDir)}.`,
    );
    return;
  }
  const port = portNumber(values.port);
  if (command === "dev") {
    const preview = await dev(
      { ...options, port, host: values.host ?? "127.0.0.1" },
      {
        diagnostics: reportDiagnostics,
        message: (message) => console.log(message),
        error: (error) => console.error(error.message),
      },
    );
    stopOnSignal(() => preview.close());
    return;
  }
  const server = await serve({
    directory: resolve(options.projectDir, options.outDir),
    port,
    host: values.host ?? "0.0.0.0",
  });
  const address = server.address();
  if (address && typeof address !== "string") {
    const host =
      address.family === "IPv6" ? `[${address.address}]` : address.address;
    console.log(`Serving on http://${host}:${address.port}/`);
  }
  stopOnSignal(
    () =>
      new Promise<void>((done, reject) => {
        server.close((error) => (error ? reject(error) : done()));
        server.closeIdleConnections();
      }),
  );
}

await main().catch((error: unknown) => {
  console.error(
    `mdd: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
