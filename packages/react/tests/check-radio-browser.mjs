// AUTHORED. Radio v1 in Chromium (Playwright 1.56.1): structure and accessible name/description/state, computed tokens
// for selection × state × brand (incl. nested and page-level contexts), dot structure (never colour alone), row target,
// NATIVE same-name grouping (single selection, one tab stop, Tab enters at the selected radio, arrow keys move focus and
// selection and skip disabled options, Space selects, no deselection), form submission and required, disabled (incl.
// <fieldset disabled>), wrapping, 200 % text, 320px reflow, hover-incapable devices and forced colours. Expected values
// come from the Radio architecture token mapping (§4) resolved through the generated DTCG — independent of radio.css.
// Automated evidence only; not an accessibility-conformance claim.
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

// Radio architecture §4: [circle surface, border (2px), dot (null = none), label] per selection × state.
const TABLE = {
  unselected: { default: ["surface.default", "border.input", null, "text.default"], hover: ["surface.default", "border.strong", null, "text.default"], focus: ["surface.default", "border.input", null, "text.default"], disabled: ["surface.disabled", "border.disabled", null, "text.disabled"] },
  selected: { default: ["surface.default", "control.checked", "control.checked", "text.default"], hover: ["surface.default", "control.checked-hover", "control.checked-hover", "text.default"], focus: ["surface.default", "control.checked", "control.checked", "text.default"], disabled: ["surface.disabled", "border.disabled", "icon.disabled", "text.disabled"] },
};
const BRAND_OF_CTX = { financial: "financial", invest: "invest", "fin-in-inv": "financial", "inv-in-fin": "invest" };

const READ = (input) => {
  const row = input.closest(".ch-radio");
  const circle = row.querySelector(".ch-radio__circle"), dot = row.querySelector(".ch-radio__dot"), label = row.querySelector(".ch-radio__label");
  const c = getComputedStyle(circle), d = getComputedStyle(dot), r = getComputedStyle(row), l = getComputedStyle(label);
  const cr = circle.getBoundingClientRect(), dr = dot.getBoundingClientRect(), rr = row.getBoundingClientRect();
  return {
    bg: c.backgroundColor, bc: c.borderTopColor, bw: c.borderTopWidth, radius: c.borderTopLeftRadius, w: cr.width, h: cr.height,
    dot: d.display !== "none", dotColor: d.borderTopColor, dotW: dr.width, dotH: dr.height, dotRadius: d.borderTopLeftRadius,
    dotCx: dr.left + dr.width / 2 - (cr.left + cr.width / 2), dotCy: dr.top + dr.height / 2 - (cr.top + cr.height / 2),
    label: l.color, fs: l.fontSize, lh: l.lineHeight, ff: r.fontFamily, fw: r.fontWeight,
    minH: r.minHeight, rowH: rr.height, pt: r.paddingTop, gap: r.columnGap, cursor: r.cursor,
    outlineStyle: c.outlineStyle, outlineWidth: c.outlineWidth, outlineColor: c.outlineColor, shadow: c.boxShadow,
    fv: input.matches(":focus-visible"), checked: input.checked, top: cr.top - rr.top,
  };
};

