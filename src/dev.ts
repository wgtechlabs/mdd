import { type FSWatcher, watch } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import type { Server } from "node:http";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Diagnostic, Site } from "@wgtechlabs/mdd-engine";
import { type BuildOptions, build } from "./build.js";
import { serve } from "./server.js";
import { dThemeDirectory } from "./theme.js";

interface Reporter {
  diagnostics: (diagnostics: Diagnostic[]) => void;
  message: (message: string) => void;
  error: (error: Error) => void;
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((done, reject) => {
    server.close((error) => (error ? reject(error) : done()));
    // Preview replaces the output inventory. An active keep-alive or partial
    // request must not hold the old server open and block the next snapshot.
    server.closeAllConnections();
  });
}

/** A local preview watches compiler-selected inputs and serves the last valid build. */
export async function dev(
  options: BuildOptions & { port: number; host: string },
  report: Reporter,
): Promise<{ close: () => Promise<void> }> {
  const initial = await build(options);
  report.diagnostics(initial.diagnostics);
  if (!initial.site)
    throw new Error("Fix the documentation errors before starting preview.");
  let server = await serve({ directory: initial.directory, ...options });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Preview server did not bind to a TCP port.");
  }
  const port = address.port;
  let watchers: FSWatcher[] = [];
  let watchedInputs: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;
  let dirty = false;
  let closed = false;
  let previousDiagnostics = JSON.stringify(initial.diagnostics);

  function schedule(delay = 100): void {
    if (closed) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!pending) {
        pending = rebuild().finally(() => {
          pending = undefined;
        });
      }
    }, delay);
  }

  async function watchInputs(site: Site): Promise<boolean> {
    const home = site.pages.find((page) => page.route === "/");
    if (!home) throw new Error("The engine did not provide a homepage.");
    const configRoot = resolve(options.projectDir, options.mddDir ?? "mdd");
    const configPath = resolve(configRoot, "config.json");
    const configs = new Set([configPath]);
    try {
      configs.add(await realpath(configPath));
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
    const roots = new Set([
      dirname(resolve(options.projectDir, home.source)),
      dThemeDirectory,
      fileURLToPath(new URL("../assets/", import.meta.url)),
    ]);
    if ("directory" in site.theme)
      roots.add(resolve(options.projectDir, site.theme.directory));
    // Directory identity also detects replacement at the same path: an old
    // watcher may still refer to the removed directory's inode.
    const identity = JSON.stringify([
      [...roots].sort(),
      [...configs].sort(),
      await Promise.all(
        [...new Set([...roots, ...[...configs].map(dirname)])]
          .sort()
          .map(async (directory) => {
            const entry = await stat(directory);
            return [directory, entry.dev, entry.ino];
          }),
      ),
    ]);
    if (identity === watchedInputs) return false;
    const next: FSWatcher[] = [];
    try {
      for (const root of roots) {
        const watcher = watch(root, { recursive: true }, (_event, filename) => {
          if (
            !filename
              ?.split(sep)
              .some((part) => part.startsWith(".") || part === "node_modules")
          ) {
            schedule();
          }
        });
        watcher.on("error", (error) => {
          watchedInputs = undefined;
          report.error(error);
          schedule(1000);
        });
        next.push(watcher);
      }
      for (const config of configs) {
        // The shared footer belongs beside the authoring config, even when the
        // config itself is a symlink. Watch its parent so creation/removal work.
        const names = new Set([basename(config)]);
        if (config === configPath) names.add("footer.md");
        const configWatcher = watch(dirname(config), (_event, filename) => {
          if (!filename || names.has(filename)) schedule();
        });
        configWatcher.on("error", (error) => {
          watchedInputs = undefined;
          report.error(error);
          schedule(1000);
        });
        next.push(configWatcher);
      }
    } catch (error) {
      for (const watcher of next) watcher.close();
      throw error;
    }
    for (const watcher of watchers) watcher.close();
    watchers = next;
    watchedInputs = identity;
    return true;
  }

  async function rebuild(): Promise<void> {
    while (dirty && !closed) {
      dirty = false;
      try {
        const result = await build(options);
        const diagnostics = JSON.stringify(result.diagnostics);
        if (diagnostics !== previousDiagnostics) {
          report.diagnostics(result.diagnostics);
          previousDiagnostics = diagnostics;
        }
        if (!result.site) {
          // A changed configuration may reference a directory that does not exist
          // yet. Retry until valid, without reimplementing the engine's config parser.
          schedule(1000);
          return;
        }
        if (closed) return;
        if (await watchInputs(result.site)) {
          // Edits to newly selected roots can precede watcher attachment.
          // Catch up after activating this valid build, so an invalid edit
          // still leaves the server bound to the last successful inventory.
          dirty = true;
        }
        // The server binds to an immutable output inventory. Reopen on the same
        // port after each completed build so new routes and hashes take effect.
        await closeServer(server);
        if (closed) return;
        server = await serve({
          directory: result.directory,
          host: options.host,
          port,
        });
        report.message(
          `Rebuilt ${result.site.pages.length} documentation pages. Refresh to view changes.`,
        );
      } catch (error) {
        report.error(error instanceof Error ? error : new Error(String(error)));
        schedule(1000);
        return;
      }
    }
  }

  try {
    await watchInputs(initial.site);
    // Cover edits between the initial compile and watcher attachment as well.
    // Finish before announcing readiness so startup has no pending restart.
    dirty = true;
    pending = rebuild().finally(() => {
      pending = undefined;
    });
    await pending;
  } catch (error) {
    for (const watcher of watchers) watcher.close();
    if (timer) clearTimeout(timer);
    await closeServer(server);
    throw error;
  }
  const host =
    address.family === "IPv6" ? `[${address.address}]` : address.address;
  report.message(`Preview on http://${host}:${port}${initial.site.basePath}`);
  return {
    async close() {
      closed = true;
      if (timer) clearTimeout(timer);
      await pending;
      for (const watcher of watchers) watcher.close();
      await closeServer(server);
    },
  };
}
