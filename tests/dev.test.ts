import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("dev catches edits made before new input watchers attach", () => {
  // Run the compiled preview under Node, isolating the watcher replacement.
  // Files, builds, and HTTP serving remain real; events are delivered manually.
  const result = spawnSync(
    "node",
    [
      "--input-type=module",
      "--eval",
      `
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const listeners = new Map();
fs.watch = (directory, options, listener) => {
  if (typeof options === "function") listener = options;
  listeners.set(directory, listener);
  const watcher = new EventEmitter();
  watcher.close = () => {
    if (listeners.get(directory) === listener) listeners.delete(directory);
  };
  return watcher;
};
syncBuiltinESMExports();
const { dev } = await import(${JSON.stringify(new URL("../dist/dev.js", import.meta.url).href)});
const root = await mkdtemp(join(tmpdir(), "mdd-watch-transition-"));
let preview;
let initial = true;
let errorCount = 0;
let recovered = false;
const messages = [];
async function until(check, stage) {
  const deadline = Date.now() + 4000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(stage + ": " + JSON.stringify({ errorCount, messages }));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
try {
  const content = join(root, "mdd/contents");
  const replacement = join(root, "replacement");
  await mkdir(content, { recursive: true });
  await mkdir(replacement);
  await writeFile(join(content, "index.md"), "# Original\\n");
  await writeFile(join(replacement, "index.md"), "# Replacement\\n");
  preview = await dev({ projectDir: root, port: 0, host: "127.0.0.1" }, {
    diagnostics(diagnostics) {
      if (initial) {
        initial = false;
        fs.writeFileSync(join(content, "early.md"), "# Initial edit\\n");
      } else if (diagnostics.some(item => item.severity === "error")) {
        errorCount++;
      } else if (errorCount && !recovered) {
        recovered = true;
        fs.writeFileSync(join(replacement, "next.md"), "# New page\\n\\n[Missing](missing.md)\\n");
      }
    },
    message: message => messages.push(message),
    error: error => { throw error; },
  });
  const origin = messages.find(message => message.startsWith("Preview on ")).match(/http:\\/\\/127\\.0\\.0\\.1:\\d+/)[0];
  async function read(route) {
    const response = await fetch(origin + route, { signal: AbortSignal.timeout(1000) });
    const body = await response.text();
    return { status: response.status, body };
  }
  async function hasPage(route) {
    try { return (await read(route)).status === 200; }
    catch { return false; }
  }
  assert.equal((await read("/early/")).status, 200);
  await writeFile(join(content, "index.md"), "# Broken\\n\\n[Missing](missing.md)\\n");
  listeners.get(content)("change", "index.md");
  await until(() => errorCount === 1, "Invalid content was not reported");
  await writeFile(join(root, "mdd/config.json"), JSON.stringify({ paths: { contents: "../replacement" } }));
  listeners.get(join(root, "mdd"))("change", "config.json");
  await until(() => errorCount === 2, "Invalid catch-up was not reported");
  assert.equal((await read("/healthz")).status, 200);
  assert.ok((await read("/")).body.includes("Replacement"));
  await writeFile(join(replacement, "next.md"), "# New page\\n");
  listeners.get(replacement)("change", "next.md");
  await until(() => hasPage("/next/"), "Repaired content was not served");
  assert.equal(recovered, true);
} finally {
  if (preview) await preview.close();
  await rm(root, { recursive: true, force: true });
}
`,
    ],
    { encoding: "utf8", timeout: 12_000 },
  );
  expect(result.status, result.stderr || String(result.error)).toBe(0);
}, 15_000);

test("dev replaces the served inventory even with an unfinished HTTP request", () => {
  const result = spawnSync(
    "node",
    [
      "--input-type=module",
      "--eval",
      `
import http from "node:http";
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
let received;
const requestStarted = new Promise(resolve => { received = resolve; });
const createServer = http.createServer;
http.createServer = (...args) => {
  const server = createServer(...args);
  server.on("connection", socket => socket.once("data", received));
  return server;
};
syncBuiltinESMExports();
const { dev } = await import(${JSON.stringify(new URL("../dist/dev.js", import.meta.url).href)});
const root = await mkdtemp(join(tmpdir(), "mdd-preview-active-request-"));
const messages = [];
let preview;
let client;
try {
  const content = join(root, "mdd/contents");
  await mkdir(content, { recursive: true });
  await writeFile(join(content, "index.md"), "# Home\\n");
  preview = await dev({ projectDir: root, port: 0, host: "127.0.0.1" }, {
    diagnostics: items => assert.equal(items.length, 0),
    message: message => messages.push(message),
    error: error => { throw error; },
  });
  const origin = messages.find(message => message.startsWith("Preview on ")).match(/http:\\/\\/127\\.0\\.0\\.1:\\d+/)[0];
  client = net.createConnection(Number(new URL(origin).port), "127.0.0.1");
  client.on("error", () => {});
  await new Promise(resolve => client.once("connect", resolve));
  // A connected client with incomplete headers is active, not an idle socket.
  client.write("GET / HTTP/1.1\\r\\nHost: localhost\\r\\n");
  await requestStarted;
  await writeFile(join(content, "next.md"), "# New inventory\\n");
  const deadline = Date.now() + 4000;
  while (!messages.some(message => message.startsWith("Rebuilt 2 "))) {
    if (Date.now() > deadline) throw new Error("An active client blocked the preview restart: " + JSON.stringify(messages));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const response = await fetch(origin + "/next/", { signal: AbortSignal.timeout(1000) });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("New inventory"));
} finally {
  client?.destroy();
  if (preview) await preview.close();
  await rm(root, { recursive: true, force: true });
}
`,
    ],
    { encoding: "utf8", timeout: 8000 },
  );
  expect(result.status, result.stderr || String(result.error)).toBe(0);
}, 10_000);
