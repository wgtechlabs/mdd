import { fileURLToPath } from "node:url";
import type { Site } from "@wgtechlabs/mdd-engine";
import { isMissing, readSafeFile } from "./files.js";

export interface ThemeIdentity {
  name: string;
  version: string | null;
  release?: string;
}

export const dThemeDirectory = fileURLToPath(
  new URL("../themes/d/", import.meta.url),
);

/** The bundled theme has a stable ID and its own version, independent of MDD. */
export async function readDThemeIdentity(id = "d"): Promise<ThemeIdentity> {
  if (id !== "d")
    throw new Error(`Unknown bundled theme: ${id}. Use --theme d.`);
  const identity = await readMetadata(dThemeDirectory, "theme.json");
  if (!identity?.release)
    throw new Error(
      "D Theme requires theme.json with name, version, and release.",
    );
  return identity;
}

/** Custom styling is selected by the engine and layered over D Theme. */
export async function readCustomThemeIdentity(
  projectDir: string,
  theme: Extract<Site["theme"], { directory: string }>,
): Promise<ThemeIdentity> {
  return (
    (await readMetadata(projectDir, `${theme.directory}/theme.json`)) ?? {
      name: theme.name,
      version: null,
    }
  );
}

async function readMetadata(
  root: string,
  source: string,
): Promise<ThemeIdentity | undefined> {
  const contents = await readSafeFile(root, source).catch((error) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (!contents) return undefined;

  let value: unknown;
  try {
    value = JSON.parse(contents.toString("utf8"));
  } catch {
    throw new Error(
      `Invalid theme metadata in ${source}: expected valid JSON.`,
    );
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => key !== "name" && key !== "version" && key !== "release",
    ) ||
    !("name" in value) ||
    !isLabel(value.name) ||
    !("version" in value) ||
    !isLabel(value.version) ||
    ("release" in value && !isLabel(value.release))
  ) {
    throw new Error(
      `Invalid theme metadata in ${source}: provide name and version, with an optional release; each must be a non-empty single-line string of at most 128 characters without surrounding whitespace. No other fields are supported.`,
    );
  }
  return {
    name: value.name,
    version: value.version,
    ...("release" in value && typeof value.release === "string"
      ? { release: value.release }
      : {}),
  };
}

function isLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
  );
}
