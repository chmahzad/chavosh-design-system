// AUTHORED. Checkbox v1 in Chromium (Playwright 1.56.1): structure and accessible name/description/state, computed
// tokens for selection × state × brand (incl. nested and page-level contexts), glyph structure (never colour alone),
// row target, keyboard (Tab, Space toggles, Enter does not), click targets, indeterminate semantics and form submission,
// disabled (incl. <fieldset disabled>), select-all composition, wrapping, 200 % text, 320px reflow, hover-incapable
// devices and forced colours. Expected values come from the Checkbox architecture token table (§4) resolved through the
// generated DTCG — independent of checkbox.css. Automated evidence only; not an accessibility-conformance claim.
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

// Checkbox architecture §4: [box fill, box border, glyph (null = none), label] per selection × state.
const TABLE = {
  unchecked: { default: ["surface.default", "border.input", null, "text.default"], hover: ["surface.default", "border.strong", null, "text.default"], focus: ["surface.default", "border.input", null, "text.default"], disabled: ["surface.disabled", "border.disabled", null, "text.disabled"] },
  checked: { default: ["control.checked", "control.checked", "icon.inverse", "text.default"], hover: ["control.checked-hover", "control.checked-hover", "icon.inverse", "text.default"], focus: ["control.checked", "control.checked", "icon.inverse", "text.default"], disabled: ["surface.disabled", "border.disabled", "icon.disabled", "text.disabled"] },
};
TABLE.indeterminate = TABLE.checked;
const GLYPH = { unchecked: "none", checked: "check", indeterminate: "dash" };
const BRAND_OF_CTX = { financial: "financial", invest: "invest", "fin-in-inv": "financial", "inv-in-fin": "invest" };

const READ = (input) => {
  const row = input.closest(".ch-checkbox");
  const box = row.querySelector(".ch-checkbox__box");
  const label = row.querySelector(".ch-checkbox__label");
  const b = getComputedStyle(box), r = getComputedStyle(row), l = getComputedStyle(label);
  const check = row.querySelector(".ch-checkbox__check"), dash = row.querySelector(".ch-checkbox__dash");
  const vis = (el) => getComputedStyle(el).display !== "none";
  const glyph = vis(check) && !vis(dash) ? "check" : vis(dash) && !vis(check) ? "dash" : !vis(check) && !vis(dash) ? "none" : "both";
  const br = box.getBoundingClientRect(), rr = row.getBoundingClientRect(), svg = row.querySelector("svg").getBoundingClientRect();
  return {
    bg: b.backgroundColor, bc: b.borderTopColor, bw: b.borderTopWidth, radius: b.borderTopLeftRadius, boxW: br.width, boxH: br.height,
    glyph, stroke: getComputedStyle(row.querySelector(".ch-checkbox__glyph")).stroke, svgW: svg.width,
    label: l.color, fs: l.fontSize, lh: l.lineHeight, ff: r.fontFamily, fw: r.fontWeight,
    minH: r.minHeight, rowH: rr.height, pt: r.paddingTop, gap: r.columnGap, cursor: r.cursor,
    outlineStyle: b.outlineStyle, outlineWidth: b.outlineWidth, outlineColor: b.outlineColor, shadow: b.boxShadow,
    fv: input.matches(":focus-visible"), checked: input.checked, ind: input.indeterminate, boxTopOffset: br.top - rr.top,
  };
};

