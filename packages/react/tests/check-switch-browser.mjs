// AUTHORED. Switch v1 in Chromium (Playwright 1.56.1): structure, role=switch and checked-state exposure, accessible
// name/description, computed tokens for checked × state × brand (incl. nested and page-level contexts) with the approved
// intrinsic geometry (44×24 track, 16px thumb, 4px inset, position = state), RTL mirroring, row target, keyboard (Tab,
// Space toggles, Enter does not), controlled and uncontrolled use, native name/value and form submission, disabled
// (incl. <fieldset disabled>), motion (150ms, reduced motion 0ms, state commits immediately), wrapping, 200 % text,
// 320px reflow, hover-incapable devices and forced colours. Expected values come from the Switch architecture token
// mapping (§4) resolved through the generated DTCG — independent of switch.css. Colour/geometry states are read with
// reduced motion emulated (instant), motion is tested separately. Automated evidence only; not a conformance claim.
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

// Switch architecture §4: [track fill, track border (2px), thumb, thumb position (px from the track's outer left edge)].
const TABLE = {
  off: { default: ["surface.default", "border.input", "icon.subtle", 4], hover: ["surface.default", "border.strong", "icon.default", 4], focus: ["surface.default", "border.input", "icon.subtle", 4], disabled: ["surface.disabled", "border.disabled", "icon.disabled", 4] },
  on: { default: ["control.checked", "control.checked", "icon.inverse", 24], hover: ["control.checked-hover", "control.checked-hover", "icon.inverse", 24], focus: ["control.checked", "control.checked", "icon.inverse", 24], disabled: ["surface.disabled", "border.disabled", "icon.disabled", 24] },
};
const BRAND_OF_CTX = { financial: "financial", invest: "invest", "fin-in-inv": "financial", "inv-in-fin": "invest" };

const READ = (input) => {
  const row = input.closest(".ch-switch");
  const track = row.querySelector(".ch-switch__track"), thumb = row.querySelector(".ch-switch__thumb"), label = row.querySelector(".ch-switch__label"), text = row.querySelector(".ch-switch__text");
  const t = getComputedStyle(track), th = getComputedStyle(thumb), r = getComputedStyle(row), l = getComputedStyle(label);
  const tr = track.getBoundingClientRect(), hr = thumb.getBoundingClientRect(), rr = row.getBoundingClientRect(), xr = text.getBoundingClientRect();
  return {
    bg: t.backgroundColor, bc: t.borderTopColor, bw: t.borderTopWidth, radius: t.borderTopLeftRadius, w: tr.width, h: tr.height,
    thumb: th.borderTopColor, thumbW: hr.width, thumbH: hr.height, thumbX: hr.left - tr.left, thumbY: hr.top - tr.top,
    label: l.color, fs: l.fontSize, lh: l.lineHeight, ff: r.fontFamily, fw: r.fontWeight,
    minH: r.minHeight, rowH: rr.height, pt: r.paddingTop, gap: r.columnGap, cursor: r.cursor, textFirst: xr.right <= tr.left, trailing: Math.abs(rr.right - tr.right) < 0.5,
    outlineStyle: t.outlineStyle, outlineWidth: t.outlineWidth, outlineColor: t.outlineColor, shadow: t.boxShadow,
    fv: input.matches(":focus-visible"), checked: input.checked, top: tr.top - rr.top,
    dur: `${t.transitionDuration} | ${th.transitionDuration}`, ease: `${t.transitionTimingFunction} | ${th.transitionTimingFunction}`,
  };
};

