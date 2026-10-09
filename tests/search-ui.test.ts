import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  type SearchIndex,
  search,
  validateSearchIndex,
} from "@wgtechlabs/mdd-engine/search";

// Run the actual browser module with its real engine imports and a small DOM.
const script = readFileSync(
  new URL("../assets/search-ui.js", import.meta.url),
  "utf8",
).replace(/^import[^\n]*\n/, "");

class TestDocument extends EventTarget {
  activeElement?: TestElement;
  elements = new Map<string, TestElement>();
  querySelector(selector: string) {
    return this.elements.get(selector) ?? null;
  }
  createElement(tag: string) {
    return new TestElement(this, tag);
  }
  createTextNode(text: string) {
    const node = this.createElement("#text");
    node.textContent = text;
    return node;
  }
}

class TestElement extends EventTarget {
  className = "";
  value = "";
  href = "";
  hidden = false;
  isConnected = true;
  selected = false;
  dataset: Record<string, string> = {};
  children: TestElement[] = [];
  attributes = new Map<string, string>();
  #text = "";
  constructor(
    readonly document: TestDocument,
    readonly tag: string,
  ) {
    super();
  }
  set textContent(value: string) {
    this.#text = value;
    this.children = [];
  }
  get textContent(): string {
    return (
      this.#text + this.children.map((child) => child.textContent).join("")
    );
  }
  set innerHTML(_value: string) {
    throw new Error("Search must never insert HTML.");
  }
  append(...children: TestElement[]) {
    this.children.push(...children);
  }
  replaceChildren(...children: TestElement[]) {
    this.#text = "";
    this.children = children;
  }
  querySelectorAll(selector: string): TestElement[] {
    return this.children.flatMap((child) => [
      ...(selector === child.tag || selector === `.${child.className}`
        ? [child]
        : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  focus() {
    this.document.activeElement = this;
  }
  select() {
    this.selected = true;
  }
}

class TestDialog extends TestElement {
  open = false;
  showModal() {
    this.open = true;
  }
  close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  }
}

interface ResponseStub {
  ok: boolean;
  json(): Promise<unknown>;
}

function setup(basePath = "/docs/") {
  const document = new TestDocument();
  const toggle = document.createElement("button");
  toggle.hidden = true;
  const dialog = new TestDialog(document, "dialog");
  dialog.dataset.indexUrl = `${basePath}_mdd/search-index.json`;
  document.elements.set(".mdd-search-toggle", toggle);
  document.elements.set(".mdd-search-dialog", dialog);
  const control = (tag: string, className: string) => {
    const element = document.createElement(tag);
    element.className = className;
    dialog.append(element);
    return element;
  };
  const input = control("input", "mdd-search-input");
  const close = control("button", "mdd-search-close");
  const status = control("p", "mdd-search-status");
  const results = control("ul", "mdd-search-results");
  const retry = control("button", "mdd-search-retry");
  const requests: {
    url: string;
    options: Record<string, string>;
    resolve(response: ResponseStub): void;
    reject(error: Error): void;
  }[] = [];
  runInNewContext(script, {
    document,
    window: {
      location: {
        href: `https://docs.example.test${basePath}guide/`,
        origin: "https://docs.example.test",
      },
    },
    URL,
    RangeError,
    TypeError,
    search,
    validateSearchIndex,
    fetch: (url: URL, options: Record<string, string>) =>
      new Promise<ResponseStub>((resolve, reject) => {
        requests.push({ url: url.href, options, resolve, reject });
      }),
  });
  const click = (element: TestElement) =>
    element.dispatchEvent(new Event("click"));
  const query = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  };
  const reply = async (data: unknown, request = requests.at(-1)) => {
    if (!request) throw new Error("Expected a lazy index request.");
    request.resolve({ ok: true, json: async () => data });
    // Flush fetch, JSON parsing, and the browser controller's continuation.
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return {
    document,
    toggle,
    dialog,
    input,
    close,
    status,
    results,
    retry,
    requests,
    click,
    query,
    reply,
  };
}

function index(basePath = "/docs/", count = 1): SearchIndex {
  return {
    version: 1,
    pages: Array.from({ length: count }, (_, n) => ({
      url: `${basePath}page-${n}/`,
      title: n ? `Guide ${n}` : "<img src=x onerror=alert(1)>",
      description: "",
      sections: [
        {
          title: "Getting started",
          url: `${basePath}page-${n}/#mdd-getting-started`,
          text: `Shared ${n ? "alpha" : "beta"} <script>literal</script> text.`,
        },
      ],
    })),
  };
}

function key(target: EventTarget, value: string, modifiers = {}) {
  const event = Object.assign(new Event("keydown", { cancelable: true }), {
    key: value,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    isComposing: false,
    ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

test("loads lazily once, uses the latest query after close/reopen, and inserts only text", async () => {
  const ui = setup();
  expect(ui.toggle.hidden).toBe(false);
  expect(ui.requests).toHaveLength(0);
  ui.click(ui.toggle);
  expect(ui.status.textContent).toBe("Loading search…");
  ui.query("alpha");
  ui.click(ui.close);
  ui.click(ui.toggle);
  ui.query("beta");
  expect(ui.requests).toHaveLength(1);
  expect(ui.requests[0]?.options).toEqual({
    mode: "same-origin",
    credentials: "same-origin",
    redirect: "error",
  });
  await ui.reply(index("/docs/", 10));
  const links = ui.results.querySelectorAll("a");
  expect(links).toHaveLength(1);
  expect(links[0]?.href).toBe(
    "https://docs.example.test/docs/page-0/#mdd-getting-started",
  );
  expect(links[0]?.textContent).toContain("<img src=x onerror=alert(1)>");
  expect(links[0]?.textContent).toContain("<script>literal</script>");
  expect(links[0]?.querySelectorAll("script")).toEqual([]);
  ui.click(ui.close);
  ui.click(ui.toggle);
  ui.query("shared");
  expect(ui.requests).toHaveLength(1);
  expect(ui.results.querySelectorAll("a")).toHaveLength(8);
});

test("highlights partial and multiword matches in every result field as the query changes", async () => {
  const ui = setup();
  const data = index();
  const page = data.pages[0];
  const section = page?.sections[0];
  if (!page || !section) throw new Error("Expected searchable page");
  page.title = "Documentation and THEMES";
  section.title = "Custom themes for your docs";
  section.text = "Style documentation with theme files. Docs stay portable.";
  ui.click(ui.toggle);
  ui.query("DOC theme portable");
  await ui.reply(data);

  for (const [selector, original, marked] of [
    ["strong", page.title, ["Doc", "THEME"]],
    ["span", section.title, ["theme", "doc"]],
    ["p", section.text, ["doc", "theme", "Doc", "portable"]],
  ] as const) {
    const field = ui.results.querySelector(selector);
    expect(field?.textContent).toBe(original);
    expect(
      field?.querySelectorAll("mark").map((mark) => mark.textContent),
    ).toEqual([...marked]);
  }
  expect(ui.results.querySelectorAll("a")[0]?.href).toBe(
    `https://docs.example.test${section.url}`,
  );

  ui.query("portable");
  expect(
    ui.results.querySelectorAll("mark").map((mark) => mark.textContent),
  ).toEqual(["portable"]);
  expect(ui.results.querySelector("strong")?.textContent).toBe(page.title);
  expect(ui.results.querySelector("strong")?.querySelectorAll("mark")).toEqual(
    [],
  );
  ui.query("unmatched");
  expect(ui.results.querySelectorAll("mark")).toEqual([]);
  expect(ui.status.textContent).toContain("No results");
  ui.query("");
  expect(ui.results.children).toHaveLength(0);
  expect(ui.requests).toHaveLength(1);
});

test("shows and highlights the engine's excerpt when the match is late in a section", async () => {
  const ui = setup();
  const data = index();
  const page = data.pages[0];
  const section = page?.sections[0];
  if (!page || !section) throw new Error("Expected searchable page");
  page.title = "Writing pages";
  section.title = "Highlight useful details";
  section.text = `${"Explain alerts. ".repeat(30)}Selected theme scripts are trusted browser code. ${"More context. ".repeat(20)}`;
  ui.click(ui.toggle);
  ui.query("theme");
  await ui.reply(data);
  const excerpt = ui.results.querySelector(".mdd-search-result-excerpt");
  expect(excerpt?.textContent).toContain("Selected theme scripts");
  expect(
    excerpt?.querySelectorAll("mark").map((mark) => mark.textContent),
  ).toEqual(["theme"]);
  expect(Array.from(excerpt?.textContent ?? "").length).toBeLessThanOrEqual(
    160,
  );
  expect(ui.results.querySelector("a")?.href).toBe(
    `https://docs.example.test${section.url}`,
  );
});

test.each([
  ["overlapping terms", "banana", "ana an", ["anana"]],
  ["decomposed accent", "Cafe\u0301", "café", ["Cafe\u0301"]],
  ["compatibility ligature", "oﬃce", "ffi", ["ﬃ"]],
  ["fullwidth letters", "ＤＯＣＳ", "doc", ["ＤＯＣ"]],
  ["lowercase expansion", "İstanbul", "i", ["İ"]],
  ["contextual lowercase", "ΟΣ", "ος", ["ΟΣ"]],
  ["compatibility Hangul", "ㄱㅏ", "가", ["ㄱㅏ"]],
  ["astral letters and emoji", "😀 𐐀x", "𐐨", ["𐐀"]],
  [
    "literal HTML and punctuation",
    "<script>DOCS</script>",
    "<script> doc.*",
    ["script", "DOC", "script"],
  ],
] as const)(
  "preserves original text when marking %s",
  async (_case, text, query, expected) => {
    const ui = setup();
    const data = index();
    const page = data.pages[0];
    const section = page?.sections[0];
    if (!page || !section) throw new Error("Expected searchable page");
    page.title = text;
    section.text = text;
    ui.click(ui.toggle);
    ui.query(query);
    await ui.reply(data);
    expect(ui.results.querySelectorAll("a")).toHaveLength(1);
    const title = ui.results.querySelector("strong");
    expect(title?.textContent).toBe(text);
    const marks = title?.querySelectorAll("mark");
    expect(marks?.map((mark) => mark.textContent)).toEqual([...expected]);
    expect(marks?.flatMap((mark) => mark.querySelectorAll("mark"))).toEqual([]);
    expect(ui.results.querySelectorAll("script")).toEqual([]);
  },
);

test("activating a heading result dismisses the modal without overriding native links", async () => {
  const ui = setup();
  ui.click(ui.toggle);
  ui.query("beta");
  const data = index();
  const page = data.pages[0];
  const section = page?.sections[0];
  if (!page || !section) throw new Error("Expected searchable page");
  page.url = "/docs/guide/";
  section.url = "/docs/guide/#mdd-getting-started";
  await ui.reply(data);
  const link = ui.results.querySelectorAll("a")[0];
  if (!link) throw new Error("Expected heading result");
  for (const modifiers of [
    { ctrlKey: true },
    { metaKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ]) {
    link.dispatchEvent(
      Object.assign(new Event("click"), { button: 0, ...modifiers }),
    );
    expect(ui.dialog.open).toBe(true);
  }
  const click = Object.assign(new Event("click", { cancelable: true }), {
    button: 0,
  });
  link.dispatchEvent(click);
  expect(ui.dialog.open).toBe(false);
  expect(click.defaultPrevented).toBe(false);
});

test.each(["/", "/docs/", "/repository/docs/"])(
  "loads and confines navigation at %s",
  async (basePath) => {
    const ui = setup(basePath);
    ui.click(ui.toggle);
    ui.query("beta");
    await ui.reply(index(basePath));
    expect(ui.requests[0]?.url).toBe(
      `https://docs.example.test${basePath}_mdd/search-index.json`,
    );
    expect(ui.results.querySelectorAll("a")[0]?.href).toBe(
      `https://docs.example.test${basePath}page-0/#mdd-getting-started`,
    );
  },
);

test.each([
  ["malformed schema", { version: 2, pages: [] }],
  ["another site", index("/other/")],
  ["similar prefix", index("/docs-evil/")],
  [
    "external page",
    { version: 1, pages: [{ ...index().pages[0], url: "https://evil.test/" }] },
  ],
])("rejects %s and recovers through retry", async (_name, invalid) => {
  const ui = setup();
  ui.click(ui.toggle);
  ui.query("beta");
  await ui.reply(invalid);
  expect(ui.results.children).toHaveLength(0);
  expect(ui.retry.hidden).toBe(false);
  expect(ui.status.textContent).toContain("could not load");
  ui.click(ui.retry);
  await ui.reply(index());
  expect(ui.requests).toHaveLength(2);
  expect(ui.retry.hidden).toBe(true);
  expect(ui.results.querySelectorAll("a")).toHaveLength(1);
});

test("network failure is retryable and a completed hidden request does not steal focus", async () => {
  const ui = setup();
  ui.toggle.focus();
  ui.click(ui.toggle);
  ui.requests[0]?.reject(new Error("Offline"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ui.retry.hidden).toBe(false);
  ui.click(ui.retry);
  ui.query("beta");
  ui.click(ui.close);
  await ui.reply(index());
  expect(ui.document.activeElement).toBe(ui.toggle);
  expect(ui.results.children).toHaveLength(0);
  ui.click(ui.toggle);
  expect(ui.requests).toHaveLength(2);
  expect(ui.results.querySelectorAll("a")).toHaveLength(1);
});

test("empty, unmatched, and overlong queries recover without another request", async () => {
  const ui = setup();
  ui.click(ui.toggle);
  await ui.reply(index());
  expect(ui.status.textContent).toBe("Search the documentation.");
  ui.query("absent");
  expect(ui.status.textContent).toContain("No results");
  ui.query(Array.from({ length: 33 }, (_, n) => `word${n}`).join(" "));
  expect(ui.status.textContent).toContain("Use fewer words");
  expect(ui.retry.hidden).toBe(false);
  ui.query("beta");
  expect(ui.retry.hidden).toBe(true);
  expect(ui.results.querySelectorAll("a")).toHaveLength(1);
  expect(ui.requests).toHaveLength(1);
});

test("keyboard navigation preserves native links and Escape closes even with a query", async () => {
  const ui = setup();
  const opener = ui.document.createElement("a");
  opener.focus();
  expect(key(ui.document, "k", { ctrlKey: true }).defaultPrevented).toBe(true);
  expect(ui.dialog.open).toBe(true);
  expect(ui.document.activeElement).toBe(ui.input);
  expect(ui.input.selected).toBe(true);
  ui.query("shared");
  await ui.reply(index("/docs/", 2));
  const links = ui.results.querySelectorAll("a");
  key(ui.dialog, "ArrowDown");
  expect(ui.document.activeElement).toBe(links[0]);
  key(ui.dialog, "ArrowDown");
  expect(ui.document.activeElement).toBe(links[1]);
  key(ui.dialog, "ArrowUp");
  key(ui.dialog, "ArrowUp");
  expect(ui.document.activeElement).toBe(ui.input);
  for (const value of ["Tab", "Enter"])
    expect(key(ui.dialog, value).defaultPrevented).toBe(false);
  expect(ui.input.value).toBe("shared");
  expect(key(ui.dialog, "Escape").defaultPrevented).toBe(true);
  expect(ui.dialog.open).toBe(false);
  expect(ui.document.activeElement).toBe(opener);
  key(ui.document, "K", { metaKey: true });
  ui.dialog.dispatchEvent(new Event("close"));
  expect(ui.document.activeElement).toBe(ui.input);
  opener.isConnected = false;
  ui.dialog.close();
  expect(ui.document.activeElement).toBe(ui.toggle);
});
