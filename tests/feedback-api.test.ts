import { afterEach, expect, test } from "bun:test";
import { createServer, type Server } from "node:http";
import { createFeedbackApi, feedbackPath } from "../src/feedback-api.js";
import type { BuildManifest } from "../src/manifest.js";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

test("limits public summaries independently at a higher budget than votes", async () => {
  let summaries = 0;
  const handleFeedbackApi = createFeedbackApi(
    {
      async submit() {},
      async summary() {
        summaries++;
        return { helpfulPercentage: 100 };
      },
    },
    new Map([["index.html", ""]]),
    {
      schemaVersion: 1,
      mddVersion: "0.1.0",
      engineVersion: "0.1.0",
      basePath: "/",
      source: { commit: null, dirty: true },
    } satisfies BuildManifest,
  );
  const server = createServer(async (request, response) => {
    await handleFeedbackApi(request, response, feedbackPath);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected an HTTP listening port.");

  const statuses: number[] = [];
  for (let request = 0; request < 121; request++) {
    const response = await fetch(
      `http://127.0.0.1:${address.port}${feedbackPath}?page=%2F`,
    );
    statuses.push(response.status);
    await response.arrayBuffer();
  }

  expect(statuses.slice(0, 120).every((status) => status === 200)).toBe(true);
  expect(statuses[120]).toBe(429);
  expect(summaries).toBe(120);
});
