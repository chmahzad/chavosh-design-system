// AUTHORED. Button v1 in Chromium (Playwright 1.56.1): structure, computed tokens for every hierarchy × size × state ×
// brand (incl. nested contexts), interaction precedence, keyboard, wrapping, 200 % text, hover-incapable devices and
// forced colours. Expected values come from ADR 0010's state table resolved through the generated DTCG — independent
// of button.css. Automated evidence only; not an accessibility-conformance claim.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildHarness, serve } from "./build-harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = join(HERE, "../../tokens");
function assert(c, m) { if (!c) throw new Error(m); }

// ---- expectations from DTCG (primitive → brand → semantic) ------------------------------------------------------
const flat = (tree, p = []) => Object.entries(tree).flatMap(([k, v]) => (k.startsWith("$") ? [] : v && "$value" in v ? [[[...p, k].join("."), v]] : v && typeof v === "object" ? flat(v, [...p, k]) : []));
const set = (n) => new Map(flat(JSON.parse(readFileSync(join(TOKENS, `generated/dtcg/${n}.tokens.json`), "utf8"))));
const S = { prim: set("primitives"), color: set("color"), dim: set("dimension"), resp: set("responsive-mobile"), financial: set("brand-financial"), invest: set("brand-invest") };
const resolve = (path, brand) => {
  const t = S.prim.get(path) || S[brand].get(path) || S.color.get(path) || S.dim.get(path) || S.resp.get(path);
  if (!t) throw new Error(`unknown token ${path}`);
  return typeof t.$value === "string" && t.$value.startsWith("{") ? resolve(t.$value.slice(1, -1), brand) : t.$value;
};
const rgb = (hex) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const col = (tok, brand) => (tok === null ? "rgba(0, 0, 0, 0)" : rgb(resolve(`color.${tok}`, brand).hex));
const px = (path) => resolve(path, "financial").value;

// ADR 0010 §1 table: [background, foreground, border] token (relative to color.*); null = transparent / none.
const A = "action";
const TABLE = {
  primary: { default: [`${A}.primary.background.default`, `${A}.primary.foreground.default`, null], hover: [`${A}.primary.background.default`, `${A}.primary.foreground.default`, null], active: [`${A}.primary.background.pressed`, `${A}.primary.foreground.default`, null], disabled: [`${A}.disabled.background`, `${A}.disabled.foreground`, null] },
  secondary: { default: [`${A}.secondary.background.default`, `${A}.secondary.foreground.default`, `${A}.secondary.border.default`], hover: [`${A}.secondary.background.default`, `${A}.secondary.foreground.default`, `${A}.secondary.border.default`], active: [`${A}.secondary.background.pressed`, `${A}.secondary.foreground.hover`, `${A}.secondary.border.hover`], disabled: [`${A}.disabled.background`, `${A}.disabled.foreground`, "border.disabled"] },
  tertiary: { default: [null, `${A}.tertiary.foreground.default`, null], hover: [`${A}.tertiary.background.hover`, `${A}.tertiary.foreground.hover`, null], active: [`${A}.tertiary.background.pressed`, `${A}.tertiary.foreground.hover`, null], disabled: [null, `${A}.disabled.foreground`, null] },
  destructive: { default: [`${A}.destructive.background.default`, `${A}.destructive.foreground.default`, null], hover: [`${A}.destructive.background.default`, `${A}.destructive.foreground.default`, null], active: [`${A}.destructive.background.pressed`, `${A}.destructive.foreground.default`, null], disabled: [`${A}.disabled.background`, `${A}.disabled.foreground`, null] },
};
TABLE.primary.focus = TABLE.primary.default; TABLE.secondary.focus = TABLE.secondary.default; TABLE.tertiary.focus = TABLE.tertiary.default; TABLE.destructive.focus = TABLE.destructive.default;
const SIZE = {
  sm: { h: "size.control.height.sm", px: "space.component.lg", fs: "font.size.label.sm", lh: "font.line-height.label.sm" },
  md: { h: "size.control.height.md", px: "space.component.xl", fs: "font.size.label.md", lh: "font.line-height.label.md" },
  lg: { h: "size.control.height.lg", px: "space.component.xl", fs: "font.size.label.md", lh: "font.line-height.label.md" },
};
const BRAND_OF_CTX = { financial: "financial", invest: "invest", "fin-in-inv": "financial", "inv-in-fin": "invest" };

const READ = (el) => {
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName, bg: s.backgroundColor, fg: s.color, bc: s.borderTopColor, bw: s.borderTopWidth, deco: s.textDecorationLine,
    decoColor: s.textDecorationColor, decoThick: s.textDecorationThickness, decoOffset: s.textUnderlineOffset, fs: s.fontSize, lh: s.lineHeight,
    ff: s.fontFamily, fw: s.fontWeight, minH: s.minHeight, pt: s.paddingTop, pl: s.paddingLeft, radius: s.borderTopLeftRadius, gap: s.columnGap,
    display: s.display, boxSizing: s.boxSizing, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor,
    outlineOffset: s.outlineOffset, shadow: s.boxShadow, height: r.height, fv: el.matches(":focus-visible"),
  };
};

