// AUTHORED. Link v1 in Chromium (Playwright 1.56.1): structure, computed tokens for size × state × brand (incl. nested
// and page-level contexts), persistent underline (1px rest / 2px hover, 0.15em offset, skip-ink), 44px minimum target,
// focus-visible rings, keyboard semantics (Tab, Enter navigates/activates, Space does not), wrapping, 200 % text and
// 320px reflow, hover-incapable devices and forced colours. Expected values come from the Link architecture token
// mapping (§7) resolved through the generated DTCG — independent of link.css. Automated evidence only; not an
// accessibility-conformance claim.
import { build } from "vite";
import { chromium } from "playwright";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "./build-harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, "../../tokens");
function assert(c, m) { if (!c) throw new Error(m); }

const flat = (tree, p = []) => Object.entries(tree).flatMap(([k, v]) => (k.startsWith("$") ? [] : v && "$value" in v ? [[[...p, k].join("."), v]] : v && typeof v === "object" ? flat(v, [...p, k]) : []));
const set = (n) => new Map(flat(JSON.parse(readFileSync(join(TOKENS, `generated/dtcg/${n}.tokens.json`), "utf8"))));
const S = { prim: set("primitives"), color: set("color"), dim: set("dimension"), resp: set("responsive-mobile"), financial: set("brand-financial"), invest: set("brand-invest") };
const resolve = (path, brand) => {
  const t = S.prim.get(path) || S[brand].get(path) || S.color.get(path) || S.dim.get(path) || S.resp.get(path);
  if (!t) throw new Error(`unknown token ${path}`);
  return typeof t.$value === "string" && t.$value.startsWith("{") ? resolve(t.$value.slice(1, -1), brand) : t.$value;
};
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const col = (tok, brand) => rgb(resolve(`color.${tok}`, brand).hex);
const px = (path) => resolve(path, "financial").value;

// Link architecture §7 token mapping: label + underline colour per state; underline thickness (ADR 0013).
const STATE = { default: { fg: "text.link.default", thick: "1px" }, hover: { fg: "text.link.hover", thick: "2px" }, focus: { fg: "text.link.default", thick: "1px" } };
const SIZE = { md: { fs: "font.size.label.md", lh: "font.line-height.label.md" }, sm: { fs: "font.size.label.sm", lh: "font.line-height.label.sm" } };
const BRAND_OF_CTX = { financial: "financial", invest: "invest", "fin-in-inv": "financial", "inv-in-fin": "invest" };

const READ = (el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName, fg: s.color, bg: s.backgroundColor, deco: s.textDecorationLine, decoColor: s.textDecorationColor, decoThick: s.textDecorationThickness,
    decoOffset: s.textUnderlineOffset, skipInk: s.textDecorationSkipInk, decoStyle: s.textDecorationStyle, fs: s.fontSize, lh: s.lineHeight, ff: s.fontFamily, fw: s.fontWeight,
    minH: s.minHeight, pt: s.paddingTop, pl: s.paddingLeft, radius: s.borderTopLeftRadius, gap: s.columnGap, display: s.display, align: s.alignItems,
    bw: s.borderTopWidth, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor, outlineOffset: s.outlineOffset,
    shadow: s.boxShadow, height: r.height, width: r.width, fv: el.matches(":focus-visible"),
  };
};