async function buildCheckboxHarness() {
  const outDir = mkdtempSync(join(tmpdir(), "ch-checkbox-harness-"));
  await build({ root: join(HERE, "checkbox-harness"), base: "./", logLevel: "silent", build: { outDir, emptyOutDir: true, minify: false } });
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

export async function run() {
  const lines = [];
  const harness = await buildCheckboxHarness();
  const server = await serve(harness.outDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(server.url);
    await page.waitForFunction(() => window.__ready === true);
    const el = (id) => page.locator(`[data-testid="${id}"]`);
    const read = (id) => el(id).evaluate(READ);
    const row = (id) => page.locator(`.ch-checkbox:has([data-testid="${id}"])`);
    const ax = async (id) => page.accessibility.snapshot({ root: await el(id).elementHandle(), interestingOnly: false });

    // ---- Structure and accessibility tree ------------------------------------------------------------------------
    const def = await el("default").evaluate((i) => ({ tag: i.tagName, type: i.type, root: i.closest("label")?.className, role: i.getAttribute("role"), tab: i.getAttribute("tabindex"), name: i.labels[0] === i.closest("label"), hidden: i.parentElement.querySelector(".ch-checkbox__box").getAttribute("aria-hidden") }));
    const formName = await page.evaluate(() => ({ def: document.querySelector('[data-testid="default"]').hasAttribute("name"), hidden: document.querySelector('[data-testid="hidden"]').hasAttribute("name"), native: document.querySelector('[data-testid="native"]').getAttribute("name") }));
    assert(formName.def === false && formName.hidden === false && formName.native === "pref", `the form-field name attribute is only the consumer's native \`name\` prop, never derived from the label ${JSON.stringify(formName)}`);
    assert(def.tag === "INPUT" && def.type === "checkbox" && def.root === "ch-checkbox" && def.role === null && def.tab === null && def.name && def.hidden === "true", `structure ${JSON.stringify(def)}`);
    const a1 = await ax("support");
    const node = (n) => (!n ? null : n.role === "checkbox" ? n : (n.children || []).map(node).find(Boolean));
    const cb = node(a1);
    assert(cb && cb.name === "Email" && cb.description === "Extra description Statements and account notices" && cb.checked === false, `name/description ${JSON.stringify(cb)}`);
    const hid = node(await ax("hidden"));
    assert(hid && hid.name === "Select transaction 12 Sep, $120.00", `hidden label still names the checkbox ${JSON.stringify(hid)}`);
    const hidBox = await el("hidden").evaluate((i) => { const t = i.closest(".ch-checkbox").querySelector(".ch-checkbox__text").getBoundingClientRect(); return { w: t.width, h: t.height, rowH: i.closest(".ch-checkbox").getBoundingClientRect().height }; });
    assert(hidBox.w <= 1 && hidBox.h <= 1 && hidBox.rowH >= px("size.touch-target.min") - 0.01, `hideLabel visually hides the text, keeps the 44px row ${JSON.stringify(hidBox)}`);
    const mixed = node(await ax("financial-indeterminate-enabled"));
    assert(mixed && mixed.checked === "mixed", `indeterminate is exposed as mixed ${JSON.stringify(mixed)}`);
    const nat = await el("native").evaluate((i) => ({ id: i.id, name: i.name, value: i.value, form: i.form && i.form.id, title: i.title, req: i.required, rootCls: i.closest(".ch-checkbox").className, inputCls: i.className }));
    assert(nat.id === "native-id" && nat.name === "pref" && nat.value === "marketing" && nat.form === "f1" && nat.title === "Marketing" && nat.req && nat.rootCls === "ch-checkbox consumer-class" && nat.inputCls === "ch-checkbox__input", `passthrough ${JSON.stringify(nat)}`);
    assert(await page.evaluate(() => window.__cbRef instanceof HTMLInputElement && window.__cbRef.type === "checkbox"), "ref must reach the native <input>");
    await el("submit").click();
    assert((await page.evaluate(() => window.__submitted)) === null, "a required, unchecked checkbox blocks native form submission");
    await el("native").click();
    await el("submit").click();
    const submitted = await page.evaluate(() => window.__submitted);
    assert(JSON.stringify(submitted) === JSON.stringify(["marketing", "sms"]), `form submits checked values only; indeterminate is not a submitted value (${JSON.stringify(submitted)})`);
    lines.push("structure: native <input type=checkbox> inside a wrapping <label class=ch-checkbox>, no role/tabindex override, box aria-hidden; accessible name = label text only, description = consumer aria-describedby + supporting text; hideLabel keeps the name (text 1×1px, row still 44px); indeterminate exposed as checked=mixed and never submitted; native required blocks submission until checked; native attributes and ref reach the <input>, className the row; the form-field name attribute is only the consumer's `name` prop (absent when not passed, never derived from the label)");

    // ---- Computed tokens: selection × state × brand -------------------------------------------------------------
    const checkState = async (id, sel, state, brand) => {
      const r = await read(id);
      const [bg, bc, glyph, label] = TABLE[sel][state];
      const where = `${id} [${state}]`;
      assert(r.bg === col(bg, brand) && r.bc === col(bc, brand) && r.bw === `${px("border-width.strong")}px`, `${where}: box ${r.bg} / ${r.bc} ${r.bw} ≠ ${col(bg, brand)} / ${col(bc, brand)}`);
      assert(r.glyph === GLYPH[sel] && (glyph === null || r.stroke === col(glyph, brand)), `${where}: glyph ${r.glyph} ${r.stroke}`);
      assert(r.boxW === px("size.control.indicator") && r.boxH === px("size.control.indicator") && r.radius === `${px("radius.sm")}px` && Math.abs(r.svgW - px("size.control.indicator")) < 0.01, `${where}: box ${r.boxW}×${r.boxH} r${r.radius} glyph ${r.svgW}`);
      assert(r.label === col(label, brand) && r.fs === `${px("font.size.body.md")}px` && r.lh === `${px("font.line-height.body.md")}px` && r.ff === "Inter, system-ui, sans-serif" && r.fw === String(resolve("font.weight.regular", "financial")), `${where}: label ${r.label} ${r.fs}/${r.lh} ${r.fw}`);
      assert(r.minH === `${px("size.touch-target.min")}px` && Math.abs(r.rowH - px("size.touch-target.min")) < 0.01 && r.pt === `${px("space.component.sm")}px` && r.gap === `${px("space.gap.md")}px`, `${where}: row ${r.minH} ${r.rowH} ${r.pt} ${r.gap}`);
      assert(Math.abs(r.boxTopOffset - (px("space.component.sm") + (px("font.line-height.body.md") - px("size.control.indicator")) / 2)) < 0.01, `${where}: box not aligned to the first line (${r.boxTopOffset})`);
      assert(r.cursor === (state === "disabled" ? "default" : "pointer"), `${where}: cursor ${r.cursor}`);
      const focus = state === "focus";
      assert(r.fv === focus && (r.outlineStyle === "solid") === focus, `${where}: focus-visible ${r.fv} outline ${r.outlineStyle}`);
      if (focus) {
        const iw = px("focus.width.indicator"), ow = px("focus.width.outer");
        assert(r.outlineWidth === `${iw}px` && r.outlineColor === col("focus.indicator", brand), `${where}: indicator ${r.outlineWidth} ${r.outlineColor}`);
        assert(r.shadow === `${col("focus.outer", brand)} 0px 0px 0px ${iw + ow}px`, `${where}: outer ring ${r.shadow}`);
      } else assert(r.shadow === "none", `${where}: unexpected box-shadow ${r.shadow}`);
    };
    const reset = async () => { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement && document.activeElement.blur()); };
    let n = 0;
    for (const ctx of Object.keys(BRAND_OF_CTX)) {
      const brand = BRAND_OF_CTX[ctx];
      for (const sel of Object.keys(GLYPH)) {
        const id = `${ctx}-${sel}-enabled`, did = `${ctx}-${sel}-disabled`;
        await reset(); await checkState(id, sel, "default", brand); n++;
        await row(id).locator(".ch-checkbox__label").hover(); await checkState(id, sel, "hover", brand); n++;
        await el(id).hover(); /* the transparent native input covers the box */ await checkState(id, sel, "hover", brand); n++;
        await reset(); await page.keyboard.press("Shift"); await el(id).focus(); await checkState(id, sel, "focus", brand); n++;
        await reset(); await checkState(did, sel, "disabled", brand); n++;
        await row(did).locator(".ch-checkbox__label").hover(); await checkState(did, sel, "disabled", brand);
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    await reset(); for (const sel of Object.keys(GLYPH)) { await checkState(`financial-${sel}-enabled`, sel, "default", "invest"); n++; }
    await page.evaluate(() => document.documentElement.removeAttribute("data-brand"));
    assert(col("control.checked", "financial") !== col("control.checked", "invest") && col("surface.default", "financial") === col("surface.default", "invest"), "only the selection colours are brand-dependent");
    lines.push(`computed tokens (${browser.version()}): ${n} state checks = unchecked / checked / indeterminate × default / hover (label and box) / focus-visible / disabled × Financial, Invest, Financial-in-Invest, Invest-in-Financial + page-level <html data-brand=invest> — box fill/border (2px), 20px box, radius/sm, glyph structure (none / check / dash) and colour, label colour and body/md typography, 44px row, padding, gap, first-line alignment, cursor, focus rings`);
    lines.push(`brand: control/checked ${col("control.checked", "financial")} → ${col("control.checked", "invest")} (hover ${col("control.checked-hover", "financial")} → ${col("control.checked-hover", "invest")}) through data-brand only; unchecked, disabled and focus colours brand-independent`);

    // ---- Keyboard and pointer --------------------------------------------------------------------------------------
    await reset();
    await el("before").focus();
    await page.keyboard.press("Tab");
    assert(await el("kb-1").evaluate((i) => i === document.activeElement && i.matches(":focus-visible")), "Tab reaches the checkbox with focus-visible");
    await page.keyboard.press("Space");
    assert(await el("kb-1").evaluate((i) => i.checked), "Space toggles on");
    await page.keyboard.press("Enter");
    assert(await el("kb-1").evaluate((i) => i.checked), "Enter must not toggle a checkbox");
    await page.keyboard.press("Space");
    assert(!(await el("kb-1").evaluate((i) => i.checked)), "Space toggles off");
    await page.keyboard.press("Tab");
    assert(await el("kb-2").evaluate((i) => i === document.activeElement), "disabled checkbox is skipped in tab order");
    await reset();
    await row("kb-1").locator(".ch-checkbox__label").click();
    assert(await el("kb-1").evaluate((i) => i.checked && !i.matches(":focus-visible")), "clicking the label toggles; pointer shows no ring");
    await el("kb-1").click(); /* clicking the box = clicking the native input over it */
    assert(!(await el("kb-1").evaluate((i) => i.checked)), "clicking the box toggles");
    const rb = await row("kb-1").boundingBox();
    await page.mouse.click(rb.x + 2, rb.y + 2);
    assert(await el("kb-1").evaluate((i) => i.checked), "the whole row (incl. padding) is the target");
    await row("support").locator(".ch-checkbox__supporting").click();
    assert(await el("support").evaluate((i) => i.checked), "supporting text is part of the row target");
    await row("kb-disabled").click({ force: true });
    assert(!(await el("kb-disabled").evaluate((i) => i.checked)), "disabled never toggles");
    await row("in-disabled-fieldset").click({ force: true });
    const fs = await el("in-disabled-fieldset").evaluate((i) => ({ checked: i.checked, disabled: i.matches(":disabled"), label: getComputedStyle(i.closest(".ch-checkbox").querySelector(".ch-checkbox__label")).color, bg: getComputedStyle(i.nextElementSibling).backgroundColor }));
    assert(fs.checked && fs.disabled && fs.label === col("text.disabled", "financial") && fs.bg === col("surface.disabled", "financial"), `a disabled <fieldset> disables and styles the checkbox ${JSON.stringify(fs)}`);
    assert((await page.evaluate(() => window.__cbChanges)) === 1, "onChange fires once per user toggle");
    lines.push("keyboard/pointer: Tab shows the ring on the box; Space toggles, Enter does not; disabled skipped and never toggles; label, box, row padding and supporting text all toggle (row = target) without a ring; <fieldset disabled> disables and restyles; onChange fires");

    // ---- Select-all composition (indeterminate parent) --------------------------------------------------------------
    const st = async () => page.evaluate(() => ["all", "row-0", "row-1", "row-2"].map((k) => { const i = document.querySelector(`[data-testid="${k}"]`); return `${i.checked ? 1 : 0}${i.indeterminate ? "m" : ""}`; }).join(" "));
    assert((await st()) === "0m 1 0 1", `select-all initial ${await st()}`);
    await row("all").click();
    assert((await st()) === "1 1 1 1", `select-all → all ${await st()}`);
    await row("row-1").click();
    assert((await st()) === "0m 1 0 1", `child change → mixed ${await st()}`);
    const allG = await read("all");
    assert(allG.glyph === "dash" && allG.bg === col("control.checked", "financial"), `mixed parent shows the dash ${JSON.stringify(allG.glyph)}`);
    lines.push("indeterminate: select-all parent shows the dash while 2 of 3 rows are selected, selects all on click, returns to mixed when a row changes — re-synced from the prop after the native click clears it");

    // ---- Wrapping, 200 % text and reflow ---------------------------------------------------------------------------
    const wrapCheck = async (label) => {
      const w = await el("wrap").evaluate((i) => { const row = i.closest(".ch-checkbox"); const t = row.querySelector(".ch-checkbox__text"); const r = row.getBoundingClientRect(); const box = row.querySelector(".ch-checkbox__box").getBoundingClientRect(); const lab = row.querySelector(".ch-checkbox__label").getBoundingClientRect(); return { h: r.height, minH: parseFloat(getComputedStyle(row).minHeight), sw: row.scrollWidth, cw: row.clientWidth, tw: t.scrollWidth <= t.clientWidth, pw: row.parentElement.clientWidth, ow: row.offsetWidth, labLines: Math.round(lab.height / parseFloat(getComputedStyle(row.querySelector(".ch-checkbox__label")).lineHeight)), boxTop: box.top - r.top }; });
      assert(w.labLines >= 2 && w.h > w.minH && w.sw <= w.cw && w.tw && w.ow <= w.pw, `${label}: wrapping/clipping ${JSON.stringify(w)}`);
      return w;
    };
    const w1 = await wrapCheck("100 % text");
    assert(Math.abs(w1.boxTop - (px("space.component.sm") + (px("font.line-height.body.md") - px("size.control.indicator")) / 2)) < 0.01, "box stays on the first line when the label wraps");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const w2 = await wrapCheck("200 % text");
    const big = await read("financial-checked-enabled");
    assert(big.minH === `${2 * px("size.touch-target.min")}px` && big.boxW === 2 * px("size.control.indicator") && big.fs === `${2 * px("font.size.body.md")}px`, `200 % scaling: ${big.minH} ${big.boxW} ${big.fs}`);
    await page.setViewportSize({ width: 320, height: 900 });
    const reflow = await page.evaluate(() => ({ doc: document.scrollingElement.scrollWidth, vw: window.innerWidth, out: [...document.querySelectorAll(".ch-checkbox")].filter((a) => a.getBoundingClientRect().right > window.innerWidth + 0.5).map((a) => a.querySelector("input").dataset.testid), wide: [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5).slice(0, 6).map((e) => `${e.tagName}.${e.className}:${Math.round(e.getBoundingClientRect().right)}`) }));
    assert(reflow.doc <= reflow.vw && reflow.out.length === 0, `reflow at 320px / 200 %: ${JSON.stringify(reflow)}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    lines.push(`wrapping: label wraps (${w1.labLines} lines, row ${w1.h}px) and at 200 % text (${w2.labLines} lines, ${w2.h}px) with the box on the first line and no clipping; box, row target and typography scale ×2 with the root size; no horizontal overflow at 320px / 200 %`);

    // ---- Hover-incapable devices -------------------------------------------------------------------------------------
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage();
    await tp.goto(server.url);
    await tp.waitForFunction(() => window.__ready === true);
    assert(!(await tp.evaluate(() => matchMedia("(hover: hover)").matches)), "emulated touch device should report hover: none");
    await tp.locator('.ch-checkbox:has([data-testid="financial-unchecked-enabled"]) .ch-checkbox__label').hover();
    const th = await tp.locator('[data-testid="financial-unchecked-enabled"]').evaluate((i) => getComputedStyle(i.nextElementSibling).borderTopColor);
    assert(th === col("border.input", "financial"), `no hover border on hover-incapable devices (${th})`);
    await touch.close();
    lines.push("hover capability: on an emulated touch device (hover: none) the box keeps its rest border (no sticky hover)");

    // ---- Forced colours ------------------------------------------------------------------------------------------------
    await page.emulateMedia({ forcedColors: "active" });
    await reset();
    const sys = await page.evaluate(() => { const p = document.createElement("span"); document.body.append(p); const c = (v) => { p.style.color = v; return getComputedStyle(p).color; }; const r = { text: c("CanvasText"), gray: c("GrayText"), hl: c("Highlight") }; p.remove(); return r; });
    for (const sel of Object.keys(GLYPH)) {
      const e = await read(`financial-${sel}-enabled`);
      assert(e.bc === sys.text && e.bw === `${px("border-width.strong")}px` && e.glyph === GLYPH[sel] && (sel === "unchecked" || e.stroke === sys.text), `forced colours ${sel}: ${e.bc} ${e.bw} ${e.glyph} ${e.stroke}`);
      const d = await read(`financial-${sel}-disabled`);
      assert(d.bc === sys.gray && d.label === sys.gray && d.glyph === GLYPH[sel] && (sel === "unchecked" || d.stroke === sys.gray), `forced colours disabled ${sel}: ${d.bc} ${d.label} ${d.stroke}`);
      await page.keyboard.press("Shift"); await el(`financial-${sel}-enabled`).focus();
      const f = await read(`financial-${sel}-enabled`);
      assert(f.fv && f.outlineStyle === "solid" && f.outlineWidth === `${px("focus.width.indicator")}px` && f.outlineColor === sys.hl, `forced colours focus ${sel}: ${f.outlineStyle} ${f.outlineColor}`);
      await reset();
    }
    await page.emulateMedia({ forcedColors: "none" });
    lines.push("forced colours (emulated): box keeps a 2px CanvasText boundary, check/dash drawn in CanvasText (structure unchanged), disabled boundary/glyph/label GrayText, focus-visible keeps a 3px Highlight outline");
  } finally {
    await browser.close();
    server.close();
    harness.cleanup();
  }
  return lines;
}
