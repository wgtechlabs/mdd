import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import {
  assertRepositoryRef,
  normalizeCommitSha,
  parseRepositoryUrl,
} from "./content-fetch.js";
import { isWithin } from "./files.js";

const inflate = promisify(gunzip);
const block = 512;
const shaPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;

/** Download limits keep a hostile or oversized repository from exhausting the container. */
export const archiveLimits = {
  compressedBytes: 100 * 1024 * 1024,
  extractedBytes: 512 * 1024 * 1024,
  entries: 50_000,
};

export type ArchiveResponse =
  | { status: "ok"; body: Uint8Array }
  | { status: "missing" };

/** Fetch one archive URL. Tests replace this; production uses HTTPS fetch. */
export type ArchiveDownloader = (url: string) => Promise<ArchiveResponse>;

export interface DownloadArchiveOptions {
  repoUrl: string;
  repoRef?: string;
  sourceSha?: string;
  destination: string;
  download?: ArchiveDownloader;
}

export interface DownloadedContent {
  commit: string;
  projectDir: string;
}

/** Build the codeload URL for a commit, branch, tag, or the default branch. */
export function archiveUrl(repoUrl: string, target: string): string {
  const [owner, repository] = new URL(parseRepositoryUrl(repoUrl)).pathname
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);
  const encoded = target.split("/").map(encodeURIComponent).join("/");
  return `https://codeload.github.com/${owner}/${repository}/tar.gz/${encoded}`;
}

export const downloadArchive: ArchiveDownloader = async (url) => {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(180_000),
  });
  if (response.status === 404) return { status: "missing" };
  if (!response.ok || !response.body) {
    throw new Error(`Content download failed with HTTP ${response.status}.`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > archiveLimits.compressedBytes) throw tooLarge();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > archiveLimits.compressedBytes) throw tooLarge();
    chunks.push(chunk);
  }
  return { status: "ok", body: Buffer.concat(chunks) };
};

function tooLarge(): Error {
  return new Error("The content repository archive is too large.");
}

function text(header: Buffer, start: number, length: number): string {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? length : end).toString("utf8");
}

function octal(header: Buffer, start: number, length: number): number {
  const raw = text(header, start, length).trim();
  if (!/^[0-7]*$/.test(raw)) throw invalidArchive();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function invalidArchive(): Error {
  return new Error("The content repository archive is invalid.");
}

function validChecksum(header: Buffer): boolean {
  let sum = 0;
  for (let index = 0; index < block; index += 1) {
    sum += index >= 148 && index < 156 ? 32 : (header[index] ?? 0);
  }
  return sum === octal(header, 148, 8);
}

function paxRecords(data: Buffer): Map<string, string> {
  const records = new Map<string, string>();
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(32, offset);
    if (space === -1) throw invalidArchive();
    const length = Number(data.subarray(offset, space).toString("ascii"));
    if (!Number.isInteger(length) || length <= space - offset) {
      throw invalidArchive();
    }
    const record = data.subarray(space + 1, offset + length - 1).toString();
    const equals = record.indexOf("=");
    if (equals === -1) throw invalidArchive();
    records.set(record.slice(0, equals), record.slice(equals + 1));
    offset += length;
  }
  return records;
}

/** Drop the archive's top folder and refuse any path that can leave the checkout. */
function entryPath(name: string): string | undefined {
  if (name.includes("\0") || name.startsWith("/")) throw unsafeEntry(name);
  const parts = name.split("/").filter((part) => part && part !== ".");
  if (parts.some((part) => part === "..")) throw unsafeEntry(name);
  return parts.length > 1 ? parts.slice(1).join("/") : undefined;
}

function unsafeEntry(name: string): Error {
  return new Error(
    `The content repository archive has an unsafe path: ${JSON.stringify(name.slice(0, 200))}.`,
  );
}

type ArchiveEntry =
  | { kind: "global"; records: Map<string, string> }
  | { kind: "file" | "directory" | "other"; name: string; data: Buffer };

