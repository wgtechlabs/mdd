/** Public metadata only: never include local paths, environment values, or credentials. */
export interface BuildManifest {
  schemaVersion: 1;
  mddVersion: string;
  engineVersion: string;
  basePath: string;
  source: {
    commit: string | null;
    dirty: boolean | null;
  };
}

/** Canonical public prefixes must also be safe request paths for the static server. */
export function isBasePath(value: string): boolean {
  if (!value.startsWith("/") || !value.endsWith("/") || value.includes("//"))
    return false;
  try {
    const segments = value.split("/").map(decodeURIComponent);
    if (
      segments.some(
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
      return false;
    return segments.map(encodeURIComponent).join("/") === value;
  } catch {
    return false;
  }
}
