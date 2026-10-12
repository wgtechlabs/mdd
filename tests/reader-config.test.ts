import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readReaderConfig,
  validateReaderConfig,
} from "../src/reader-config.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("validates configurable header links and CTA as HTTPS destinations", () => {
  expect(
    validateReaderConfig({
      header: {
        links: [
          { label: "Sponsor", href: "https://github.com/sponsors/wgtechlabs" },
          { label: "Contribute", href: "https://github.com/wgtechlabs/mdd" },
        ],
        cta: { label: "Explore themes", href: "https://wgtechlabs.com/mdd" },
      },
    }),
  ).toEqual({
    header: {
      links: [
        { label: "Sponsor", href: "https://github.com/sponsors/wgtechlabs" },
        { label: "Contribute", href: "https://github.com/wgtechlabs/mdd" },
      ],
      cta: { label: "Explore themes", href: "https://wgtechlabs.com/mdd" },
    },
  });
});

test("rejects unsafe destinations, malformed links, and unsupported settings", () => {
  for (const config of [
    { header: { cta: { label: "unsafe", href: "javascript:alert(1)" } } },
    {
      header: {
        cta: { label: "credentials", href: "https://user:pass@example.com" },
      },
    },
    {
      header: {
        links: Array(3).fill({
          label: "Too many",
          href: "https://example.com",
        }),
      },
    },
    { header: { cta: { label: "  trim me ", href: "https://example.com" } } },
    { header: { cta: { label: "two\nlines", href: "https://example.com" } } },
    { unsupported: true },
  ]) {
    expect(() => validateReaderConfig(config)).toThrow();
  }
});

test("reads optional reader settings safely from the MDD directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "mdd-reader-config-"));
  roots.push(root);
  await mkdir(path.join(root, "mdd"));
  expect(await readReaderConfig(root)).toEqual({});
  await writeFile(
    path.join(root, "mdd/reader.json"),
    JSON.stringify({
      header: { cta: { label: "Theme", href: "https://wgtechlabs.com/mdd" } },
    }),
  );
  expect(await readReaderConfig(root)).toEqual({
    header: { cta: { label: "Theme", href: "https://wgtechlabs.com/mdd" } },
  });
});