/** Walk the ustar/pax entries of an uncompressed archive. */
function* readEntries(tar: Buffer): Generator<ArchiveEntry> {
  let offset = 0;
  let entries = 0;
  let nextPath: string | undefined;
  while (offset + block <= tar.length) {
    const header = tar.subarray(offset, offset + block);
    if (header.every((byte) => byte === 0)) return;
    if (!validChecksum(header)) throw invalidArchive();
    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] ?? 0);
    const dataStart = offset + block;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw invalidArchive();
    const data = tar.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / block) * block;
    entries += 1;
    if (entries > archiveLimits.entries) {
      throw new Error("The content repository archive has too many files.");
    }
    if (type === "g") {
      yield { kind: "global", records: paxRecords(data) };
      continue;
    }
    if (type === "x") {
      nextPath = paxRecords(data).get("path") ?? nextPath;
      continue;
    }
    if (type === "L") {
      nextPath = text(data, 0, data.length);
      continue;
    }
    const prefix = text(header, 345, 155);
    const name =
      nextPath ??
      (prefix ? `${prefix}/${text(header, 0, 100)}` : text(header, 0, 100));
    nextPath = undefined;
    const kind =
      type === "5"
        ? "directory"
        : type === "0" || type === "\0" || type === "7"
          ? "file"
          : "other";
    yield { kind, name, data };
  }
  throw invalidArchive();
}

/** Read the commit SHA that GitHub and `git archive` record in the global header. */
export function archiveCommit(tar: Buffer): string | undefined {
  for (const entry of readEntries(tar)) {
    if (entry.kind !== "global") return undefined;
    const comment = entry.records.get("comment")?.trim().toLowerCase();
    if (comment) return comment;
  }
  return undefined;
}

/**
 * Extract regular files and folders only. Links, devices, and other entries are
 * skipped, so nothing in the archive can point outside the checkout.
 */
export async function extractArchive(
  tar: Buffer,
  destination: string,
): Promise<{ skipped: number }> {
  const root = await realpath(destination);
  let skipped = 0;
  for (const entry of readEntries(tar)) {
    if (entry.kind === "global") continue;
    const relative = entryPath(entry.name);
    if (!relative) continue;
    const target = path.resolve(root, relative);
    if (!isWithin(root, target)) throw unsafeEntry(entry.name);
    if (entry.kind === "directory") {
      await mkdir(target, { recursive: true, mode: 0o755 });
    } else if (entry.kind === "file") {
      await mkdir(path.dirname(target), { recursive: true, mode: 0o755 });
      await writeFile(target, entry.data, { flag: "wx", mode: 0o644 });
    } else {
      skipped += 1;
    }
  }
  return { skipped };
}

/**
 * Download a public GitHub repository as a tarball, without Git. A requested
 * SHA must match the commit GitHub reports in the archive, or nothing is used.
 */
export async function downloadContentRepository(
  options: DownloadArchiveOptions,
): Promise<DownloadedContent> {
  const sha = options.sourceSha?.trim()
    ? normalizeCommitSha(options.sourceSha)
    : undefined;
  const ref = options.repoRef?.trim()
    ? assertRepositoryRef(options.repoRef)
    : undefined;
  const target = sha ?? ref ?? "HEAD";
  const url = archiveUrl(options.repoUrl, target);
  const download = options.download ?? downloadArchive;
  const response = await download(url);
  if (response.status === "missing") {
    throw new Error(
      sha
        ? `Content commit ${sha} is unavailable. Refusing to fall back to branch HEAD.`
        : `The content repository or ${ref ? `ref ${ref}` : "its default branch"} was not found. Check MDD_REPO_URL and MDD_REPO_REF; the repository must be public.`,
    );
  }
  let tar: Buffer;
  try {
    tar = await inflate(response.body, {
      maxOutputLength: archiveLimits.extractedBytes,
    });
  } catch (error) {
    if (error instanceof RangeError) throw tooLarge();
    throw invalidArchive();
  }
  // Check the reported commit before writing any file.
  const commit = archiveCommit(tar);
  if (!commit || !shaPattern.test(commit)) {
    throw new Error("The content repository archive did not report a commit.");
  }
  if (sha && commit !== sha) {
    throw new Error(
      `Fetched commit ${commit} does not match ${sha}. Refusing to publish.`,
    );
  }
  const reported = await extractArchive(tar, options.destination);
  if (reported.skipped > 0) {
    console.log(
      `Skipped ${reported.skipped} link or special entries in the content repository.`,
    );
  }
  return { commit, projectDir: await realpath(options.destination) };
}