async function buildSwitchHarness() {
  const outDir = mkdtempSync(join(tmpdir(), "ch-switch-harness-"));
  await build({ root: join(HERE, "switch-harness"), base: "./", logLevel: "silent", build: { outDir, emptyOutDir: true, minify: false } });
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

export async function run() {
  const lines = [];
  const harness = await buildSwitchHarness();
  const server = await serve(harness.outDir);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    await page.goto(server.url);
    await page.waitForFunction(() => window.__ready === true);
    const el = (id) => page.locator(`[data-testid="${id}"]`);
    const read = (id) => el(id).evaluate(READ);
    const row = (id) => page.locator(`.ch-switch:has([data-testid="${id}"])`);
    const ax = async (id) => page.accessibility.snapshot({ root: await el(id).elementHandle(), interestingOnly: false });
    const node = (n) => (!n ? null : n.role === "switch" ? n : (n.children || []).map(node).find(Boolean));

    // ---- Structure and accessibility tree ------------------------------------------------------------------------
    const def = await el("default").evaluate((i) => ({ tag: i.tagName, type: i.type, role: i.getAttribute("role"), ariaChecked: i.getAttribute("aria-checked"), root: i.closest("label")?.className, tab: i.getAttribute("tabindex"), labelled: i.labels[0] === i.closest("label"), hidden: i.parentElement.querySelector(".ch-switch__track").getAttribute("aria-hidden"), name: i.hasAttribute("name") }));
    assert(def.tag === "INPUT" && def.type === "checkbox" && def.role === "switch" && def.ariaChecked === null && def.root === "ch-switch" && def.tab === null && def.labelled && def.hidden === "true" && def.name === false, `structure ${JSON.stringify(def)}`);
    const sw = node(await ax("support"));
    assert(sw && sw.role === "switch" && sw.name === "Marketing messages" && sw.description === "Extra description Offers and product news" && sw.checked === false, `role/name/description/state ${JSON.stringify(sw)}`);
    const on = node(await ax("financial-on-enabled"));
    assert(on && on.checked === true, `checked state exposed ${JSON.stringify(on)}`);
    const nat = await el("native").evaluate((i) => ({ id: i.id, name: i.getAttribute("name"), value: i.value, title: i.title, rootCls: i.closest(".ch-switch").className, inputCls: i.className }));
    assert(nat.id === "native-id" && nat.name === "statementEmail" && nat.value === "yes" && nat.title === "Statement email" && nat.rootCls === "ch-switch consumer-class" && nat.inputCls === "ch-switch__input", `passthrough ${JSON.stringify(nat)}`);
    assert(await page.evaluate(() => window.__swRef instanceof HTMLInputElement && window.__swRef.getAttribute("role") === "switch"), "ref must reach the native <input>");
    lines.push("structure: native <input type=checkbox role=switch> (no aria-checked emulation) inside a wrapping <label class=ch-switch>, track aria-hidden, no tabindex override; accessibility tree role=switch with checked false/true from the native state; name = label text only, description = consumer aria-describedby + supporting text; the form-field name attribute is only the consumer's `name` prop (absent when not passed); native attributes and ref reach the <input>, className the row");

    // ---- Computed tokens and geometry: checked × state × brand -------------------------------------------------------
    const checkState = async (id, c, state, brand) => {
      const r = await read(id);
      const [bg, bc, thumb, x] = TABLE[c][state];
      const where = `${id} [${state}]`;
      assert(r.bg === col(bg, brand) && r.bc === col(bc, brand) && r.bw === `${px("border-width.strong")}px`, `${where}: track ${r.bg} / ${r.bc} ${r.bw} ≠ ${col(bg, brand)} / ${col(bc, brand)}`);
      assert(r.w === 44 && r.h === 24 && r.radius === `${px("radius.full")}px`, `${where}: track ${r.w}×${r.h} r${r.radius}`);
      assert(r.thumb === col(thumb, brand) && r.thumbW === 16 && r.thumbH === 16 && Math.abs(r.thumbX - x) < 0.01 && Math.abs(r.thumbY - 4) < 0.01, `${where}: thumb ${r.thumb} ${r.thumbW}×${r.thumbH} at ${r.thumbX},${r.thumbY}`);
      assert(r.label === col(state === "disabled" ? "text.disabled" : "text.default", brand) && r.fs === `${px("font.size.body.md")}px` && r.lh === `${px("font.line-height.body.md")}px` && r.ff === "Inter, system-ui, sans-serif" && r.fw === String(resolve("font.weight.regular", "financial")), `${where}: label ${r.label} ${r.fs}/${r.lh} ${r.fw}`);
      assert(r.minH === `${px("size.touch-target.min")}px` && Math.abs(r.rowH - px("size.touch-target.min")) < 0.01 && r.pt === `${px("space.component.sm")}px` && r.gap === `${px("space.gap.md")}px` && r.textFirst && r.trailing, `${where}: row ${r.minH} ${r.rowH} ${r.pt} ${r.gap} text-first ${r.textFirst} trailing ${r.trailing}`);
      assert(Math.abs(r.top - (px("space.component.sm") + (px("font.line-height.body.md") - 24) / 2)) < 0.01, `${where}: track not aligned to the first line (${r.top})`);
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
      for (const c of Object.keys(TABLE)) {
        const id = `${ctx}-${c}-enabled`, did = `${ctx}-${c}-disabled`;
        await reset(); await checkState(id, c, "default", brand); n++;
        await row(id).locator(".ch-switch__label").hover(); await checkState(id, c, "hover", brand); n++;
        await el(id).hover(); /* the transparent native input covers the track */ await checkState(id, c, "hover", brand); n++;
        await reset(); await page.keyboard.press("Shift"); await el(id).focus(); await checkState(id, c, "focus", brand); n++;
        await reset(); await checkState(did, c, "disabled", brand); n++;
        await row(did).locator(".ch-switch__label").hover(); await checkState(did, c, "disabled", brand);
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    await reset(); for (const c of Object.keys(TABLE)) { await checkState(`financial-${c}-enabled`, c, "default", "invest"); n++; }
    await page.evaluate(() => document.documentElement.removeAttribute("data-brand"));
    const rtl = await read("rtl-on");
    assert(Math.abs(rtl.thumbX - 4) < 0.01 && rtl.checked, `RTL: On thumb mirrors to the start edge (${rtl.thumbX})`);
    lines.push(`computed tokens and geometry (${browser.version()}): ${n} state checks = off / on × default / hover (label and track) / focus-visible / disabled × Financial, Invest, Financial-in-Invest, Invest-in-Financial + page-level <html data-brand=invest> — track fill/border (2px), 44×24 track, radius/full, 16×16 thumb 4px from the edge, thumb at x 4 (Off) / 24 (On) incl. disabled, thumb colour, label body/md, text first and control trailing, 44px row, first-line alignment, cursor, pill focus rings; RTL mirrors the On position`);
    lines.push(`brand: On track ${col("control.checked", "financial")} → ${col("control.checked", "invest")} through data-brand only; Off, thumb, disabled and focus colours brand-independent; Off/On distinguishable by thumb position in every state`);

    // ---- Keyboard and pointer ------------------------------------------------------------------------------------
    await reset();
    await el("before").focus();
    await page.keyboard.press("Tab");
    assert(await el("kb-1").evaluate((i) => i === document.activeElement && i.matches(":focus-visible")), "Tab reaches the switch with focus-visible");
    await page.keyboard.press("Space");
    assert(await el("kb-1").evaluate((i) => i.checked), "Space turns it on");
    await page.keyboard.press("Enter");
    assert(await el("kb-1").evaluate((i) => i.checked), "Enter does not toggle (native checkbox behaviour)");
    await page.keyboard.press("Space");
    assert(!(await el("kb-1").evaluate((i) => i.checked)), "Space turns it off");
    await page.keyboard.press("Tab");
    assert(await el("kb-2").evaluate((i) => i === document.activeElement), "each switch is its own tab stop; disabled is skipped");
    await page.keyboard.press("ArrowRight");
    assert(!(await el("kb-2").evaluate((i) => i.checked)), "arrow keys do not toggle a switch");
    await reset();
    await row("kb-1").locator(".ch-switch__label").click();
    assert(await el("kb-1").evaluate((i) => i.checked && !i.matches(":focus-visible")), "clicking the label toggles; pointer shows no ring");
    await el("kb-1").click();
    assert(!(await el("kb-1").evaluate((i) => i.checked)), "clicking the track toggles");
    const rb = await row("kb-1").boundingBox();
    await page.mouse.click(rb.x + rb.width / 2, rb.y + 2);
    assert(await el("kb-1").evaluate((i) => i.checked), "the whole row (incl. the gap and padding) is the target");
    await row("support").locator(".ch-switch__supporting").click();
    assert(await el("support").evaluate((i) => i.checked), "supporting text is part of the row target");
    await row("kb-disabled").click({ force: true });
    assert(!(await el("kb-disabled").evaluate((i) => i.checked)), "disabled never toggles");
    lines.push("keyboard/pointer: Tab shows the pill ring; Space toggles on and off; Enter and arrow keys do not; each switch is its own tab stop and disabled is skipped; label, track, row and supporting text all toggle without a ring");

    // ---- Controlled / uncontrolled, forms, disabled --------------------------------------------------------------
    await row("controlled").locator(".ch-switch__label").click();
    assert(await page.evaluate(() => window.__swControlled === true) && (await el("controlled").evaluate((i) => i.checked)), "controlled: onChange → owner state → checked");
    await row("locked").locator(".ch-switch__label").click();
    assert(await el("locked").evaluate((i) => i.checked), "controlled without a state change stays on (React owns the value)");
    await el("submit").click();
    assert((await page.evaluate(() => window.__swSubmitted)) === undefined, "a required, off switch blocks native form submission");
    await row("f-required").locator(".ch-switch__label").click();
    await el("submit").click();
    assert(JSON.stringify(await page.evaluate(() => window.__swSubmitted)) === '["keyFacts=read"]', "only switches that are on are submitted, with the consumer's name and value");
    await row("f-default").locator(".ch-switch__label").click();
    await el("submit").click();
    assert(JSON.stringify(await page.evaluate(() => window.__swSubmitted)) === '["keyFacts=read","paperless=on"]', "a switch without value submits the native default \"on\"");
    await row("in-disabled-fieldset").click({ force: true });
    const fs = await el("in-disabled-fieldset").evaluate((i) => ({ checked: i.checked, disabled: i.matches(":disabled"), label: getComputedStyle(i.closest(".ch-switch").querySelector(".ch-switch__label")).color, bg: getComputedStyle(i.nextElementSibling).backgroundColor }));
    assert(fs.checked && fs.disabled && fs.label === col("text.disabled", "financial") && fs.bg === col("surface.disabled", "financial"), `a disabled <fieldset> disables and restyles the switch ${JSON.stringify(fs)}`);
    await row("native").locator(".ch-switch__label").click();
    assert((await page.evaluate(() => window.__swChanges)) === 1, "onChange fires");
    lines.push("forms/state: uncontrolled (defaultChecked) and controlled (checked + onChange) both work, and a controlled switch without a state change stays put; a required off switch blocks submission; on switches submit name=value (native default \"on\"); <fieldset disabled> disables and restyles; onChange fires");

    // ---- Motion -----------------------------------------------------------------------------------------------------
    const motion = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
    await motion.goto(server.url);
    await motion.waitForFunction(() => window.__ready === true);
    const m1 = await motion.locator('[data-testid="kb-1"]').evaluate(READ);
    assert(m1.dur === "0.15s, 0.15s | 0.15s, 0.15s" && m1.ease === "cubic-bezier(0.2, 0, 0, 1), cubic-bezier(0.2, 0, 0, 1) | cubic-bezier(0.2, 0, 0, 1), cubic-bezier(0.2, 0, 0, 1)", `motion ${m1.dur} ${m1.ease}`);
    await motion.locator('.ch-switch:has([data-testid="kb-1"]) .ch-switch__label').click();
    const mid = await motion.locator('[data-testid="kb-1"]').evaluate(READ);
    assert(mid.checked && mid.thumbX < 24 - 0.01, `state commits immediately while the thumb is still moving (checked ${mid.checked}, x ${mid.thumbX})`);
    await motion.waitForTimeout(400);
    const end = await motion.locator('[data-testid="kb-1"]').evaluate(READ);
    assert(Math.abs(end.thumbX - 24) < 0.01, `thumb reaches the On position (${end.thumbX})`);
    await motion.close();
    const red = await read("kb-2");
    assert(red.dur === "0s | 0s", `prefers-reduced-motion: reduce → 0ms (${red.dur})`);
    await row("kb-2").locator(".ch-switch__label").click();
    const inst = await read("kb-2");
    assert(inst.checked && Math.abs(inst.thumbX - 24) < 0.01, `reduced motion: the thumb moves instantly (${inst.thumbX})`);
    lines.push("motion: track colour/border and thumb transform/colour transition 150ms cubic-bezier(0.2, 0, 0, 1); the checked state commits immediately while the thumb is still moving; prefers-reduced-motion: reduce → 0ms and the thumb lands instantly");

    // ---- Wrapping, 200 % text and reflow ---------------------------------------------------------------------------
    const wrapCheck = async (label) => {
      const w = await el("wrap").evaluate((i) => { const row = i.closest(".ch-switch"); const r = row.getBoundingClientRect(); const t = row.querySelector(".ch-switch__track").getBoundingClientRect(); const lab = row.querySelector(".ch-switch__label"); return { h: r.height, minH: parseFloat(getComputedStyle(row).minHeight), sw: row.scrollWidth, cw: row.clientWidth, pw: row.parentElement.clientWidth, ow: row.offsetWidth, labLines: Math.round(lab.getBoundingClientRect().height / parseFloat(getComputedStyle(lab).lineHeight)), top: t.top - r.top, trailing: Math.abs(r.right - t.right) < 0.5 }; });
      assert(w.labLines >= 2 && w.h > w.minH && w.sw <= w.cw && w.ow <= w.pw && w.trailing, `${label}: wrapping/clipping ${JSON.stringify(w)}`);
      return w;
    };
    const w1 = await wrapCheck("100 % text");
    assert(Math.abs(w1.top - px("space.component.sm")) < 0.01, "track stays on the first line when the label wraps");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const w2 = await wrapCheck("200 % text");
    const big = await read("financial-on-enabled");
    assert(big.minH === `${2 * px("size.touch-target.min")}px` && big.w === 88 && big.h === 48 && big.thumbW === 32 && Math.abs(big.thumbX - 48) < 0.01 && big.fs === `${2 * px("font.size.body.md")}px`, `200 % scaling: ${big.minH} track ${big.w}×${big.h} thumb ${big.thumbW} at ${big.thumbX} ${big.fs}`);
    await page.setViewportSize({ width: 320, height: 900 });
    const reflow = await page.evaluate(() => ({ doc: document.scrollingElement.scrollWidth, vw: window.innerWidth, out: [...document.querySelectorAll(".ch-switch")].filter((a) => a.getBoundingClientRect().right > window.innerWidth + 0.5).map((a) => a.querySelector("input").dataset.testid) }));
    assert(reflow.doc <= reflow.vw && reflow.out.length === 0, `reflow at 320px / 200 %: ${JSON.stringify(reflow)}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    lines.push(`wrapping: label wraps (${w1.labLines} lines, row ${w1.h}px) and at 200 % text (${w2.labLines} lines, ${w2.h}px) with the track trailing on the first line and no clipping; track, thumb, inset and travel scale ×2 with the root size (rem geometry); no horizontal overflow at 320px / 200 %`);

    // ---- Hover-incapable devices -------------------------------------------------------------------------------------
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
    const tp = await touch.newPage();
    await tp.goto(server.url);
    await tp.waitForFunction(() => window.__ready === true);
    assert(!(await tp.evaluate(() => matchMedia("(hover: hover)").matches)), "emulated touch device should report hover: none");
    await tp.locator('.ch-switch:has([data-testid="financial-off-enabled"]) .ch-switch__label').hover();
    const th = await tp.locator('[data-testid="financial-off-enabled"]').evaluate(READ);
    assert(th.bc === col("border.input", "financial") && th.thumb === col("icon.subtle", "financial"), `no hover change on hover-incapable devices (${th.bc} ${th.thumb})`);
    await touch.close();
    lines.push("hover capability: on an emulated touch device (hover: none) the track keeps its rest border and thumb colour (no sticky hover)");

    // ---- Forced colours ------------------------------------------------------------------------------------------------
    await page.emulateMedia({ forcedColors: "active" });
    await reset();
    const sys = await page.evaluate(() => { const p = document.createElement("span"); document.body.append(p); const c = (v) => { p.style.color = v; return getComputedStyle(p).color; }; const r = { text: c("CanvasText"), gray: c("GrayText"), hl: c("Highlight") }; p.remove(); return r; });
    for (const c of Object.keys(TABLE)) {
      const e = await read(`financial-${c}-enabled`);
      assert(e.bc === sys.text && e.bw === `${px("border-width.strong")}px` && e.thumb === sys.text && e.thumbW === 16 && Math.abs(e.thumbX - TABLE[c].default[3]) < 0.01, `forced colours ${c}: ${e.bc} ${e.bw} thumb ${e.thumb} ${e.thumbW} at ${e.thumbX}`);
      const d = await read(`financial-${c}-disabled`);
      assert(d.bc === sys.gray && d.thumb === sys.gray && d.label === sys.gray && Math.abs(d.thumbX - TABLE[c].default[3]) < 0.01, `forced colours disabled ${c}: ${d.bc} ${d.thumb} ${d.label}`);
      await page.keyboard.press("Shift"); await el(`financial-${c}-enabled`).focus();
      const f = await read(`financial-${c}-enabled`);
      assert(f.fv && f.outlineStyle === "solid" && f.outlineWidth === `${px("focus.width.indicator")}px` && f.outlineColor === sys.hl, `forced colours focus ${c}: ${f.outlineStyle} ${f.outlineColor}`);
      await reset();
    }
    await page.emulateMedia({ forcedColors: "none" });
    lines.push("forced colours (emulated): track keeps a 2px CanvasText boundary; the border-drawn thumb stays visible in CanvasText and Off/On stay distinct by position; disabled boundary/thumb/label GrayText; focus-visible keeps a 3px Highlight outline");
  } finally {
    await browser.close();
    server.close();
    harness.cleanup();
  }
  return lines;
}
