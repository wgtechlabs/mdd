import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const reader = readFileSync(
  new URL("../assets/reader.js", import.meta.url),
  "utf8",
);

const folderKey = (site: string, route: string) =>
  JSON.stringify([site, route]);

class Disclosure extends EventTarget {
  readonly dataset: { mddNavKey: string };
  #open = true;

  constructor(
    key: string,
    private pending: Set<Disclosure>,
  ) {
    super();
    this.dataset = { mddNavKey: key };
    // Native details queue an initial toggle when parsed with `open`.
    pending.add(this);
  }

  get open(): boolean {
    return this.#open;
  }

  set open(value: boolean) {
    if (this.#open === value) return;
    this.#open = value;
    this.pending.add(this);
  }
}

function loadReader(
  keys: string[],
  stored = new Map<string, string>(),
  storageUnavailable = false,
) {
  const pending = new Set<Disclosure>();
  const desktop = keys.map((key) => new Disclosure(key, pending));
  const mobile = keys.map((key) => new Disclosure(key, pending));
  runInNewContext(reader, {
    document: {
      documentElement: { dataset: {} },
      querySelector: () => null,
      querySelectorAll: (selector: string) =>
        selector === ".mdd-nav-section[data-mdd-nav-key]"
          ? [...desktop, ...mobile]
          : [],
    },
    window: { matchMedia: () => ({ matches: false }) },
    localStorage: {
      getItem(key: string) {
        if (storageUnavailable) throw new Error("Storage is disabled");
        return stored.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        if (storageUnavailable) throw new Error("Storage is disabled");
        stored.set(key, value);
      },
    },
  });
  const flush = () => {
    let events = 0;
    while (pending.size) {
      if (++events > 100) throw new Error("Disclosure synchronization loop");
      const section = pending.values().next().value;
      if (!section) break;
      pending.delete(section);
      section.dispatchEvent(new Event("toggle"));
    }
  };
  return { desktop, mobile, flush };
}

test("folded sections survive page loads and both navigation copies stay in sync", () => {
  const keys = [
    folderKey("/docs/", "/get-started/"),
    folderKey("/docs/", "/guides/"),
  ];
  const stored = new Map<string, string>();
  const first = loadReader(keys, stored);
  first.flush();
  const guides = first.desktop[1];
  if (!guides) throw new Error("Missing Guides folder");
  guides.open = false;
  first.flush();
  expect(first.mobile[1]?.open).toBe(false);
  expect(first.desktop[0]?.open).toBe(true);

  const nextPage = loadReader(keys, stored);
  expect(nextPage.desktop[1]?.open).toBe(false);
  // Queued parser/restore events must not reopen the other copy.
  nextPage.flush();
  expect(nextPage.mobile[1]?.open).toBe(false);
  expect(nextPage.desktop[0]?.open).toBe(true);
  const mobileGuides = nextPage.mobile[1];
  if (!mobileGuides) throw new Error("Missing mobile Guides folder");
  mobileGuides.open = true;
  nextPage.flush();
  expect(nextPage.desktop[1]?.open).toBe(true);
  expect(loadReader(keys, stored).desktop[1]?.open).toBe(true);
});

test("folder preferences are isolated by site and nested path, and unknown values default open", () => {
  const stored = new Map([
    [`mdd-nav:v1:${folderKey("/docs/", "/guides/")}`, "closed"],
    [`mdd-nav:v1:${folderKey("/docs/", "/guides/advanced/")}`, "closed"],
    [`mdd-nav:v1:${folderKey("/other/", "/guides/")}`, "invalid"],
  ]);
  const menus = loadReader(
    [
      folderKey("/docs/", "/guides/"),
      folderKey("/docs/", "/guides/advanced/"),
      folderKey("/other/", "/guides/"),
      folderKey("/docs/", "/new/"),
      folderKey("/docs/guides/", "/advanced/"),
    ],
    stored,
  );
  menus.flush();
  expect(menus.desktop.map((section) => section.open)).toEqual([
    false,
    false,
    true,
    true,
    true,
  ]);
  const parent = menus.mobile[0];
  if (!parent) throw new Error("Missing parent group");
  parent.open = true;
  menus.flush();
  expect(menus.desktop[0]?.open).toBe(true);
  expect(menus.desktop[1]?.open).toBe(false);
});

test("native toggles keep working and coalesce correctly when storage is unavailable", () => {
  const menus = loadReader([folderKey("/docs/", "/guides/")], new Map(), true);
  const desktop = menus.desktop[0];
  const mobile = menus.mobile[0];
  if (!desktop || !mobile) throw new Error("Missing menus");
  desktop.open = false;
  menus.flush();
  expect(mobile.open).toBe(false);
  mobile.open = true;
  mobile.open = false;
  mobile.open = true;
  menus.flush();
  expect(desktop.open).toBe(true);
});
