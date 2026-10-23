import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";
import type { BuildManifest } from "./manifest.js";
import type { FeedbackPlugin, FeedbackVote } from "./plugins/feedback.js";

export const feedbackPath = "/api/mdd/plugins/feedback";
const maxBodyBytes = 1024;
const windowMs = 60_000;
const maxSummariesPerWindow = 120;
const maxVotesPerWindow = 30;
const maxRateLimitEntries = 10_000;

function respondJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  const contents = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Length": Buffer.byteLength(contents),
  });
  response.end(contents);
}

function pageRoute(
  input: unknown,
  prefix: string,
  files: Map<string, string>,
): string | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  const rawPath = input.split("?")[0] ?? "";
  if (
    !rawPath.startsWith("/") ||
    rawPath.includes("#") ||
    rawPath.includes("//")
  )
    return null;
  let pathname: string;
  try {
    const parts = rawPath.split("/").map(decodeURIComponent);
    if (
      parts.some(
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
      return null;
    pathname = parts.join("/");
  } catch {
    return null;
  }
  if (!pathname.startsWith(prefix)) return null;
  const relativePath = pathname.slice(prefix.length);
  if (relativePath !== "" && !relativePath.endsWith("/")) return null;
  const filename = relativePath ? `${relativePath}index.html` : "index.html";
  if (!files.has(filename)) return null;
  return `${pathname.split("/").map(encodeURIComponent).join("/")}`;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const declaredSize = Number(request.headers["content-length"] ?? 0);
  if (declaredSize > maxBodyBytes) throw new Error("too-large");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error("too-large");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("invalid-json");
  }
}

function clientRateKey(request: IncomingMessage): string | null {
  if (process.env.MDD_TRUST_PROXY === "true") {
    const forwarded = request.headers["x-real-ip"];
    if (typeof forwarded === "string" && isIP(forwarded)) return forwarded;
  }
  const address = request.socket.remoteAddress;
  return address && isIP(address) ? address : null;
}

function requestHost(request: IncomingMessage): string | undefined {
  if (process.env.MDD_TRUST_PROXY === "true") {
    const forwarded = request.headers["x-forwarded-host"];
    if (typeof forwarded === "string" && !forwarded.includes(",")) {
      return forwarded.trim();
    }
  }
  return request.headers.host;
}

/** Handle only the public feedback routes; plugin storage stays in-process. */
export function createFeedbackApi(
  plugin: FeedbackPlugin | null,
  files: Map<string, string>,
  manifest: BuildManifest,
) {
  const prefix = decodeURIComponent(manifest.basePath);
  const rateLimits = new Map<string, { started: number; count: number }>();
  function consumeRateLimit(client: string, scope: string, maximum: number) {
    const now = Date.now();
    if (rateLimits.size > maxRateLimitEntries / 2) {
      for (const [key, limit] of rateLimits) {
        if (now - limit.started >= windowMs) rateLimits.delete(key);
      }
    }
    const key = `${scope}:${client}`;
    const current = rateLimits.get(key);
    if (current && now - current.started < windowMs) {
      if (current.count >= maximum) return false;
      current.count++;
    } else {
      if (rateLimits.size >= maxRateLimitEntries) return false;
      rateLimits.set(key, { started: now, count: 1 });
    }
    return true;
  }

  return async function handleFeedbackApi(
    request: IncomingMessage,
    response: ServerResponse,
    pathname: string | null,
  ): Promise<boolean> {
    if (pathname !== feedbackPath) return false;
    if (!plugin) {
      respondJson(response, 404, { error: "Feedback is disabled." });
      return true;
    }
    if (request.method === "GET") {
      const url = new URL(request.url ?? "/", "http://mdd.local");
      const page = pageRoute(url.searchParams.get("page"), prefix, files);
      if (!page) {
        respondJson(response, 400, { error: "Invalid documentation page." });
        return true;
      }
      const client = clientRateKey(request);
      if (
        !client ||
        !consumeRateLimit(client, "summary", maxSummariesPerWindow)
      ) {
        respondJson(response, 429, { error: "Feedback rate limit reached." });
        return true;
      }
      try {
        respondJson(response, 200, await plugin.summary(page));
      } catch {
        respondJson(response, 503, {
          error: "Feedback is temporarily unavailable.",
        });
      }
      return true;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "GET, POST");
      respondJson(response, 405, { error: "Method not allowed." });
      return true;
    }
    const host = requestHost(request);
    const origin = request.headers.origin;
    try {
      const parsedOrigin = origin ? new URL(origin) : null;
      if (
        !host ||
        !parsedOrigin ||
        !["http:", "https:"].includes(parsedOrigin.protocol) ||
        parsedOrigin.username ||
        parsedOrigin.password ||
        parsedOrigin.host.toLowerCase() !== host.toLowerCase()
      ) {
        respondJson(response, 403, { error: "Invalid request origin." });
        return true;
      }
    } catch {
      respondJson(response, 403, { error: "Invalid request origin." });
      return true;
    }
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers["content-type"] ?? "",
      )
    ) {
      respondJson(response, 415, { error: "Expected JSON." });
      return true;
    }
    const client = clientRateKey(request);
    if (!client || !consumeRateLimit(client, "vote", maxVotesPerWindow)) {
      respondJson(response, 429, { error: "Feedback rate limit reached." });
      return true;
    }
    let body: unknown;
    try {
      body = await readBody(request);
    } catch (error) {
      respondJson(
        response,
        error instanceof Error && error.message === "too-large" ? 413 : 400,
        { error: "Invalid feedback request." },
      );
      return true;
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => !["page", "vote"].includes(key))
    ) {
      respondJson(response, 400, { error: "Invalid feedback request." });
      return true;
    }
    const input = body as { page?: unknown; vote?: unknown };
    const page = pageRoute(input.page, prefix, files);
    const vote: FeedbackVote | null =
      input.vote === "yes" || input.vote === "no" ? input.vote : null;
    if (!page || !vote) {
      respondJson(response, 400, { error: "Invalid feedback request." });
      return true;
    }
    try {
      await plugin.submit(page, vote);
      respondJson(response, 201, { saved: true });
    } catch {
      respondJson(response, 503, {
        error: "Feedback is temporarily unavailable.",
      });
    }
    return true;
  };
}
