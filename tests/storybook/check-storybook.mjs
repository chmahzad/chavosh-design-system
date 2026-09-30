// AUTHORED. Storybook verification (Storybook 10.6.0, Playwright 1.56.1 / Chromium) — complements, never replaces,
// the component checks. Static: real Button and Link, token CSS loaded once, data-brand toolbar, no raw/duplicated values or
// excluded props in stories. Build: the production static build succeeds; every story renders, its play function
// passes (a failing play emits playFunctionThrewException while storyFinished still says "success", so both are
// checked) and the a11y addon (axe-core) reports no violations; docs pages render; the Brand toolbar switches the real
// Button and Link through data-brand; pseudo-state demos apply the real CSS rules. No output snapshots.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serveStatic } from "./static-server.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
function assert(c, m) { if (!c) throw new Error(m); }
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const STORY_FILES = ["packages/react/src/Button/Button.stories.tsx", "packages/react/src/Button/Button.mdx", "packages/react/src/Link/Link.stories.tsx", "packages/react/src/Link/Link.mdx", ".storybook/pages/Introduction.mdx", ".storybook/pages/Foundations.mdx"];
const EXPECTED_ENTRIES = [
  "introduction--docs", "foundations-design-tokens--docs", "components-button--docs",
  "components-button--playground", "components-button--hierarchies", "components-button--sizes", "components-button--states",
  "components-button--brand-comparison", "components-button--long-label", "components-button--disabled", "components-button--keyboard",
  "components-link--docs", "components-link--playground", "components-link--sizes", "components-link--states",
  "components-link--brand-comparison", "components-link--examples", "components-link--long-label", "components-link--keyboard",
];
const LINK_EXCLUDED = ["disabled", "as", "asChild", "leadingIcon", "trailingIcon", "icon", "visited", "variant", "current", "hover", "focus", "hierarchy"];
const EXCLUDED = ["loading", "leadingIcon", "trailingIcon", "href", "as", "fullWidth", "disabledBehavior", "hover", "pressed", "focus", "spinner", "icon"];

// Expected colours from the generated DTCG (primitive → brand → semantic), independent of any CSS.
const flat = (t, p = []) => Object.entries(t).flatMap(([k, v]) => (k.startsWith("$") ? [] : v && "$value" in v ? [[[...p, k].join("."), v]] : v && typeof v === "object" ? flat(v, [...p, k]) : []));
const set = (n) => new Map(flat(JSON.parse(read(`packages/tokens/generated/dtcg/${n}.tokens.json`))));
const T = { prim: set("primitives"), color: set("color"), dim: set("dimension"), financial: set("brand-financial"), invest: set("brand-invest") };
const resolve = (p, brand) => { const t = T.prim.get(p) || T[brand].get(p) || T.color.get(p) || T.dim.get(p); return typeof t.$value === "string" && t.$value.startsWith("{") ? resolve(t.$value.slice(1, -1), brand) : t.$value; };
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const colour = (p, brand) => rgb(resolve(p, brand).hex);

