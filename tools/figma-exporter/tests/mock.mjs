// AUTHORED. Read-only mock of the Figma Plugin API for exporter v0.3.0 tests, backed by
// fixtures/plugin-api.fixture.json (test data — see its $comment; not Figma evidence).
// - Every object handed to the extractor is a Proxy: set/define/delete/setPrototypeOf throw, and looking up a
//   missing mutator-like member (set*, create*, remove*, load*, …) throws.
// - Every API function call is recorded in `calls`.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

export const EXPORTER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
export const read = (p) => readFileSync(join(EXPORTER_DIR, p), "utf8");
export const FIXTURE_PATH = "tests/fixtures/plugin-api.fixture.json";
export const loadFixture = () => JSON.parse(read(FIXTURE_PATH));
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

export const ALLOWED_CALLS = [
  "figma.getNodeByIdAsync",
  "figma.getStyleByIdAsync",
  "figma.variables.getVariableByIdAsync",
  "figma.variables.getVariableCollectionByIdAsync",
  "node.getStyledTextSegments",
];

/** Load the extractor core into an isolated VM context. */
export function loadExtractor(source = read("src/extract.js")) {
  const ctx = vm.createContext({});
  vm.runInContext(source + "\nthis.chavoshExtractV3 = chavoshExtractV3;", ctx);
  return ctx.chavoshExtractV3;
}

const MUTATOR = /^(set|create|remove|delete|import|load|save|commit|detach|append|insert|group|flatten|combine|union|subtract|intersect|exclude|notify|closePlugin|showUI|resize|rescale|swap|clone)/;

export function createReadOnlyFigma(fixture, { shuffle = false } = {}) {
  const calls = [];
  const MIXED = Symbol("figma.mixed");
  const deny = (what) => {
    throw new Error(`Extractor attempted a non-read operation: ${what}`);
  };
  const guard = (obj, label) => {
    if (!obj || typeof obj !== "object") return obj;
    return new Proxy(obj, {
      set: (_, k) => deny(`set ${label}.${String(k)}`),
      defineProperty: (_, k) => deny(`define ${label}.${String(k)}`),
      deleteProperty: (_, k) => deny(`delete ${label}.${String(k)}`),
      setPrototypeOf: () => deny(`setPrototypeOf ${label}`),
      get: (t, k) => {
        if (typeof k !== "string") return t[k];
        if (!(k in t)) return MUTATOR.test(k) ? deny(`${label}.${k}`) : undefined;
        const v = t[k];
        if (typeof v === "function") return v;
        return v && typeof v === "object" ? guard(v, `${label}.${k}`) : v;
      },
    });
  };
  const data = structuredClone(fixture);
  const order = (arr) => (shuffle ? [...arr].reverse() : [...arr]);
  const fn = (name, impl) => (...args) => {
    calls.push(name);
    return impl(...args);
  };

  // Node graph with parent links; text nodes get getStyledTextSegments; "MIXED" markers become the mixed symbol.
  const byId = new Map();
  const build = (raw, parent) => {
    const node = { ...raw, parent: parent || null };
    for (const k of ["textStyleId", "fillStyleId", "fills"]) if (node[k] === "MIXED") node[k] = MIXED;
    if (raw.type === "TEXT") {
      const segs = raw.segments || [{ start: 0, end: 5, textStyleId: raw.textStyleId, fillStyleId: raw.fillStyleId, fills: raw.fills }];
      node.getStyledTextSegments = fn("node.getStyledTextSegments", (fields) =>
        segs.map((s) => Object.fromEntries([["start", s.start], ["end", s.end], ["characters", "x"], ...fields.map((f) => [f, s[f]])])),
      );
    }
    delete node.segments;
    // shuffle reverses sibling order: the extractor's output must not depend on traversal order
    if (raw.children) node.children = order(raw.children).map((c) => build(c, node));
    byId.set(node.id, node);
    return node;
  };
  const doc = build(data.document, null);
  const styles = new Map(data.styles.map((s) => [s.id, s]));
  const figma = {
    fileKey: data.fileKey,
    root: doc,
    mixed: MIXED,
    skipInvisibleInstanceChildren: data.skipInvisibleInstanceChildren,
    currentPage: byId.get(data.currentPageId),
    getNodeByIdAsync: fn("figma.getNodeByIdAsync", async (id) => (byId.has(id) ? guard(byId.get(id), id) : null)),
    getStyleByIdAsync: fn("figma.getStyleByIdAsync", async (id) => (styles.has(id) ? guard(styles.get(id), id) : null)),
    variables: {
      getVariableByIdAsync: fn("figma.variables.getVariableByIdAsync", async (id) => {
        const v = data.variables.find((x) => x.id === id);
        return v ? guard(v, v.name) : null;
      }),
      getVariableCollectionByIdAsync: fn("figma.variables.getVariableCollectionByIdAsync", async (id) => {
        const c = data.collections.find((x) => x.id === id);
        return c ? guard(c, c.name) : null;
      }),
    },
  };
  return { figma: guard(figma, "figma"), calls, MIXED };
}

export const toText = (snapshot) => JSON.stringify(JSON.parse(JSON.stringify(snapshot)), null, 2) + "\n";

/** The component roots declared in code.js (parsed, not executed). */
export function pluginRoots() {
  const m = /const CHAVOSH_COMPONENT_ROOTS = (\{[\s\S]*?\n\});/.exec(read("code.js"));
  if (!m) throw new Error("CHAVOSH_COMPONENT_ROOTS not found in code.js");
  return vm.runInNewContext(`(${m[1]})`);
}