export async function run() {
  const lines = [];
  const harness = await buildHarness();
  const server = await serve(harness.outDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(server.url);
    await page.waitForFunction(() => window.__ready === true);
    const el = (id) => page.locator(`[data-testid="${id}"]`);
    const read = (id) => el(id).evaluate(READ);

    // ---- Structure -----------------------------------------------------------------------------------------
    const def = await el("default").evaluate((b) => ({ tag: b.tagName, type: b.getAttribute("type"), cls: b.className, h: b.dataset.hierarchy, s: b.dataset.size, role: b.getAttribute("role"), name: b.textContent }));
    assert(def.tag === "BUTTON" && def.type === "button" && def.cls === "ch-button" && def.h === "primary" && def.s === "md" && def.role === null && def.name === "Continue", `defaults ${JSON.stringify(def)}`);
    const nat = await el("native").evaluate((b) => ({ id: b.id, name: b.name, value: b.value, form: b.form && b.form.id, title: b.title, desc: b.getAttribute("aria-describedby"), extra: b.dataset.extra, cls: b.className, tab: b.tabIndex }));
    assert(nat.id === "native-id" && nat.name === "action" && nat.value === "save" && nat.form === "f1" && nat.title === "Save draft" && nat.desc === "hint" && nat.extra === "yes" && nat.cls === "ch-button consumer-class" && nat.tab === 0, `passthrough ${JSON.stringify(nat)}`);
    assert(await page.evaluate(() => window.__ref instanceof HTMLButtonElement && window.__ref.dataset.testid === "ref"), "ref must reach the native <button>");
    await el("in-form-default").click();
    assert((await page.evaluate(() => window.__submits)) === 0 && (await page.evaluate(() => window.__clicks["in-form-default"])) === 1, "default type=button must not submit its form");
    await el("in-form-submit").click();
    assert((await page.evaluate(() => window.__submits)) === 1, 'type="submit" must submit');
    await el("field").fill("changed");
    await el("in-form-reset").click();
    assert((await el("field").inputValue()) === "x", 'type="reset" must reset');
    for (const h of Object.keys(TABLE)) for (const s of Object.keys(SIZE)) {
      const a = await el(`financial-${h}-${s}-enabled`).evaluate((b) => [b.dataset.hierarchy, b.dataset.size, b.disabled]);
      assert(a[0] === h && a[1] === s && a[2] === false, `mapping ${h}/${s}`);
      assert(await el(`financial-${h}-${s}-disabled`).evaluate((b) => b.disabled && b.hasAttribute("disabled")), `disabled attribute ${h}/${s}`);
    }
    lines.push("structure: native <button type=button class=ch-button>, no role override; defaults primary/md; hierarchy/size → data attributes; id/name/value/form/title/aria-*/data-*/className/tabIndex pass through; ref (React 19 prop) reaches the <button>; default never submits, submit/reset work; disabled is native");

    // ---- Computed tokens: hierarchy × size × state × brand -------------------------------------------------------
    const checkState = async (id, h, s, state, brand) => {
      const r = await read(id);
      const [bg, fg, bc] = TABLE[h][state];
      const z = SIZE[s];
      const bw = h === "secondary" ? px("border-width.default") : 0;
      const where = `${id} [${state}]`;
      assert(r.bg === col(bg, brand), `${where}: background ${r.bg} ≠ ${col(bg, brand)}`);
      assert(r.fg === col(fg, brand), `${where}: colour ${r.fg} ≠ ${col(fg, brand)}`);
      assert(r.bw === `${bw}px` && (bw === 0 || r.bc === col(bc, brand)), `${where}: border ${r.bw} ${r.bc}`);
      assert(r.fs === `${px(z.fs)}px` && r.lh === `${px(z.lh)}px` && r.ff === "Inter, system-ui, sans-serif" && r.fw === String(resolve("font.weight.medium", "financial")), `${where}: typography ${r.fs}/${r.lh}/${r.ff}/${r.fw}`);
      assert(r.minH === `${px(z.h)}px` && Math.abs(r.height - px(z.h)) < 0.01, `${where}: height ${r.minH} / ${r.height}`);
      assert(r.pl === `${px(z.px) - bw}px` && r.pt === `${(px(z.h) - px(z.lh)) / 2 - bw}px`, `${where}: padding ${r.pl} ${r.pt}`);
      assert(r.radius === `${px("radius.md")}px` && r.gap === `${px("space.gap.sm")}px` && r.display === "inline-flex" && r.boxSizing === "border-box", `${where}: radius/gap/display`);
      const underlined = state === "hover";
      assert((r.deco === "underline") === underlined, `${where}: text-decoration ${r.deco}`);
      if (underlined) assert(r.decoThick === "1px" && Math.abs(parseFloat(r.decoOffset) - 0.15 * px(z.fs)) < 0.05 && r.decoColor === r.fg, `${where}: underline ${r.decoThick} ${r.decoOffset} ${r.decoColor}`);
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
    for (const ctx of ["financial", "invest"]) {
      const brand = BRAND_OF_CTX[ctx];
      for (const h of Object.keys(TABLE)) for (const s of ["md", "lg", "sm"]) {
        const id = `${ctx}-${h}-${s}-enabled`, did = `${ctx}-${h}-${s}-disabled`;
        await reset(); await checkState(id, h, s, "default", brand); n++;
        await el(id).hover(); await checkState(id, h, s, "hover", brand); n++;
        const box = await el(id).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await checkState(id, h, s, "active", brand); await page.mouse.up(); n++;
        await reset(); await page.keyboard.press("Shift"); await el(id).focus(); await checkState(id, h, s, "focus", brand); n++;
        // focus-visible + hover coexist: ring AND underline
        await el(id).hover();
        const fh = await read(id);
        assert(fh.fv && fh.outlineStyle === "solid" && fh.deco === "underline", `${id}: focus-visible must coexist with hover`);
        await reset(); await checkState(did, h, s, "disabled", brand); n++;
        await el(did).hover({ force: true }); await checkState(did, h, s, "disabled", brand);
        const dbox = await el(did).boundingBox();
        await page.mouse.move(dbox.x + 2, dbox.y + 2); await page.mouse.down(); await checkState(did, h, s, "disabled", brand); await page.mouse.up();
      }
    }
    lines.push(`computed tokens (${browser.version()}): ${n} state checks = 4 hierarchies × md, lg (production) + sm (visual only) × default/hover/active/focus-visible/disabled × Financial + Invest — colours, border, typography, min-height = rendered height, derived padding, radius, gap, underline, focus rings`);
    lines.push("precedence: hover underline only on hover; pressed wins over hover and is never underlined; focus-visible coexists with hover; disabled ignores hover and press and is never underlined");

    // ---- Nested brand contexts -------------------------------------------------------------------------------
    for (const ctx of ["fin-in-inv", "inv-in-fin"]) for (const h of Object.keys(TABLE)) {
      await reset(); await checkState(`${ctx}-${h}-md-enabled`, h, "md", "default", BRAND_OF_CTX[ctx]);
      const id = `${ctx}-${h}-md-enabled`; const box = await el(id).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await checkState(id, h, "md", "active", BRAND_OF_CTX[ctx]); await page.mouse.up();
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    await reset(); for (const h of Object.keys(TABLE)) await checkState(`financial-${h}-md-enabled`, h, "md", "default", "invest");
    await page.evaluate(() => document.documentElement.removeAttribute("data-brand"));
    lines.push("brand: Financial default; Invest explicit; Financial-in-Invest and Invest-in-Financial (default + pressed) and page-level <html data-brand=invest> resolve through CSS custom properties only");

    // ---- Keyboard ------------------------------------------------------------------------------------------------
    await reset();
    await el("before").focus();
    await page.keyboard.press("Tab");
    assert(await el("kb-1").evaluate((b) => b === document.activeElement && b.matches(":focus-visible")), "Tab reaches the button with focus-visible");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    assert((await page.evaluate(() => window.__clicks["kb-1"])) === 2, "Enter and Space each activate once");
    await page.keyboard.press("Tab");
    assert(await el("kb-2").evaluate((b) => b === document.activeElement), "native disabled is skipped in tab order");
    await el("kb-disabled").click({ force: true });
    await el("kb-disabled").evaluate((b) => b.click());
    assert(!(await page.evaluate(() => window.__clicks["kb-disabled"])), "disabled button must not activate");
    await reset(); await el("kb-1").click();
    assert(!(await el("kb-1").evaluate((b) => b.matches(":focus-visible"))), "pointer click must not show the focus ring");
    lines.push("keyboard: Tab focus shows the ring, Enter and Space activate once each, disabled skipped in tab order and never activates, mouse click shows no ring");

    // ---- Wrapping and 200 % text ------------------------------------------------------------------------------
    const wrapCheck = async (label) => {
      const w = await el("wrap-md").evaluate((b) => { const s = getComputedStyle(b); const r = b.getBoundingClientRect(); return { h: r.height, minH: parseFloat(s.minHeight), lh: parseFloat(s.lineHeight), pt: parseFloat(s.paddingTop), bw: parseFloat(s.borderTopWidth), sw: b.scrollWidth, cw: b.clientWidth, sh: b.scrollHeight, ch: b.clientHeight, pw: b.parentElement.clientWidth, ow: b.offsetWidth }; });
      const lines2 = Math.round((w.h - 2 * w.pt - 2 * w.bw) / w.lh);
      assert(lines2 >= 2 && w.h > w.minH && w.sw <= w.cw && w.sh <= w.ch && w.ow <= w.pw, `${label}: wrapping/clipping ${JSON.stringify(w)}`);
      return { lines: lines2, h: w.h };
    };
    const w1 = await wrapCheck("100 % text");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const w2 = await wrapCheck("200 % text");
    const big = await read("financial-primary-md-enabled");
    assert(big.minH === `${2 * px("size.control.height.md")}px` && big.fs === `${2 * px("font.size.label.md")}px` && Math.abs(big.height - 2 * px("size.control.height.md")) < 0.01, `200 % scaling: ${big.minH} ${big.fs}`);
    await page.setViewportSize({ width: 320, height: 900 });
    const reflow = await page.evaluate(() => ({ doc: document.scrollingElement.scrollWidth, vw: window.innerWidth, out: [...document.querySelectorAll(".ch-button")].filter((b) => b.getBoundingClientRect().right > window.innerWidth + 0.5).map((b) => b.dataset.testid) }));
    assert(reflow.doc <= reflow.vw && reflow.out.length === 0, `reflow at 320px / 200 %: document ${reflow.doc}px > ${reflow.vw}px or buttons outside the viewport ${reflow.out}`);
    const wrap320 = await el("wrap-md").evaluate((b) => b.scrollWidth <= b.clientWidth && b.scrollHeight <= b.clientHeight);
    assert(wrap320, "wrapped label clipped at 320px / 200 %");
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    lines.push(`wrapping: long label wraps (${w1.lines} lines, ${w1.h}px) and at 200 % text (${w2.lines} lines, ${w2.h}px) with no horizontal or vertical clipping; min-height and typography scale ×2 with the root size; no clipping at 320px`);

    // ---- Hover-incapable devices -------------------------------------------------------------------------------
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage();
    await tp.goto(server.url);
    await tp.waitForFunction(() => window.__ready === true);
    assert(!(await tp.evaluate(() => matchMedia("(hover: hover)").matches)), "emulated touch device should report hover: none");
    await tp.locator('[data-testid="financial-primary-md-enabled"]').hover();
    assert((await tp.locator('[data-testid="financial-primary-md-enabled"]').evaluate((b) => getComputedStyle(b).textDecorationLine)) === "none", "no underline on hover-incapable devices");
    await tp.locator('[data-testid="financial-tertiary-md-enabled"]').hover();
    assert((await tp.locator('[data-testid="financial-tertiary-md-enabled"]').evaluate((b) => getComputedStyle(b).backgroundColor)) === "rgba(0, 0, 0, 0)", "no tertiary hover background on hover-incapable devices");
    await touch.close();
    lines.push("hover capability: on an emulated touch device (hover: none) there is no underline and no Tertiary hover background");

    // ---- Forced colours ----------------------------------------------------------------------------------------
    await page.emulateMedia({ forcedColors: "active" });
    await reset();
    const sys = await page.evaluate(() => { const p = document.createElement("span"); document.body.append(p); const c = (v) => { p.style.color = v; return getComputedStyle(p).color; }; const r = { gray: c("GrayText"), btext: c("ButtonText"), hl: c("Highlight") }; p.remove(); return r; });
    for (const h of Object.keys(TABLE)) {
      const d = await read(`financial-${h}-md-disabled`);
      assert(d.fg === sys.gray && d.bc === sys.gray && d.bw === `${px("border-width.default")}px`, `forced colours disabled ${h}: ${d.fg} ${d.bc} ${d.bw}`);
      const e = await read(`financial-${h}-md-enabled`);
      assert(e.bw === `${px("border-width.default")}px` && e.bc === sys.btext && Math.abs(e.height - px("size.control.height.md")) < 0.01, `forced colours boundary ${h}: ${e.bw} ${e.bc} ${e.height}`);
      await page.keyboard.press("Shift"); await el(`financial-${h}-md-enabled`).focus();
      const f = await read(`financial-${h}-md-enabled`);
      assert(f.fv && f.outlineStyle === "solid" && f.outlineWidth === `${px("focus.width.indicator")}px` && f.outlineColor === sys.hl, `forced colours focus ${h}: ${f.outlineStyle} ${f.outlineWidth} ${f.outlineColor}`);
      await reset();
    }
    await page.emulateMedia({ forcedColors: "none" });
    lines.push("forced colours (emulated): disabled text and border use GrayText; every hierarchy keeps a ButtonText boundary without changing its height; focus-visible keeps a 3px Highlight outline");
  } finally {
    await browser.close();
    server.close();
    harness.cleanup();
  }
  return lines;
}