async function buildLinkHarness() {
  const outDir = mkdtempSync(join(tmpdir(), "ch-link-harness-"));
  await build({ root: join(HERE, "link-harness"), base: "./", logLevel: "silent", build: { outDir, emptyOutDir: true, minify: false } });
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

export async function run() {
  const lines = [];
  const harness = await buildLinkHarness();
  const server = await serve(harness.outDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(server.url);
    await page.waitForFunction(() => window.__ready === true);
    const el = (id) => page.locator(`[data-testid="${id}"]`);
    const read = (id) => el(id).evaluate(READ);

    // ---- Structure -----------------------------------------------------------------------------------------
    const def = await el("default").evaluate((a) => ({ tag: a.tagName, href: a.getAttribute("href"), cls: a.className, s: a.dataset.size, role: a.getAttribute("role"), tab: a.getAttribute("tabindex"), name: a.textContent, kids: a.children.length }));
    assert(def.tag === "A" && def.href === "#default" && def.cls === "ch-link" && def.s === "md" && def.role === null && def.tab === null && def.name === "View transactions" && def.kids === 0, `defaults ${JSON.stringify(def)}`);
    const role = await page.evaluate(() => { const a = document.querySelector('[data-testid="default"]'); return a.matches(":any-link"); });
    assert(role, "a Link must be a hyperlink (:any-link)");
    const nat = await el("native").evaluate((a) => ({ id: a.id, href: a.getAttribute("href"), dl: a.getAttribute("download"), hl: a.hreflang, type: a.type, target: a.target, rel: a.rel, title: a.title, desc: a.getAttribute("aria-describedby"), extra: a.dataset.extra, cls: a.className }));
    assert(nat.id === "native-id" && nat.href === "/statement.pdf" && nat.dl === "statement.pdf" && nat.hl === "en" && nat.type === "application/pdf" && nat.target === "_blank" && nat.rel === "noopener noreferrer" && nat.title === "Statement" && nat.desc === "hint" && nat.extra === "yes" && nat.cls === "ch-link consumer-class", `passthrough ${JSON.stringify(nat)}`);
    assert(await page.evaluate(() => window.__linkRef instanceof HTMLAnchorElement && window.__linkRef.dataset.testid === "ref"), "ref must reach the native <a>");
    const snap = await page.accessibility.snapshot({ root: await el("default").elementHandle() });
    assert(snap && snap.role === "link" && snap.name === "View transactions", `accessibility tree: ${JSON.stringify(snap)}`);
    lines.push("structure: native <a href class=ch-link>, no role/tabindex override, accessibility tree role=link with the visible label as name; default size md; href/download/hreflang/type/target/rel/title/aria-*/data-*/className pass through; ref (React 19 prop) reaches the <a>");

    // ---- Computed tokens: size × state × brand ------------------------------------------------------------------
    const checkState = async (id, s, state, brand) => {
      const r = await read(id);
      const z = SIZE[s], st = STATE[state];
      const where = `${id} [${state}]`;
      assert(r.fg === col(st.fg, brand), `${where}: colour ${r.fg} ≠ ${col(st.fg, brand)}`);
      assert(r.bg === "rgba(0, 0, 0, 0)" && r.bw === "0px", `${where}: a Link has no fill or border (${r.bg}, ${r.bw})`);
      assert(r.deco === "underline" && r.decoStyle === "solid" && r.decoColor === r.fg && r.decoThick === st.thick && r.skipInk === "auto" && Math.abs(parseFloat(r.decoOffset) - 0.15 * px(z.fs)) < 0.05, `${where}: underline ${r.deco} ${r.decoThick} ${r.decoOffset} ${r.decoColor} ${r.skipInk}`);
      assert(r.fs === `${px(z.fs)}px` && r.lh === `${px(z.lh)}px` && r.ff === "Inter, system-ui, sans-serif" && r.fw === String(resolve("font.weight.medium", "financial")), `${where}: typography ${r.fs}/${r.lh}/${r.ff}/${r.fw}`);
      assert(r.minH === `${px("size.touch-target.min")}px` && Math.abs(r.height - px("size.touch-target.min")) < 0.01 && r.pt === "0px" && r.pl === "0px", `${where}: target ${r.minH} / ${r.height}, padding ${r.pt} ${r.pl}`);
      assert(r.radius === `${px("radius.sm")}px` && r.gap === `${px("space.gap.xs")}px` && r.display === "inline-flex" && r.align === "center", `${where}: radius/gap/display ${r.radius} ${r.gap} ${r.display} ${r.align}`);
      const focus = state === "focus";
      assert(r.fv === focus && (r.outlineStyle === "solid") === focus, `${where}: focus-visible ${r.fv} outline ${r.outlineStyle}`);
      if (focus) {
        const iw = px("focus.width.indicator"), ow = px("focus.width.outer");
        assert(r.outlineWidth === `${iw}px` && r.outlineColor === rgb(resolve("color.focus.indicator", brand).hex) && r.outlineOffset === "0px", `${where}: indicator ${r.outlineWidth} ${r.outlineColor}`);
        assert(r.shadow === `${rgb(resolve("color.focus.outer", brand).hex)} 0px 0px 0px ${iw + ow}px`, `${where}: outer ring ${r.shadow}`);
      } else assert(r.shadow === "none", `${where}: unexpected box-shadow ${r.shadow}`);
    };
    const reset = async () => { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement && document.activeElement.blur()); };
    let n = 0;
    for (const ctx of Object.keys(BRAND_OF_CTX)) {
      const brand = BRAND_OF_CTX[ctx];
      for (const s of Object.keys(SIZE)) {
        const id = `${ctx}-${s}`;
        await reset(); await checkState(id, s, "default", brand); n++;
        await el(id).hover(); await checkState(id, s, "hover", brand); n++;
        const box = await el(id).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await checkState(id, s, "hover", brand); await page.mouse.up(); n++;
        await reset(); await page.keyboard.press("Shift"); await el(id).focus(); await checkState(id, s, "focus", brand); n++;
        await el(id).hover();
        const fh = await read(id);
        assert(fh.fv && fh.outlineStyle === "solid" && fh.deco === "underline" && fh.decoThick === "2px" && fh.fg === col("text.link.hover", brand), `${id}: focus-visible must coexist with hover`);
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    await reset(); for (const s of Object.keys(SIZE)) { await checkState(`financial-${s}`, s, "default", "invest"); n++; }
    await page.evaluate(() => document.documentElement.removeAttribute("data-brand"));
    const fin = col("text.link.default", "financial"), inv = col("text.link.default", "invest");
    assert(fin !== inv && col("text.link.hover", "financial") !== col("text.link.hover", "invest"), "link colours must differ between Financial and Invest");
    assert(col("focus.indicator", "financial") === col("focus.indicator", "invest"), "focus colours are brand-independent");
    lines.push(`computed tokens (${browser.version()}): ${n} state checks = md + sm × default / hover / pressed (no separate signal) / focus-visible × Financial, Invest, Financial-in-Invest, Invest-in-Financial + page-level <html data-brand=invest> — colour, underline (always on; 1px rest, 2px hover, 0.15em offset, skip-ink, link colour), label typography, 44px min-height = rendered height, no padding/fill/border, radius/sm, gap/xs, focus rings`);
    lines.push(`brand: link colours switch ${fin} → ${inv} (default) through data-brand only; focus rings brand-independent; focus-visible coexists with hover; pressed shows no separate state`);

    // ---- Keyboard ------------------------------------------------------------------------------------------------
    await reset();
    await el("before").focus();
    await page.keyboard.press("Tab");
    assert(await el("kb-1").evaluate((a) => a === document.activeElement && a.matches(":focus-visible")), "Tab reaches the link with focus-visible");
    await page.keyboard.press("Enter");
    assert((await page.evaluate(() => window.__clicks["kb-1"])) === 1, "Enter activates the link once");
    await page.keyboard.press("Space");
    assert((await page.evaluate(() => window.__clicks["kb-1"])) === 1, "Space must not activate a link");
    await page.keyboard.press("Tab");
    assert(await el("nav").evaluate((a) => a === document.activeElement), "Tab moves to the next link in DOM order");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.hash === "#destination");
    await reset(); await el("kb-1").click();
    assert(!(await el("kb-1").evaluate((a) => a.matches(":focus-visible"))), "pointer click must not show the focus ring");
    assert((await page.evaluate(() => window.__clicks["kb-1"])) === 2, "click activates");
    lines.push("keyboard: Tab focus in DOM order shows the ring; Enter activates (real navigation to #destination); Space does not activate; mouse click activates without a ring");

    // ---- Wrapping, 200 % text and reflow ---------------------------------------------------------------------------
    const wrapCheck = async (label) => {
      const w = await el("wrap-md").evaluate((a) => { const s = getComputedStyle(a); const r = a.getBoundingClientRect(); const rects = a.getClientRects().length; const t = document.createRange(); t.selectNodeContents(a); const lines = new Set([...t.getClientRects()].map((x) => Math.round(x.top))).size; return { h: r.height, minH: parseFloat(s.minHeight), lh: parseFloat(s.lineHeight), sw: a.scrollWidth, cw: a.clientWidth, sh: a.scrollHeight, ch: a.clientHeight, pw: a.parentElement.clientWidth, ow: a.offsetWidth, deco: s.textDecorationLine, rects, lines }; });
      assert(w.lines >= 2 && w.h > w.minH && w.sw <= w.cw && w.sh <= w.ch && w.ow <= w.pw && w.deco === "underline", `${label}: wrapping/clipping ${JSON.stringify(w)}`);
      return w;
    };
    const w1 = await wrapCheck("100 % text");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const w2 = await wrapCheck("200 % text");
    const big = await read("financial-md");
    assert(big.minH === `${2 * px("size.touch-target.min")}px` && big.fs === `${2 * px("font.size.label.md")}px` && big.height >= 2 * px("size.touch-target.min") - 0.01, `200 % scaling: ${big.minH} ${big.fs} ${big.height}`);
    await page.setViewportSize({ width: 320, height: 900 });
    const reflow = await page.evaluate(() => ({ doc: document.scrollingElement.scrollWidth, vw: window.innerWidth, out: [...document.querySelectorAll(".ch-link")].filter((a) => a.getBoundingClientRect().right > window.innerWidth + 0.5).map((a) => a.dataset.testid) }));
    assert(reflow.doc <= reflow.vw && reflow.out.length === 0, `reflow at 320px / 200 %: document ${reflow.doc}px > ${reflow.vw}px or links outside the viewport ${reflow.out}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    lines.push(`wrapping: long label wraps (${w1.lines} lines, ${w1.h}px) and at 200 % text (${w2.lines} lines, ${w2.h}px), stays underlined, no clipping; the 44px minimum target and typography scale ×2 with the root size; no horizontal overflow at 320px / 200 %`);

    // ---- Target size -----------------------------------------------------------------------------------------------
    const tgt = await page.evaluate(() => [...document.querySelectorAll(".ch-link")].map((a) => a.getBoundingClientRect().height));
    assert(tgt.every((h) => h >= px("size.touch-target.min") - 0.01), `every Link must be at least 44px high (${tgt})`);
    lines.push(`target: all ${tgt.length} Links render ≥ ${px("size.touch-target.min")}px high (size/touch-target/min as min-height); width follows the label`);

    // ---- Hover-incapable devices ------------------------------------------------------------------------------------
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage();
    await tp.goto(server.url);
    await tp.waitForFunction(() => window.__ready === true);
    assert(!(await tp.evaluate(() => matchMedia("(hover: hover)").matches)), "emulated touch device should report hover: none");
    await tp.locator('[data-testid="financial-md"]').hover();
    const th = await tp.locator('[data-testid="financial-md"]').evaluate((a) => { const s = getComputedStyle(a); return { c: s.color, t: s.textDecorationThickness, d: s.textDecorationLine }; });
    assert(th.c === col("text.link.default", "financial") && th.t === "1px" && th.d === "underline", `no hover change on hover-incapable devices ${JSON.stringify(th)}`);
    await touch.close();
    lines.push("hover capability: on an emulated touch device (hover: none) the link keeps its rest colour and 1px underline (no sticky hover)");

    // ---- Forced colours ----------------------------------------------------------------------------------------------
    await page.emulateMedia({ forcedColors: "active" });
    await reset();
    const sys = await page.evaluate(() => { const p = document.createElement("span"); document.body.append(p); const c = (v) => { p.style.color = v; return getComputedStyle(p).color; }; const r = { link: c("LinkText"), hl: c("Highlight") }; p.remove(); return r; });
    for (const s of Object.keys(SIZE)) {
      const r = await read(`financial-${s}`);
      assert(r.fg === sys.link && r.deco === "underline" && r.decoColor === sys.link && Math.abs(r.height - px("size.touch-target.min")) < 0.01, `forced colours ${s}: ${r.fg} ${r.deco} ${r.decoColor} ${r.height}`);
      await page.keyboard.press("Shift"); await el(`financial-${s}`).focus();
      const f = await read(`financial-${s}`);
      assert(f.fv && f.outlineStyle === "solid" && f.outlineWidth === `${px("focus.width.indicator")}px` && f.outlineColor === sys.hl, `forced colours focus ${s}: ${f.outlineStyle} ${f.outlineWidth} ${f.outlineColor}`);
      await reset();
    }
    await page.emulateMedia({ forcedColors: "none" });
    lines.push("forced colours (emulated): text and underline use the system LinkText colour, the underline stays, the target keeps 44px; focus-visible keeps a 3px Highlight outline");
  } finally {
    await browser.close();
    server.close();
    harness.cleanup();
  }
  return lines;
}
