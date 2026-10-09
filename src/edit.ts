/** The prefix includes the repository, edit route, branch, and project subdirectory. */
export function normalizeEditBaseUrl(value: string): string {
  const invalid = () =>
    new Error(
      "Edit base URL must be an absolute HTTPS URL without credentials, query, fragment, whitespace, or backslashes.",
    );
  if (!/^https:\/\//i.test(value) || /[\s\p{Cc}\p{Cf}\\]/u.test(value))
    throw invalid();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    value.includes("?") ||
    value.includes("#")
  )
    throw invalid();
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

/** Source paths are literal filenames from the engine, not page routes or URLs. */
export function editPageUrl(baseUrl: string, source: string): string {
  const segments = source.split("/");
  if (
    /[\p{Cc}\p{Cf}\\]/u.test(source) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  )
    throw new Error(
      "Edit source must be a relative file path without traversal.",
    );
  return (
    normalizeEditBaseUrl(baseUrl) + segments.map(encodeURIComponent).join("/")
  );
}
