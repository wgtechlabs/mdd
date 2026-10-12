import path from "node:path";
import { isMissing, readSafeFile } from "./files.js";

export interface ReaderLink {
  label: string;
  href: string;
}

export interface ReaderConfig {
  header?: {
    links?: ReaderLink[];
    cta?: ReaderLink;
  };
}

function link(value: unknown, name: string): ReaderLink {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must contain a label and HTTPS href.`);
  const item = value as Record<string, unknown>;
  if (
    Object.keys(item).some((key) => key !== "label" && key !== "href") ||
    typeof item.label !== "string" ||
    !item.label.trim() ||
    item.label !== item.label.trim() ||
    /\p{Cc}/u.test(item.label) ||
    item.label.length > 80 ||
    typeof item.href !== "string"
  ) {
    throw new Error(`${name} must contain a non-empty label and HTTPS href.`);
  }
  let url: URL;
  try {
    url = new URL(item.href);
  } catch {
    throw new Error(`${name}.href must be an absolute HTTPS URL.`);
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error(`${name}.href must be an HTTPS URL without credentials.`);
  return { label: item.label, href: item.href };
}

export function validateReaderConfig(value: unknown): ReaderConfig {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("reader.json must contain an object.");
  const config = value as Record<string, unknown>;
  if (Object.keys(config).some((key) => key !== "header"))
    throw new Error("reader.json only supports the header setting.");
  if (config.header === undefined) return {};
  if (
    !config.header ||
    typeof config.header !== "object" ||
    Array.isArray(config.header)
  ) {
    throw new Error("reader.json header must be an object.");
  }
  const header = config.header as Record<string, unknown>;
  if (Object.keys(header).some((key) => key !== "links" && key !== "cta"))
    throw new Error("reader.json header only supports links and cta.");
  if (header.links !== undefined && !Array.isArray(header.links))
    throw new Error("reader.json header.links must be an array.");
  if (Array.isArray(header.links) && header.links.length > 2)
    throw new Error("reader.json header.links supports at most two links.");
  return {
    header: {
      ...(header.links === undefined
        ? {}
        : {
            links: header.links.map((item, index) =>
              link(item, `header.links[${index}]`),
            ),
          }),
      ...(header.cta === undefined
        ? {}
        : { cta: link(header.cta, "header.cta") }),
    },
  };
}

export async function readReaderConfig(
  projectDir: string,
  mddDir = "mdd",
): Promise<ReaderConfig> {
  const root = path.resolve(projectDir);
  const directory = path.resolve(root, mddDir);
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("MDD reader configuration must be inside the project.");
  let contents: Buffer;
  try {
    contents = await readSafeFile(
      root,
      path.posix.join(relative.split(path.sep).join("/"), "reader.json"),
    );
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents.toString("utf8"));
  } catch {
    throw new Error("reader.json must contain valid JSON.");
  }
  return validateReaderConfig(parsed);
}