function staticChecks() {
  const preview = noComments(read(".storybook/preview.tsx"));
  const sbFiles = [".storybook/main.ts", ".storybook/preview.tsx", ".storybook/storybook.css", ...STORY_FILES];
  const tokenImports = sbFiles.flatMap((f) => [...noComments(read(f)).matchAll(/(?:^|\n)\s*import\s+(?:[^"']*from\s+)?["'][^"']*ch-tokens\.css["']|@import\s+[^;]*ch-tokens\.css/g)].map(() => f));
  assert(tokenImports.length === 1 && tokenImports[0] === ".storybook/preview.tsx", `ch-tokens.css must be imported exactly once, in .storybook/preview.tsx (found: ${tokenImports.join(", ") || "none"})`);
  assert(/import "\.\/button\.css"/.test(read("packages/react/src/Button/Button.tsx")), "Button must keep importing its own button.css");
  assert(/import "\.\/link\.css"/.test(read("packages/react/src/Link/Link.tsx")), "Link must import its own link.css");

  const stories = noComments(read("packages/react/src/Button/Button.stories.tsx"));
  assert(/import \{ Button[^}]*\} from "\.\/Button";/.test(stories) && /component: Button,/.test(stories), "stories must use the real Button (./Button)");
  for (const f of STORY_FILES) {
    // MDX prose may mention `<button>` etc. inside inline code spans; only executable/markup content is scanned.
    const code = f.endsWith(".mdx") ? noComments(read(f)).replace(/`[^`\n]*`/g, "") : noComments(read(f));
    assert(!/<button\b/.test(code), `${f}: renders a <button> of its own — stories must use the real Button`);
    assert(!/<a\b/.test(code), `${f}: renders an <a> of its own — stories must use the real Link`);
    assert(!/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|lab)\(/.test(code), `${f}: raw colour value`);
    assert(!/--ch-[a-z0-9-]+\s*:/.test(code) && !/var\(--/.test(code), `${f}: token declarations or token references in documentation/stories`);
    assert(!/\bstyle=\{\{/.test(code), `${f}: inline styles`);
  }
  const css = noComments(read(".storybook/storybook.css"));
  assert(!/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(|var\(|--ch-/.test(css), "storybook.css must contain neutral layout only (no colours, no tokens)");

  // Only the real Button API is exposed.
  const jsxProps = [...stories.matchAll(/<Button\b([^>]*)>/g)].flatMap((m) => m[1].replace(/=\{[^}]*\}|="[^"]*"/g, " ").trim().split(/\s+/).filter(Boolean));
  const argKeys = [...stories.matchAll(/\bargs: \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((a) => a[1]));
  const allowed = new Set(["hierarchy", "size", "type", "disabled", "children", "onClick", "key", "data-demo-state"]);
  for (const p of [...jsxProps, ...argKeys]) assert(allowed.has(p) && !EXCLUDED.includes(p), `prop "${p}" on Button in stories is not part of the documented API`);
  assert(jsxProps.length >= 5 && argKeys.includes("hierarchy"), "Button prop scan found nothing — pattern out of date");
  const include = /controls:\s*\{\s*include:\s*\[([^\]]*)\]/.exec(stories);
  assert(include && JSON.stringify(include[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1)).sort()) === JSON.stringify(["children", "disabled", "hierarchy", "size", "type"]), "controls must be exactly hierarchy, size, type, disabled, children");
  const argTypes = /argTypes:\s*\{([\s\S]*?)\n  \},\n  parameters/.exec(stories)[1];
  const keys = [...argTypes.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert(JSON.stringify(keys) === JSON.stringify(["children", "disabled", "hierarchy", "onClick", "size", "type"]), `argTypes ${keys}`);

  // Link stories: the real Link and only its API.
  const linkStories = noComments(read("packages/react/src/Link/Link.stories.tsx"));
  assert(/import \{ Link[^}]*\} from "\.\/Link";/.test(linkStories) && /component: Link,/.test(linkStories), "stories must use the real Link (./Link)");
  const linkProps = [...linkStories.matchAll(/<Link\b([^>]*)>/g)].flatMap((m) => m[1].replace(/=\{[^}]*\}|="[^"]*"/g, " ").trim().split(/\s+/).filter(Boolean));
  const linkArgs = [...linkStories.matchAll(/\bargs: \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((a) => a[1]));
  const linkAllowed = new Set(["href", "size", "children", "onClick", "key", "data-demo-state", "download", "type", "target", "rel"]);
  for (const p of [...linkProps, ...linkArgs]) assert(linkAllowed.has(p) && !LINK_EXCLUDED.includes(p), `prop "${p}" on Link in stories is not part of the documented API`);
  assert(linkProps.length >= 5 && linkArgs.includes("href"), "Link prop scan found nothing — pattern out of date");
  const linkInclude = /controls:\s*\{\s*include:\s*\[([^\]]*)\]/.exec(linkStories);
  assert(linkInclude && JSON.stringify(linkInclude[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort()) === JSON.stringify(["children", "href", "size"]), "Link controls must be exactly href, size, children");
  const linkArgTypes = /argTypes:\s*\{([\s\S]*?)\n  \},\n  parameters/.exec(linkStories)[1];
  const linkKeys = [...linkArgTypes.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert(JSON.stringify(linkKeys) === JSON.stringify(["children", "href", "onClick", "size"]), `Link argTypes ${linkKeys}`);

  // Brand toolbar via data-brand; viewport presets.
  assert(/value: "financial", title: "Financial"/.test(preview) && /value: "invest", title: "Invest"/.test(preview) && /initialGlobals: \{ brand: "financial" \}/.test(preview), "Brand toolbar: Financial (default) / Invest");
  assert(/<div data-brand=\{context\.globals\.brand \?\? "financial"\}>/.test(preview) && !/invest\s*\?|brand\s*===/.test(preview), "brand applied only through data-brand on the wrapper (no conditionals)");
  for (const w of ["375px", "768px", "1024px"]) assert(preview.includes(`width: "${w}"`), `viewport ${w}`);
  assert(read(".gitignore").includes("storybook-static/"), "storybook-static/ must be git-ignored");
  return [
    "static: ch-tokens.css imported once (.storybook/preview.tsx); Button and Link keep their own button.css / link.css; stories use the real ./Button and ./Link; no <button> or <a>, raw colours, token declarations/references or inline styles in stories/docs; storybook.css is neutral layout",
    "API: Button controls exactly hierarchy/size/type/disabled/children, no excluded props (loading, icons, href, as, fullWidth, state props, disabledBehavior); Link controls exactly href/size/children, no excluded props (disabled, as/asChild, icons, visited, variant, current, state props); stories render no <button>/<a> of their own; Brand toolbar Financial (default)/Invest via data-brand only; viewports 375/768/1024",
  ];
}

export async function run() {
  const lines = staticChecks();
  const out = mkdtempSync(join(tmpdir(), "ch-storybook-"));
  let server, browser;
  try {
    const t0 = Date.now();
    try {
      execFileSync(join(ROOT, "node_modules/.bin/storybook"), ["build", "-o", out, "--quiet"], { cwd: ROOT, stdio: "pipe", env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: "1" } });
    } catch (e) {
      throw new Error(`storybook build failed: ${String(e.stderr || e.message).split("\n").slice(-5).join(" | ")}`);
    }
    const index = JSON.parse(readFileSync(join(out, "index.json"), "utf8"));
    const ids = Object.keys(index.entries).sort();
    assert(JSON.stringify(ids) === JSON.stringify([...EXPECTED_ENTRIES].sort()), `story index ${ids}`);
    const storyCount = (c) => ids.filter((i) => i.startsWith(`components-${c}--`) && index.entries[i].type === "story").length;
    lines.push(`static build: storybook build succeeded in ${Math.round((Date.now() - t0) / 1000)}s; index = Introduction, Foundations/Design tokens, Components/Button (docs + ${storyCount("button")} stories), Components/Link (docs + ${storyCount("link")} stories) — nothing else`);

    server = await serveStatic(out);
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const open = async (query, until) => {
      const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.addInitScript(() => {
        window.__chEvents = [];
        let ch;
        Object.defineProperty(window, "__STORYBOOK_ADDONS_CHANNEL__", {
          configurable: true, get: () => ch,
          set: (v) => { ch = v; const emit = v.emit.bind(v); v.emit = (type, ...a) => { let arg; try { arg = JSON.parse(JSON.stringify(a[0] ?? null)); } catch { arg = null; } window.__chEvents.push({ type, arg }); return emit(type, ...a); }; },
        });
      });
      await page.goto(`${server.origin}/iframe.html?${query}`);
      await page.waitForFunction((t) => window.__chEvents.some((e) => e.type === t), until, { timeout: 30000 });
      const events = await page.evaluate(() => window.__chEvents);
      const bad = events.filter((e) => /threw|errored|exception|missing|error/i.test(e.type) && !/^storybook\/(actions|a11y\/manual)/.test(e.type));
      assert(!bad.length && !pageErrors.length, `${query}: ${bad.map((e) => `${e.type} ${JSON.stringify(e.arg).slice(0, 200)}`).join("; ")} ${pageErrors.join("; ")}`);
      return { page, events };
    };

    let plays = 0;
    let a11yPasses = 0;
    for (const id of ids.filter((i) => index.entries[i].type === "story")) {
      const { page, events } = await open(`id=${id}&viewMode=story`, "storyFinished");
      const fin = events.find((e) => e.type === "storyFinished").arg;
      assert(fin.status === "success", `${id}: story finished with ${fin.status}`);
      const a = fin.reporters.find((r) => r.type === "a11y");
      assert(a && a.status === "passed" && a.result.violations.length === 0, `${id}: a11y ${a && a.status} ${a && a.result.violations.map((v) => v.id)}`);
      a11yPasses += a.result.passes.length;
      if (events.some((e) => e.type === "storyRenderPhaseChanged" && e.arg.newPhase === "played")) plays++;
      await page.close();
    }
    assert(plays === 7, `expected 7 play functions to complete, saw ${plays}`);
    const axe = JSON.parse(read("node_modules/axe-core/package.json")).version;
    lines.push(`stories: all ${ids.filter((i) => index.entries[i].type === "story").length} render; ${plays} play functions pass (Button: Playground click, Disabled non-activation + not focusable, Keyboard Tab/focus-visible/Enter/Space, Long label no clipping; Link: Playground click, Keyboard Tab/focus-visible/Enter activates/Space does not, Long label wraps underlined without clipping); a11y addon (axe-core ${axe}) reports 0 violations on every story (${a11yPasses} passed rule results) — automated evidence only`);

    for (const id of ids.filter((i) => index.entries[i].type === "docs")) {
      const { page } = await open(`id=${id}&viewMode=docs`, "docsRendered");
      await page.close();
    }
    lines.push("docs: Introduction, Foundations/Design tokens and the Button and Link docs pages render without errors");

    // Brand toolbar → data-brand → real Button colours; token CSS present once in the preview.
    for (const brand of ["financial", "invest"]) {
      const { page } = await open(`id=components-button--playground&viewMode=story&globals=brand:${brand}`, "storyFinished");
      const r = await page.evaluate(() => {
        const b = document.querySelector("#storybook-root button");
        const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
        const all = (sel) => rules.filter((x) => x.selectorText === sel).length;
        return { cls: b.className, h: b.dataset.hierarchy, wrapper: b.closest("[data-brand]")?.getAttribute("data-brand"), bg: getComputedStyle(b).backgroundColor, minH: getComputedStyle(b).minHeight, investRules: all('[data-brand="invest"]'), btnRules: all(".ch-button") };
      });
      assert(r.cls === "ch-button" && r.h === "primary" && r.wrapper === brand, `${brand}: real Button in data-brand wrapper ${JSON.stringify(r)}`);
      assert(r.bg === colour("color.action.primary.background.default", brand), `${brand}: primary background ${r.bg} ≠ ${colour("color.action.primary.background.default", brand)}`);
      assert(r.minH === `${resolve("size.control.height.md", "financial").value}px`, `min-height ${r.minH}`);
      assert(r.investRules === 1 && r.btnRules === 1, `token CSS / button.css must be loaded once (invest brand block ×${r.investRules}, .ch-button ×${r.btnRules})`);
      await page.close();
    }
    for (const brand of ["financial", "invest"]) {
      const { page } = await open(`id=components-link--playground&viewMode=story&globals=brand:${brand}`, "storyFinished");
      const r = await page.evaluate(() => {
        const a = document.querySelector("#storybook-root a");
        const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
        const s = getComputedStyle(a);
        return { cls: a.className, size: a.dataset.size, wrapper: a.closest("[data-brand]")?.getAttribute("data-brand"), fg: s.color, deco: s.textDecorationLine, minH: s.minHeight, linkRules: rules.filter((x) => x.selectorText === ".ch-link").length };
      });
      assert(r.cls === "ch-link" && r.size === "md" && r.wrapper === brand && r.deco === "underline", `${brand}: real Link in data-brand wrapper ${JSON.stringify(r)}`);
      assert(r.fg === colour("color.text.link.default", brand), `${brand}: link colour ${r.fg} ≠ ${colour("color.text.link.default", brand)}`);
      assert(r.minH === `${resolve("size.touch-target.min", "financial").value}px` && r.linkRules === 1, `Link min-height ${r.minH} / link.css loaded ×${r.linkRules}`);
      await page.close();
    }
    lines.push("brand toolbar: globals brand=financial|invest sets data-brand on the wrapper; the real Button resolves the matching DTCG primary colour and the real Link the matching link colour (underlined, 44px minimum); token stylesheet, button.css and link.css each loaded exactly once");

    // Pseudo-state demonstrations apply the real CSS rules (incl. the @media (hover: hover) hover rule).
    const { page } = await open("id=components-button--states&viewMode=story", "storyFinished");
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => {
      const q = (state) => document.querySelector(`button.ch-button[data-hierarchy="primary"]${state ? `[data-demo-state="${state}"]` : ":not([data-demo-state])"}`);
      const s = (el) => { const c = getComputedStyle(el); return { deco: c.textDecorationLine, bg: c.backgroundColor, outline: `${c.outlineStyle} ${c.outlineWidth}`, disabled: el.disabled }; };
      return { def: s(q()), hover: s(q("hover")), pressed: s(q("pressed")), focus: s(q("focus")), disabled: s(q("disabled")) };
    });
    assert(st.def.deco === "none" && st.hover.deco === "underline" && st.pressed.deco === "none" && st.pressed.bg === colour("color.action.primary.background.pressed", "financial"), `pseudo hover/pressed ${JSON.stringify(st)}`);
    assert(st.focus.outline === `solid ${resolve("focus.width.indicator", "financial").value}px` && st.disabled.disabled && st.disabled.bg === colour("color.action.disabled.background", "financial"), `pseudo focus/disabled ${JSON.stringify(st)}`);
    await page.close();
    lines.push("States story: pseudo-states addon applies the real :hover (underline, via @media (hover: hover)), :active (pressed colour, no underline) and :focus-visible (3px ring) rules; disabled is the native attribute — no state props");
    {
      const { page: lp } = await open("id=components-link--states&viewMode=story", "storyFinished");
      await lp.waitForTimeout(300);
      const ls = await lp.evaluate(() => {
        const q = (state) => document.querySelector(`a.ch-link[data-size="md"]${state ? `[data-demo-state="${state}"]` : ":not([data-demo-state])"}`);
        const s = (el) => { const c = getComputedStyle(el); return { fg: c.color, deco: c.textDecorationLine, thick: c.textDecorationThickness, outline: `${c.outlineStyle} ${c.outlineWidth}` }; };
        return { def: s(q()), hover: s(q("hover")), focus: s(q("focus")) };
      });
      assert(ls.def.deco === "underline" && ls.def.thick === "1px" && ls.def.fg === colour("color.text.link.default", "financial"), `Link default ${JSON.stringify(ls.def)}`);
      assert(ls.hover.deco === "underline" && ls.hover.thick === "2px" && ls.hover.fg === colour("color.text.link.hover", "financial"), `Link pseudo hover ${JSON.stringify(ls.hover)}`);
      assert(ls.focus.deco === "underline" && ls.focus.outline === `solid ${resolve("focus.width.indicator", "financial").value}px`, `Link pseudo focus ${JSON.stringify(ls.focus)}`);
      await lp.close();
    }
    lines.push("Link States story: pseudo-states addon applies the real rules — underline 1px at rest; :hover (via @media (hover: hover)) hover colour + 2px underline; :focus-visible 3px ring with the underline kept — no state props");
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    rmSync(out, { recursive: true, force: true });
  }
  return lines;
}