async function buildRadioHarness() {
  const outDir = mkdtempSync(join(tmpdir(), "ch-radio-harness-"));
  await build({ root: join(HERE, "radio-harness"), base: "./", logLevel: "silent", build: { outDir, emptyOutDir: true, minify: false } });
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

export async function run() {
  const lines = [];
  const harness = await buildRadioHarness();
  const server = await serve(harness.outDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(server.url);
    await page.waitForFunction(() => window.__ready === true);
    const el = (id) => page.locator(`[data-testid="${id}"]`);
    const read = (id) => el(id).evaluate(READ);
    const row = (id) => page.locator(`.ch-radio:has([data-testid="${id}"])`);
    const ax = async (id) => page.accessibility.snapshot({ root: await el(id).elementHandle(), interestingOnly: false });
    const node = (n) => (!n ? null : n.role === "radio" ? n : (n.children || []).map(node).find(Boolean));
    const active = () => page.evaluate(() => document.activeElement?.dataset?.testid ?? null);
    const checkedIn = (name) => page.evaluate((n) => [...document.querySelectorAll(`input[name="${n}"]`)].filter((i) => i.checked).map((i) => i.dataset.testid), name);

    // ---- Structure and accessibility tree ------------------------------------------------------------------------
    const def = await el("default").evaluate((i) => ({ tag: i.tagName, type: i.type, root: i.closest("label")?.className, role: i.getAttribute("role"), tab: i.getAttribute("tabindex"), labelled: i.labels[0] === i.closest("label"), hidden: i.parentElement.querySelector(".ch-radio__circle").getAttribute("aria-hidden"), name: i.hasAttribute("name") }));
    assert(def.tag === "INPUT" && def.type === "radio" && def.root === "ch-radio" && def.role === null && def.tab === null && def.labelled && def.hidden === "true" && def.name === false, `structure ${JSON.stringify(def)}`);
    const rd = node(await ax("support"));
    assert(rd && rd.name === "Quarterly" && rd.description === "Extra description Every three months" && rd.checked === false, `name/description ${JSON.stringify(rd)}`);
    const nat = await el("native").evaluate((i) => ({ id: i.id, name: i.getAttribute("name"), value: i.value, title: i.title, req: i.required, rootCls: i.closest(".ch-radio").className, inputCls: i.className }));
    assert(nat.id === "native-id" && nat.name === "freq-native" && nat.value === "annually" && nat.title === "Annually" && nat.req && nat.rootCls === "ch-radio consumer-class" && nat.inputCls === "ch-radio__input", `passthrough ${JSON.stringify(nat)}`);
    assert(await page.evaluate(() => window.__rdRef instanceof HTMLInputElement && window.__rdRef.type === "radio"), "ref must reach the native <input>");
    lines.push("structure: native <input type=radio> inside a wrapping <label class=ch-radio>, no role/tabindex override, circle aria-hidden; accessible name = label text only, description = consumer aria-describedby + supporting text; the form-field name attribute is only the consumer's `name` prop (absent when not passed, never derived from the label); native attributes and ref reach the <input>, className the row");

    // ---- Computed tokens: selection × state × brand -------------------------------------------------------------
    const checkState = async (id, sel, state, brand) => {
      const r = await read(id);
      const [bg, bc, dot, label] = TABLE[sel][state];
      const where = `${id} [${state}]`;
      const ind = px("size.control.indicator");
      assert(r.bg === col(bg, brand) && r.bc === col(bc, brand) && r.bw === `${px("border-width.strong")}px`, `${where}: circle ${r.bg} / ${r.bc} ${r.bw} ≠ ${col(bg, brand)} / ${col(bc, brand)}`);
      assert(r.w === ind && r.h === ind && r.radius === `${px("radius.full")}px`, `${where}: circle ${r.w}×${r.h} r${r.radius}`);
      assert(r.dot === (dot !== null), `${where}: dot ${r.dot}`);
      if (dot) assert(r.dotColor === col(dot, brand) && Math.abs(r.dotW - 0.4 * ind) < 0.01 && Math.abs(r.dotH - 0.4 * ind) < 0.01 && Math.abs(r.dotCx) < 0.01 && Math.abs(r.dotCy) < 0.01 && r.dotRadius === `${px("radius.full")}px`, `${where}: dot ${r.dotColor} ${r.dotW}×${r.dotH} offset ${r.dotCx},${r.dotCy}`);
      assert(r.label === col(label, brand) && r.fs === `${px("font.size.body.md")}px` && r.lh === `${px("font.line-height.body.md")}px` && r.ff === "Inter, system-ui, sans-serif" && r.fw === String(resolve("font.weight.regular", "financial")), `${where}: label ${r.label} ${r.fs}/${r.lh} ${r.fw}`);
      assert(r.minH === `${px("size.touch-target.min")}px` && Math.abs(r.rowH - px("size.touch-target.min")) < 0.01 && r.pt === `${px("space.component.sm")}px` && r.gap === `${px("space.gap.md")}px`, `${where}: row ${r.minH} ${r.rowH} ${r.pt} ${r.gap}`);
      assert(Math.abs(r.top - (px("space.component.sm") + (px("font.line-height.body.md") - ind) / 2)) < 0.01, `${where}: circle not aligned to the first line (${r.top})`);
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
      for (const sel of Object.keys(TABLE)) {
        const id = `${ctx}-${sel}-enabled`, did = `${ctx}-${sel}-disabled`;
        await reset(); await checkState(id, sel, "default", brand); n++;
        await row(id).locator(".ch-radio__label").hover(); await checkState(id, sel, "hover", brand); n++;
        await el(id).hover(); /* the transparent native input covers the circle */ await checkState(id, sel, "hover", brand); n++;
        await reset(); await page.keyboard.press("Shift"); await el(id).focus(); await checkState(id, sel, "focus", brand); n++;
        await reset(); await checkState(did, sel, "disabled", brand); n++;
        await row(did).locator(".ch-radio__label").hover(); await checkState(did, sel, "disabled", brand);
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    await reset(); for (const sel of Object.keys(TABLE)) { await checkState(`financial-${sel}-enabled`, sel, "default", "invest"); n++; }
    await page.evaluate(() => document.documentElement.removeAttribute("data-brand"));
    lines.push(`computed tokens (${browser.version()}): ${n} state checks = unselected / selected × default / hover (label and circle) / focus-visible / disabled × Financial, Invest, Financial-in-Invest, Invest-in-Financial + page-level <html data-brand=invest> — circle surface/border (2px), 20px circle, radius/full, dot presence (selected only, incl. disabled), dot 0.4 × indicator centred, dot colour, label body/md, 44px row, padding, gap, first-line alignment, cursor, circular focus rings`);
    lines.push(`brand: selected ring/dot ${col("control.checked", "financial")} → ${col("control.checked", "invest")} through data-brand only; unselected, disabled and focus colours brand-independent`);

    // ---- Native grouping and keyboard ---------------------------------------------------------------------------------
    await reset();
    await el("before").focus();
    await page.keyboard.press("Tab");
    assert((await active()) === "g-monthly" && (await el("g-monthly").evaluate((i) => i.matches(":focus-visible"))) && (await checkedIn("frequency")).length === 0, "Tab enters a group with no selection at its first enabled radio, without selecting it");
    await page.keyboard.press("Tab");
    assert((await active()) === "after", "a radio group is one tab stop");
    await page.keyboard.press("Shift+Tab");
    const back = await active();
    assert(["g-monthly", "g-quarterly", "g-annually"].includes(back) && (await checkedIn("frequency")).length === 0, `Shift+Tab re-enters the group at one enabled radio without selecting (got ${back}; the entry radio is the browser's choice)`);
    await page.keyboard.press("Shift+Tab");
    assert((await active()) === "before", "the group is one tab stop in reverse too");
    await page.keyboard.press("Tab");
    assert((await active()) === "g-monthly", "Tab re-enters at the first enabled radio");
    await page.keyboard.press("Space");
    assert(JSON.stringify(await checkedIn("frequency")) === '["g-monthly"]', "Space selects the focused radio");
    await page.keyboard.press("ArrowUp");
    assert((await active()) === "g-annually" && JSON.stringify(await checkedIn("frequency")) === '["g-annually"]', "ArrowUp moves focus and selection and wraps from first to last");
    await page.keyboard.press("ArrowDown");
    assert((await active()) === "g-monthly" && JSON.stringify(await checkedIn("frequency")) === '["g-monthly"]', "ArrowDown moves focus and selection and wraps from last to first");
    await page.keyboard.press("ArrowDown");
    assert((await active()) === "g-quarterly" && JSON.stringify(await checkedIn("frequency")) === '["g-quarterly"]', "ArrowDown moves focus and selection together (single selection per name)");
    await page.keyboard.press("ArrowRight");
    assert((await active()) === "g-annually" && JSON.stringify(await checkedIn("frequency")) === '["g-annually"]', "arrow keys skip the disabled option");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    assert((await active()) === "g-monthly" && JSON.stringify(await checkedIn("frequency")) === '["g-monthly"]', "ArrowUp / ArrowLeft move backwards, skipping the disabled option");
    await page.keyboard.press("Space");
    assert(JSON.stringify(await checkedIn("frequency")) === '["g-monthly"]', "Space on the selected radio does not deselect it");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    assert((await active()) === "c-percent", "Tab enters a group at its selected radio");
    await page.keyboard.press("Enter");
    assert(JSON.stringify(await checkedIn("contribution")) === '["c-percent"]', "Enter does not change the selection");
    await reset();
    await row("g-quarterly").locator(".ch-radio__label").click();
    assert(JSON.stringify(await checkedIn("frequency")) === '["g-quarterly"]' && !(await el("g-quarterly").evaluate((i) => i.matches(":focus-visible"))), "clicking a label selects it and deselects the others; pointer shows no ring");
    await row("g-quarterly").locator(".ch-radio__label").click();
    assert(JSON.stringify(await checkedIn("frequency")) === '["g-quarterly"]', "clicking the selected radio again does not deselect it");
    const rb = await row("g-annually").boundingBox();
    await page.mouse.click(rb.x + 2, rb.y + 2);
    assert(JSON.stringify(await checkedIn("frequency")) === '["g-annually"]', "the whole row (incl. padding) is the target");
    await row("g-disabled").click({ force: true });
    assert(JSON.stringify(await checkedIn("frequency")) === '["g-annually"]', "a disabled option never becomes selected");
    const mixed = node(await ax("g-annually"));
    assert(mixed && mixed.checked === true, `selected radio exposes checked=true ${JSON.stringify(mixed)}`);
    lines.push("native grouping/keyboard: same name = one group with single selection and one tab stop; Tab enters at the first enabled radio when none is selected (Shift+Tab re-enters at an enabled radio chosen by the browser), otherwise at the selected one; Space selects; ArrowDown/Right and ArrowUp/Left move focus AND selection, wrap, and skip disabled options; Enter and a second click never deselect; label and row padding select; disabled options never select");

    // ---- Forms and disabled -------------------------------------------------------------------------------------------
    await el("submit").click();
    assert((await page.evaluate(() => window.__rdSubmitted)) === undefined, "a required group with no selection blocks native form submission");
    await row("del-post").locator(".ch-radio__label").click();
    await el("submit").click();
    assert((await page.evaluate(() => window.__rdSubmitted)) === "post", "the selected radio's value is submitted under the native name");
    await row("in-disabled-fieldset").click({ force: true });
    const fs = await el("in-disabled-fieldset").evaluate((i) => ({ checked: i.checked, disabled: i.matches(":disabled"), label: getComputedStyle(i.closest(".ch-radio").querySelector(".ch-radio__label")).color, bg: getComputedStyle(i.nextElementSibling).backgroundColor, dot: getComputedStyle(i.nextElementSibling.firstElementChild).display }));
    assert(fs.checked && fs.disabled && fs.label === col("text.disabled", "financial") && fs.bg === col("surface.disabled", "financial") && fs.dot !== "none", `a disabled <fieldset> disables and styles the radio, keeping the dot ${JSON.stringify(fs)}`);
    await el("native").click();
    assert((await page.evaluate(() => window.__rdChanges)) === 1, "onChange fires");
    lines.push("forms: a required group with no selection blocks submission; the selected value is submitted under the consumer's name; <fieldset disabled> disables and restyles (dot kept); onChange fires");

    // ---- Wrapping, 200 % text and reflow ---------------------------------------------------------------------------
    const wrapCheck = async (label) => {
      const w = await el("wrap").evaluate((i) => { const row = i.closest(".ch-radio"); const r = row.getBoundingClientRect(); const c = row.querySelector(".ch-radio__circle").getBoundingClientRect(); const lab = row.querySelector(".ch-radio__label"); return { h: r.height, minH: parseFloat(getComputedStyle(row).minHeight), sw: row.scrollWidth, cw: row.clientWidth, pw: row.parentElement.clientWidth, ow: row.offsetWidth, labLines: Math.round(lab.getBoundingClientRect().height / parseFloat(getComputedStyle(lab).lineHeight)), top: c.top - r.top }; });
      assert(w.labLines >= 2 && w.h > w.minH && w.sw <= w.cw && w.ow <= w.pw, `${label}: wrapping/clipping ${JSON.stringify(w)}`);
      return w;
    };
    const w1 = await wrapCheck("100 % text");
    assert(Math.abs(w1.top - (px("space.component.sm") + (px("font.line-height.body.md") - px("size.control.indicator")) / 2)) < 0.01, "circle stays on the first line when the label wraps");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const w2 = await wrapCheck("200 % text");
    const big = await read("financial-selected-enabled");
    assert(big.minH === `${2 * px("size.touch-target.min")}px` && big.w === 2 * px("size.control.indicator") && Math.abs(big.dotW - 0.8 * px("size.control.indicator")) < 0.01 && big.fs === `${2 * px("font.size.body.md")}px`, `200 % scaling: ${big.minH} ${big.w} dot ${big.dotW} ${big.fs}`);
    await page.setViewportSize({ width: 320, height: 900 });
    const reflow = await page.evaluate(() => ({ doc: document.scrollingElement.scrollWidth, vw: window.innerWidth, out: [...document.querySelectorAll(".ch-radio")].filter((a) => a.getBoundingClientRect().right > window.innerWidth + 0.5).map((a) => a.querySelector("input").dataset.testid) }));
    assert(reflow.doc <= reflow.vw && reflow.out.length === 0, `reflow at 320px / 200 %: ${JSON.stringify(reflow)}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    lines.push(`wrapping: label wraps (${w1.labLines} lines, row ${w1.h}px) and at 200 % text (${w2.labLines} lines, ${w2.h}px) with the circle on the first line and no clipping; circle, dot (proportional), row target and typography scale ×2 with the root size; no horizontal overflow at 320px / 200 %`);

    // ---- Hover-incapable devices -------------------------------------------------------------------------------------
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage();
    await tp.goto(server.url);
    await tp.waitForFunction(() => window.__ready === true);
    assert(!(await tp.evaluate(() => matchMedia("(hover: hover)").matches)), "emulated touch device should report hover: none");
    await tp.locator('.ch-radio:has([data-testid="financial-unselected-enabled"]) .ch-radio__label').hover();
    const th = await tp.locator('[data-testid="financial-unselected-enabled"]').evaluate((i) => getComputedStyle(i.nextElementSibling).borderTopColor);
    assert(th === col("border.input", "financial"), `no hover border on hover-incapable devices (${th})`);
    await touch.close();
    lines.push("hover capability: on an emulated touch device (hover: none) the circle keeps its rest border (no sticky hover)");

    // ---- Forced colours ------------------------------------------------------------------------------------------------
    await page.emulateMedia({ forcedColors: "active" });
    await reset();
    const sys = await page.evaluate(() => { const p = document.createElement("span"); document.body.append(p); const c = (v) => { p.style.color = v; return getComputedStyle(p).color; }; const r = { text: c("CanvasText"), gray: c("GrayText"), hl: c("Highlight") }; p.remove(); return r; });
    for (const sel of Object.keys(TABLE)) {
      const e = await read(`financial-${sel}-enabled`);
      assert(e.bc === sys.text && e.bw === `${px("border-width.strong")}px` && e.dot === (sel === "selected") && (sel === "unselected" || (e.dotColor === sys.text && Math.abs(e.dotW - 0.4 * px("size.control.indicator")) < 0.01)), `forced colours ${sel}: ${e.bc} ${e.bw} dot ${e.dot} ${e.dotColor} ${e.dotW}`);
      const d = await read(`financial-${sel}-disabled`);
      assert(d.bc === sys.gray && d.label === sys.gray && d.dot === (sel === "selected") && (sel === "unselected" || d.dotColor === sys.gray), `forced colours disabled ${sel}: ${d.bc} ${d.label} ${d.dotColor}`);
      await page.keyboard.press("Shift"); await el(`financial-${sel}-enabled`).focus();
      const f = await read(`financial-${sel}-enabled`);
      assert(f.fv && f.outlineStyle === "solid" && f.outlineWidth === `${px("focus.width.indicator")}px` && f.outlineColor === sys.hl, `forced colours focus ${sel}: ${f.outlineStyle} ${f.outlineColor}`);
      await reset();
    }
    await page.emulateMedia({ forcedColors: "none" });
    lines.push("forced colours (emulated): circle keeps a 2px CanvasText boundary; the border-drawn dot stays visible in CanvasText at full size; disabled boundary/dot/label GrayText; focus-visible keeps a 3px Highlight outline");
  } finally {
    await browser.close();
    server.close();
    harness.cleanup();
  }
  return lines;
}
