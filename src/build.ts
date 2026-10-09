import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  type CompileOptions,
  compileProject,
  createSearchIndex,
  type Diagnostic,
  type Site,
} from "@wgtechlabs/mdd-engine";
import { normalizeEditBaseUrl } from "./edit.js";
import {
  isMissing,
  isWithin,
  listTree,
  protectedName,
  readSafeFile,
  resolveDestination,
  writeOutput,
} from "./files.js";
import { type BuildManifest, isBasePath } from "./manifest.js";
import { renderNotFound, renderPage } from "./render.js";
import {
  dThemeDirectory,
  readCustomThemeIdentity,
  readDThemeIdentity,
} from "./theme.js";

export type BuildOptions = CompileOptions & {
  outDir?: string;
  theme?: string;
  editBaseUrl?: string;
};
export type BuildResult =
  | { site: Site; diagnostics: Diagnostic[]; directory: string }
  | { site?: undefined; diagnostics: Diagnostic[]; directory?: undefined };

const execute = promisify(execFile);
const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const themeExtensions = new Set([
  ".css",
  ".js",
  ".mjs",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]);

function markdownText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[\\`*_[\]<>]/g, "\\$&");
}

function pageDirectory(route: string): string {
  return route.split("/").filter(Boolean).map(decodeURIComponent).join("/");
}

async function sourceState(root: string): Promise<BuildManifest["source"]> {
  try {
    const options = { cwd: root, encoding: "utf8" as const, timeout: 10_000 };
    const commit = (
      await execute("git", ["rev-parse", "HEAD"], options)
    ).stdout.trim();
    // Git status can execute repository-configured filters. Report unknown
    // cleanliness rather than running author code to enrich public metadata.
    return {
      commit: /^[a-f0-9]{40,64}$/.test(commit) ? commit : null,
      dirty: null,
    };
  } catch {
    return { commit: null, dirty: null };
  }
}

async function outputDirectory(
  options: BuildOptions,
  site: Site,
  root: string,
): Promise<string> {
  const directory = await resolveDestination(
    path.resolve(root, options.outDir ?? "mdd-dist"),
  );
  const mddRoot = await realpath(path.resolve(root, options.mddDir ?? "mdd"));
  const home = site.pages.find((page) => page.route === "/");
  if (!home) throw new Error("The engine did not provide a homepage.");
  const contentRoot = path.dirname(path.resolve(root, home.source));
  // Config is already validated by the engine. Read only the optional theme path
  // to protect unselected themes as well as the selected theme from replacement.
  const configText = await readFile(
    path.join(mddRoot, "config.json"),
    "utf8",
  ).catch((error) => {
    if (isMissing(error)) return "{}";
    throw error;
  });
  const config = JSON.parse(configText) as { paths?: { themes?: string } };
  const themesRoot = await resolveDestination(
    path.resolve(mddRoot, config.paths?.themes ?? "themes"),
  );
  const protectedRoots = [mddRoot, contentRoot, themesRoot];
  if (
    isWithin(directory, root) ||
    protectedRoots.some(
      (input) => isWithin(input, directory) || isWithin(directory, input),
    )
  ) {
    throw new Error(
      `Output must be separate from the project root and documentation inputs: ${directory}`,
    );
  }
  if (
    path
      .relative(root, directory)
      .split(path.sep)
      .filter((part) => part !== "..")
      .some(protectedName)
  ) {
    throw new Error(
      `Output cannot use a hidden or sensitive directory: ${directory}`,
    );
  }
  return directory;
}

/** Compile into portable files without executing code from the documentation checkout. */
export async function build(options: BuildOptions): Promise<BuildResult> {
  const editBaseUrl =
    options.editBaseUrl === undefined
      ? undefined
      : normalizeEditBaseUrl(options.editBaseUrl);
  const compiled = await compileProject(options);
  if (!compiled.site) return compiled;
  const { site, diagnostics } = compiled;
  if (!isBasePath(site.basePath))
    throw new Error(
      "Unsupported public base path. Use a canonical URL prefix without control characters.",
    );
  const root = await realpath(options.projectDir);
  const directory = await outputDirectory(options, site, root);
  const metadata = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8"),
  ) as { version: string };
  const identity = {
    mddVersion: metadata.version,
    theme: await readDThemeIdentity(options.theme),
    customTheme:
      "directory" in site.theme
        ? await readCustomThemeIdentity(root, site.theme)
        : undefined,
  };
  const files = new Map<string, Buffer>();
  const reserved = new Set<string>();
  const directories = new Map<string, string>();
  function add(name: string, contents: string | Buffer): void {
    const parts = name.split("/");
    if (
      parts.some(
        (part) =>
          !part ||
          part === "." ||
          part === ".." ||
          part.includes("\\") ||
          protectedName(part),
      )
    ) {
      throw new Error(`Unsafe generated path: ${name}`);
    }
    const key = name.normalize("NFC").toLowerCase();
    if (reserved.has(key) || directories.has(key)) {
      throw new Error(`Generated output paths collide: ${name}`);
    }
    for (let count = 1; count < parts.length; count++) {
      const parent = parts.slice(0, count).join("/");
      const parentKey = parent.normalize("NFC").toLowerCase();
      const existing = directories.get(parentKey);
      if (
        reserved.has(parentKey) ||
        (existing !== undefined && existing !== parent)
      ) {
        throw new Error(`Generated output paths collide: ${name}`);
      }
      directories.set(parentKey, parent);
    }
    reserved.add(key);
    files.set(
      name,
      Buffer.isBuffer(contents) ? contents : Buffer.from(contents),
    );
  }
  for (const page of site.pages) {
    const route = pageDirectory(page.route);
    add(
      route ? `${route}/index.html` : "index.html",
      renderPage(site, page, identity, editBaseUrl),
    );
    add(`markdown/${route ? `${route}/` : ""}index.md`, page.markdown);
  }
  add("404.html", renderNotFound(site, identity));
  add(
    "llms.txt",
    `# ${markdownText(site.title)}\n\n## Documentation\n\n${site.pages.map((page) => `- [${markdownText(page.title)}](<${site.basePath}markdown/${page.route.slice(1)}index.md>)${page.description ? `: ${markdownText(page.description)}` : ""}`).join("\n")}\n`,
  );
  for (const asset of site.assets)
    add(asset.destination, await readSafeFile(root, asset.source));
  add("_mdd/reader.css", await readSafeFile(dThemeDirectory, "theme.css"));
  add("_mdd/reader.js", await readSafeFile(packageRoot, "assets/reader.js"));
  add("_mdd/search-index.json", `${JSON.stringify(createSearchIndex(site))}\n`);
  add(
    "_mdd/search-ui.js",
    await readSafeFile(packageRoot, "assets/search-ui.js"),
  );
  // The published search entry is a self-contained browser module. Keep its
  // ranking and schema validation identical to the engine that built the index.
  add(
    "_mdd/search.js",
    await readFile(
      fileURLToPath(import.meta.resolve("@wgtechlabs/mdd-engine/search")),
    ),
  );
  if ("directory" in site.theme) {
    const themeRoot = path.resolve(root, site.theme.directory);
    const tree = await listTree(themeRoot);
    for (const name of [...tree.directories, ...tree.files]) {
      if (name.split("/").some(protectedName))
        throw new Error(
          `Selected theme contains a hidden or sensitive path: ${name}`,
        );
    }
    for (const name of tree.files) {
      if (themeExtensions.has(path.extname(name).toLowerCase()))
        add(`_mdd/theme/${name}`, await readSafeFile(themeRoot, name));
    }
  }
  const engineMetadata = JSON.parse(
    await readFile(
      fileURLToPath(
        new URL(
          "../package.json",
          import.meta.resolve("@wgtechlabs/mdd-engine"),
        ),
      ),
      "utf8",
    ),
  ) as { version: string };
  const manifest: BuildManifest = {
    schemaVersion: 1,
    mddVersion: metadata.version,
    engineVersion: engineMetadata.version,
    basePath: site.basePath,
    source: await sourceState(root),
  };
  add("mdd-build.json", `${JSON.stringify(manifest, null, 2)}\n`);
  await writeOutput(directory, files);
  return { site, diagnostics, directory };
}
