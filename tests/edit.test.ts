import { expect, test } from "bun:test";
import { editPageUrl, normalizeEditBaseUrl } from "../src/edit.js";

test("edit prefixes accept HTTPS providers and keep an encoded branch or repository subdirectory", () => {
  for (const prefix of [
    "https://github.com/example/docs/edit/main",
    "https://git.example.test/group/docs/-/edit/feature%2Fdocs/site/",
  ]) {
    expect(normalizeEditBaseUrl(prefix)).toBe(
      prefix.endsWith("/") ? prefix : `${prefix}/`,
    );
  }
});

test("edit prefixes reject unsafe or ambiguous destinations", () => {
  for (const prefix of [
    "",
    "/edit/main/",
    "//github.com/example/docs/edit/main/",
    "https:github.com/example/docs/edit/main/",
    "http://github.com/example/docs/edit/main/",
    "javascript:alert(1)",
    "data:text/html,edit",
    "https://user:password@github.com/example/docs/edit/main/",
    "https://github.com/example/docs/edit/main/?token=secret",
    "https://github.com/example/docs/edit/main/#section",
    " https://github.com/example/docs/edit/main/",
    "https://github.com/example/docs/edit/main/ ",
    "https://github.com/example/docs/edit/my branch/",
    "https://github.com/example/docs/edit/main/\n",
    "https://github.com/example/docs/edit/main/\u007f",
    "https://github.com\\example/docs/edit/main/",
  ]) {
    expect(() => normalizeEditBaseUrl(prefix), prefix).toThrow();
  }
});

test("edit links encode literal source segments without decoding reserved filename characters", () => {
  const prefix = "https://github.com/example/docs/edit/feature%2Fdocs/site/";
  expect(editPageUrl(prefix, "documentation/articles/01-guide/index.md")).toBe(
    `${prefix}documentation/articles/01-guide/index.md`,
  );
  expect(editPageUrl(prefix, "documentation/articles/café ?#%25.md")).toBe(
    `${prefix}documentation/articles/caf%C3%A9%20%3F%23%2525.md`,
  );
});

test("edit links reject paths that could leave or reinterpret the configured repository prefix", () => {
  const prefix = "https://github.com/example/docs/edit/main/";
  for (const source of [
    "",
    "/mdd/contents/index.md",
    "../index.md",
    "mdd/../index.md",
    "mdd/./index.md",
    "mdd//index.md",
    "mdd/contents/",
    "mdd\\contents\\index.md",
    "mdd/contents/line\nbreak.md",
    "mdd/contents/null\0byte.md",
    "mdd/contents/name\u202e.md",
  ]) {
    expect(() => editPageUrl(prefix, source), source).toThrow();
  }
});
