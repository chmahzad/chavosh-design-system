// AUTHORED. Text Field v1 in Chromium (Playwright 1.56.1): structure, label/description relationships and the
// accessibility tree, computed tokens for every designed state (Default, Hover, Focus, Disabled, Read-only; Error with
// Default/Hover/Focus) × brand (incl. nested and page-level contexts), native disabled/readOnly behaviour, keyboard,
// controlled and uncontrolled use, forms, error appearing on blur, wrapping and long values, 200 % text, 320px reflow,
// hover-incapable devices and forced colours. Expected values come from the Text Field architecture token mapping (§3)
// resolved through the generated DTCG — independent of text-field.css. Disabled + Error and Read-only + Error are
// unsupported design combinations (ADR 0017) and are not asserted. Automated evidence only; not a conformance claim.
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

// Text Field architecture §3: [input background, border colour, border width token, value colour, placeholder colour].
const TABLE = {
  default: ["surface.default", "border.input", "border-width.default", "text.default", "text.placeholder"],
  hover: ["surface.default", "border.strong", "border-width.default", "text.default", "text.placeholder"],
  focus: ["surface.default", "border.input", "border-width.default", "text.default", "text.placeholder"],
  disabled: ["surface.disabled", "border.disabled", "border-width.default", "text.disabled", "text.disabled"],
  readonly: ["surface.sunken", "border.input", "border-width.default", "text.default", "text.placeholder"],
  "error-default": ["surface.default", "feedback.error.border", "border-width.strong", "text.default", "text.placeholder"],
  "error-hover": ["surface.default", "feedback.error.border", "border-width.strong", "text.default", "text.placeholder"],
  "error-focus": ["surface.default", "feedback.error.border", "border-width.strong", "text.default", "text.placeholder"],
};
const BRAND_OF_CTX = { financial: "financial", invest: "invest", "fin-in-inv": "financial", "inv-in-fin": "invest" };

const READ = (input) => {
  const f = input.closest(".ch-text-field");
  const i = getComputedStyle(input), w = getComputedStyle(f);
  // Chromium does not expose ::placeholder computed styles; resolve the colour the ::placeholder rule uses instead.
  const probe = document.createElement("span"); probe.style.color = i.getPropertyValue("--_tf-placeholder").trim(); document.body.append(probe); const ph = { color: getComputedStyle(probe).color }; probe.remove();
  const label = f.querySelector(".ch-text-field__label"), l = getComputedStyle(label);
  const opt = f.querySelector(".ch-text-field__optional"), help = f.querySelector(".ch-text-field__helper"), err = f.querySelector(".ch-text-field__error"), icon = f.querySelector(".ch-text-field__error-icon");
  const ir = input.getBoundingClientRect(), fr = f.getBoundingClientRect(), lr = label.getBoundingClientRect();
  const o = opt && getComputedStyle(opt), h = help && getComputedStyle(help), e = err && getComputedStyle(err), ic = icon && getComputedStyle(icon);
  return {
    bg: i.backgroundColor, bc: i.borderTopColor, bw: i.borderTopWidth, bcAll: new Set([i.borderTopColor, i.borderRightColor, i.borderBottomColor, i.borderLeftColor]).size, value: i.color, ph: ph.color,
    radius: i.borderTopLeftRadius, h: ir.height, w: ir.width, fw: fr.width, minH: i.minHeight, pl: i.paddingLeft, pr: i.paddingRight, fs: i.fontSize, lh: i.lineHeight, ff: i.fontFamily, weight: i.fontWeight,
    gap: w.rowGap, labelColor: l.color, labelFs: l.fontSize, labelLh: l.lineHeight, labelW: l.fontWeight, labelGap: l.columnGap, labelToInput: ir.top - lr.bottom,
    opt: o && { color: o.color, fs: o.fontSize, lh: o.lineHeight, w: o.fontWeight, text: opt.textContent },
    help: h && { color: h.color, fs: h.fontSize, lh: h.lineHeight, w: h.fontWeight },
    err: e && { color: e.color, fs: e.fontSize, lh: e.lineHeight, w: e.fontWeight, gap: e.columnGap, iconColor: ic.color, iconStroke: getComputedStyle(icon.querySelector("path")).stroke, iconW: icon.getBoundingClientRect().width, iconH: icon.getBoundingClientRect().height, iconTop: icon.getBoundingClientRect().top - err.getBoundingClientRect().top, gapToInput: err.getBoundingClientRect().top - ir.bottom },
    outlineStyle: i.outlineStyle, outlineWidth: i.outlineWidth, outlineColor: i.outlineColor, outlineOffset: i.outlineOffset, shadow: i.boxShadow,
    fv: input.matches(":focus-visible"), focused: input === document.activeElement, cursor: i.cursor,
  };
};

async function buildHarness() {
  const outDir = mkdtempSync(join(tmpdir(), "ch-text-field-harness-"));
  await build({ root: join(HERE, "text-field-harness"), base: "./", logLevel: "silent", build: { outDir, emptyOutDir: true, minify: false } });
  return { outDir, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

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
    const field = (id) => page.locator(`.ch-text-field:has([data-testid="${id}"])`);
    const ax = async (id) => page.accessibility.snapshot({ root: await el(id).elementHandle(), interestingOnly: false });
    const node = (n) => (!n ? null : n.role === "textbox" ? n : (n.children || []).map(node).find(Boolean));
    const reset = async () => { await page.mouse.move(0, 0); await page.evaluate(() => document.activeElement && document.activeElement.blur()); };

    // ---- Structure, relationships and accessibility tree --------------------------------------------------------------
    const plain = await el("plain").evaluate((i) => { const f = i.closest(".ch-text-field"); return { tag: i.tagName, type: i.type, root: f.className, children: [...f.children].map((c) => c.className), labelFor: f.querySelector("label").htmlFor === i.id, labels: i.labels.length, invalid: i.getAttribute("aria-invalid"), described: i.getAttribute("aria-describedby"), name: i.hasAttribute("name"), tab: i.getAttribute("tabindex"), role: i.getAttribute("role") }; });
    assert(plain.tag === "INPUT" && plain.type === "text" && plain.root === "ch-text-field" && JSON.stringify(plain.children) === '["ch-text-field__label","ch-text-field__input"]' && plain.labelFor && plain.labels === 1 && plain.invalid === null && plain.described === null && !plain.name && plain.tab === null && plain.role === null, `structure ${JSON.stringify(plain)}`);
    const full = await el("full").evaluate((i) => { const f = i.closest(".ch-text-field"); return { children: [...f.children].map((c) => c.className), described: i.getAttribute("aria-describedby").split(" ").map((id) => document.getElementById(id).className || id), iconHidden: f.querySelector("svg").getAttribute("aria-hidden"), focusable: f.querySelector("svg").getAttribute("focusable") }; });
    assert(JSON.stringify(full.children) === '["ch-text-field__label","ch-text-field__helper","ch-text-field__input","ch-text-field__error"]' && JSON.stringify(full.described) === '["ch-text-field__error","ch-text-field__helper","extra"]' && full.iconHidden === "true" && full.focusable === "false", `anatomy/description order ${JSON.stringify(full)}`);
    const tb = node(await ax("full"));
    assert(tb && tb.name === "Email (optional)" && tb.description === "Enter an email address We'll send your statements here Extra description" && tb.invalid === "true", `name/description/invalid ${JSON.stringify(tb)}`);
    const helperOnly = node(await ax("helper-only"));
    assert(helperOnly && helperOnly.name === "Mobile" && helperOnly.description === "For example 0412 345 678" && !helperOnly.invalid, `helper only ${JSON.stringify(helperOnly)}`);
    const emptyErr = await el("empty-error").evaluate((i) => ({ invalid: i.getAttribute("aria-invalid"), err: !!i.closest(".ch-text-field").querySelector(".ch-text-field__error") }));
    assert(emptyErr.invalid === null && !emptyErr.err, "an empty errorMessage renders no error treatment");
    const nat = await el("native").evaluate((i) => ({ id: i.id, name: i.getAttribute("name"), im: i.inputMode, ac: i.autocomplete, ml: i.maxLength, title: i.title, rootCls: i.closest(".ch-text-field").className, cls: i.className, labelFor: i.closest(".ch-text-field").querySelector("label").htmlFor }));
    assert(nat.id === "native-id" && nat.labelFor === "native-id" && nat.name === "accountNumber" && nat.im === "numeric" && nat.ac === "off" && nat.ml === 9 && nat.title === "Account number" && nat.rootCls === "ch-text-field consumer-class" && nat.cls === "ch-text-field__input", `passthrough ${JSON.stringify(nat)}`);
    assert((await el("typed").getAttribute("type")) === "email", "type passthrough");
    assert(await page.evaluate(() => window.__tfRef instanceof HTMLInputElement && window.__tfRef.classList.contains("ch-text-field__input")), "ref must reach the native <input>");
    const ids = await page.evaluate(() => [...document.querySelectorAll(".ch-text-field__input")].map((i) => i.id));
    assert(new Set(ids).size === ids.length, "generated ids are unique");
    lines.push("structure: <div class=ch-text-field> with label row → helper → native <input> → error (architecture §1); persistent <label for> with generated or consumer id; accessibility tree textbox, name = label incl. \"(optional)\", description = error, helper, consumer aria-describedby (in that order), invalid only with an errorMessage (empty message = none); decorative icon (aria-hidden, focusable=false); the form-field name attribute is only the consumer's `name` prop; native attributes, type and ref reach the <input>, className the wrapper; unique generated ids");

    // ---- Computed tokens: state × brand ------------------------------------------------------------------------------
    const checkState = async (id, state, brand) => {
      const r = await read(id);
      const [bg, bc, bw, value, ph] = TABLE[state];
      const where = `${id} [${state}]`;
      assert(r.bg === col(bg, brand) && r.bc === col(bc, brand) && r.bcAll === 1 && r.bw === `${px(bw)}px`, `${where}: input ${r.bg} / ${r.bc} ${r.bw} ≠ ${col(bg, brand)} / ${col(bc, brand)} ${px(bw)}`);
      assert(r.value === col(value, brand) && r.ph === col(ph, brand), `${where}: value ${r.value} placeholder ${r.ph}`);
      assert(r.radius === `${px("radius.sm")}px` && r.h === px("size.control.height.md") && r.minH === `${px("size.control.height.md")}px` && r.pl === `${px("space.component.md")}px` && r.pr === r.pl && Math.abs(r.w - r.fw) < 0.01, `${where}: geometry r${r.radius} h${r.h} ${r.pl} w${r.w}/${r.fw}`);
      assert(r.fs === `${px("font.size.body.md")}px` && r.lh === `${px("font.line-height.body.md")}px` && r.ff === "Inter, system-ui, sans-serif" && r.weight === String(resolve("font.weight.regular", "financial")), `${where}: value type ${r.fs}/${r.lh} ${r.weight}`);
      assert(r.labelColor === col("text.default", brand) && r.labelFs === `${px("font.size.label.md")}px` && r.labelLh === `${px("font.line-height.label.md")}px` && r.labelW === String(resolve("font.weight.medium", "financial")), `${where}: label ${r.labelColor} ${r.labelFs}/${r.labelLh} ${r.labelW}`);
      assert(r.gap === `${px("space.gap.sm")}px` && Math.abs(r.labelToInput - px("space.gap.sm")) < 0.01, `${where}: block gap ${r.gap} ${r.labelToInput}`);
      const focus = state.endsWith("focus");
      assert(r.fv === focus && (r.outlineStyle === "solid") === focus, `${where}: focus-visible ${r.fv} outline ${r.outlineStyle}`);
      if (focus) {
        const iw = px("focus.width.indicator"), ow = px("focus.width.outer");
        assert(r.outlineWidth === `${iw}px` && r.outlineColor === col("focus.indicator", brand) && r.outlineOffset === "0px", `${where}: indicator ${r.outlineWidth} ${r.outlineColor}`);
        assert(r.shadow === `${col("focus.outer", brand)} 0px 0px 0px ${iw + ow}px`, `${where}: outer ring ${r.shadow}`);
      } else assert(r.shadow === "none", `${where}: unexpected box-shadow ${r.shadow}`);
      if (state.startsWith("error")) {
        assert(r.err && r.err.color === col("feedback.error.foreground", brand) && r.err.iconColor === col("feedback.error.icon", brand) && r.err.iconStroke === r.err.iconColor, `${where}: error row ${JSON.stringify(r.err)}`);
        assert(r.err.fs === `${px("font.size.body.sm")}px` && r.err.lh === `${px("font.line-height.body.sm")}px` && r.err.gap === `${px("space.gap.xs")}px` && r.err.iconW === px("size.icon.sm") && r.err.iconH === px("size.icon.sm") && r.err.iconTop === 0 && Math.abs(r.err.gapToInput - px("space.gap.sm")) < 0.01, `${where}: error geometry ${JSON.stringify(r.err)}`);
      } else assert(!r.err, `${where}: unexpected error row`);
      return r;
    };
    let n = 0;
    for (const ctx of Object.keys(BRAND_OF_CTX)) {
      const brand = BRAND_OF_CTX[ctx];
      await reset(); await checkState(`${ctx}-default`, "default", brand); n++;
      await el(`${ctx}-default`).hover(); await checkState(`${ctx}-default`, "hover", brand); n++;
      await reset(); await el(`${ctx}-default`).focus(); await checkState(`${ctx}-default`, "focus", brand); n++;
      await el(`${ctx}-default`).hover(); await checkState(`${ctx}-default`, "focus", brand); n++; // focused + hovered keeps the Focus border
      await reset(); await checkState(`${ctx}-placeholder`, "default", brand); n++;
      await checkState(`${ctx}-disabled`, "disabled", brand); n++;
      await el(`${ctx}-disabled`).hover({ force: true }); await checkState(`${ctx}-disabled`, "disabled", brand); n++;
      await reset(); await checkState(`${ctx}-disabled-ph`, "disabled", brand); n++;
      await checkState(`${ctx}-readonly`, "readonly", brand); n++;
      await el(`${ctx}-readonly`).hover(); await checkState(`${ctx}-readonly`, "readonly", brand); n++;
      await reset(); await checkState(`${ctx}-error`, "error-default", brand); n++;
      await el(`${ctx}-error`).hover(); await checkState(`${ctx}-error`, "error-hover", brand); n++;
      await reset(); await el(`${ctx}-error`).focus(); await checkState(`${ctx}-error`, "error-focus", brand); n++;
      await reset();
    }
    const ro = await read("financial-readonly");
    await el("financial-readonly").focus();
    const roF = await read("financial-readonly");
    assert(roF.focused && roF.fv && roF.outlineStyle === "solid" && roF.bg === col("surface.sunken", "financial"), "read-only is focusable and shows the focus ring on the sunken surface");
    await reset();
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    await checkState("financial-default", "default", "invest"); await checkState("financial-error", "error-default", "invest"); n += 2;
    await page.evaluate(() => document.documentElement.removeAttribute("data-brand"));
    const fin = await read("financial-error"), inv = await read("invest-error");
    assert(JSON.stringify({ ...fin, fw: 0, w: 0 }) === JSON.stringify({ ...inv, fw: 0, w: 0 }), "Text Field has no brand-dependent paint (architecture §9: 0 brand-dependent field paints)");
    const full2 = await read("full");
    assert(full2.opt && full2.opt.text === "(optional)" && full2.opt.color === col("text.subtle", "financial") && full2.opt.fs === `${px("font.size.body.md")}px` && full2.opt.lh === `${px("font.line-height.body.md")}px` && full2.opt.w === String(resolve("font.weight.regular", "financial")) && full2.labelGap === `${px("space.gap.xs")}px`, `optional indicator ${JSON.stringify(full2.opt)} ${full2.labelGap}`);
    assert(full2.help && full2.help.color === col("text.subtle", "financial") && full2.help.fs === `${px("font.size.body.sm")}px` && full2.help.lh === `${px("font.line-height.body.sm")}px` && full2.help.w === String(resolve("font.weight.regular", "financial")), `helper ${JSON.stringify(full2.help)}`);
    const disHelp = await el("in-disabled-fieldset").evaluate(READ);
    assert(disHelp.labelColor === col("text.default", "financial"), "label stays text/default when disabled (architecture §3)");
    lines.push(`computed tokens (${browser.version()}): ${n} state checks = Default, Hover, Focus-visible (also while hovered), Disabled (incl. hover and placeholder), Read-only (incl. hover), Error × Default / Hover / Focus-visible × Financial, Invest, Financial-in-Invest, Invest-in-Financial + page-level <html data-brand=invest> — input surface, border colour and width (1px; 2px feedback/error/border for errors), value and placeholder colours, radius/sm, 48px height, space/component/md padding, body/md value, label/md medium label in text/default in every state, 8px block gaps, focus rings (outline + outer), error row (feedback/error/foreground body/sm, 16px feedback/error/icon alert-circle, 4px gap); \"(optional)\" body/md text/subtle with a 4px gap; helper body/sm text/subtle`);
    lines.push("brand: identical computed output in Financial and Invest (no brand-dependent field paint, by design); read-only is focusable with the focus ring on surface/sunken");

    // ---- Keyboard, pointer, native disabled / readOnly ----------------------------------------------------------------
    await el("before").focus();
    await page.keyboard.press("Tab");
    assert(await el("kb-1").evaluate((i) => i === document.activeElement && i.matches(":focus-visible")), "Tab reaches the field with focus-visible");
    await page.keyboard.type("Hello");
    assert((await el("kb-1").inputValue()) === "Hello", "typing enters text");
    await page.keyboard.press("Tab");
    assert(await el("kb-readonly").evaluate((i) => i === document.activeElement), "disabled is skipped; read-only is a tab stop");
    await page.keyboard.type("X");
    assert((await el("kb-readonly").inputValue()) === "Fixed value", "read-only cannot be edited");
    await page.keyboard.press("Tab");
    assert(await el("kb-2").evaluate((i) => i === document.activeElement), "Tab order follows the document");
    await reset();
    await field("kb-2").locator(".ch-text-field__label").click();
    assert(await el("kb-2").evaluate((i) => i === document.activeElement), "clicking the label focuses the input");
    await field("kb-disabled").locator(".ch-text-field__label").click({ force: true });
    assert(!(await el("kb-disabled").evaluate((i) => i === document.activeElement)), "a disabled field cannot be focused");
    lines.push("keyboard/pointer: Tab reaches each field with the focus ring; typing edits; disabled is skipped and cannot be focused; read-only is a tab stop but cannot be edited; clicking the label focuses the input");

    // ---- Controlled / uncontrolled, forms, validation ------------------------------------------------------------------
    await el("controlled").fill("ab12");
    assert((await el("controlled").inputValue()) === "AB12" && (await page.evaluate(() => window.__tfControlled)) === "AB12", "controlled: onChange → owner state → value");
    await el("locked").pressSequentially("x");
    assert((await el("locked").inputValue()) === "LOCKED", "controlled without a state change keeps its value");
    await el("native").fill("123");
    assert((await page.evaluate(() => window.__tfChanges)) > 0, "onChange fires");
    await el("submit").click();
    assert((await page.evaluate(() => window.__tfSubmitted)) === undefined, "a required, empty field blocks native form submission");
    await el("f-required").fill("Alex Citizen");
    await el("submit").click();
    assert(JSON.stringify(await page.evaluate(() => window.__tfSubmitted)) === '["fullName=Alex Citizen","customerId=CF-1234"]', `read-only fields are submitted; disabled and unnamed fields are not (${JSON.stringify(await page.evaluate(() => window.__tfSubmitted))})`);
    const fs = await el("in-disabled-fieldset").evaluate((i) => ({ disabled: i.matches(":disabled"), bg: getComputedStyle(i).backgroundColor }));
    assert(fs.disabled && fs.bg === col("surface.disabled", "financial"), `a disabled <fieldset> disables and restyles the field ${JSON.stringify(fs)}`);
    await el("validated").fill("name");
    await el("validated").blur();
    const v1 = node(await ax("validated"));
    assert(v1.invalid === "true" && v1.description.startsWith("Enter an email address in the format") && v1.description.endsWith("We'll send your statements here"), `error on blur ${JSON.stringify(v1)}`);
    const vr = await read("validated");
    assert(vr.bw === `${px("border-width.strong")}px` && vr.bc === col("feedback.error.border", "financial") && vr.help, "error treatment keeps the helper text");
    await el("validated").fill("name@example.com");
    await el("validated").blur();
    const v2 = node(await ax("validated"));
    assert(!v2.invalid && v2.description === "We'll send your statements here", `error cleared ${JSON.stringify(v2)}`);
    lines.push("forms/state: uncontrolled (defaultValue) and controlled (value + onChange) both work; a required empty field blocks submission; read-only fields are submitted, disabled and unnamed ones are not; <fieldset disabled> disables and restyles; an error set on blur adds aria-invalid, the 2px error border and the message as the first description, and clearing it restores the field");

    // ---- Wrapping, long values, 200 % text and reflow -----------------------------------------------------------------
    const wrapCheck = async (label) => {
      const w = await el("wrap").evaluate((i) => { const f = i.closest(".ch-text-field"); const lines = (sel) => { const e = f.querySelector(sel); return Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)); }; return { label: lines(".ch-text-field__label-text"), helper: lines(".ch-text-field__helper"), error: lines(".ch-text-field__error-text"), sw: f.scrollWidth, cw: f.clientWidth, fw: f.offsetWidth, pw: f.parentElement.clientWidth, iw: i.getBoundingClientRect().width, ih: i.getBoundingClientRect().height, scroll: i.scrollWidth > i.clientWidth }; });
      assert(w.label >= 2 && w.helper >= 2 && w.error >= 2 && w.sw <= w.cw && w.fw <= w.pw && Math.abs(w.iw - w.fw) < 0.01 && w.scroll, `${label}: wrapping/clipping ${JSON.stringify(w)}`);
      return w;
    };
    const w1 = await wrapCheck("100 % text");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const w2 = await wrapCheck("200 % text");
    const big = await read("financial-error");
    assert(big.h === 2 * px("size.control.height.md") && big.fs === `${2 * px("font.size.body.md")}px` && big.labelFs === `${2 * px("font.size.label.md")}px` && big.err.iconW === 2 * px("size.icon.sm") && big.pl === `${2 * px("space.component.md")}px`, `200 % scaling: h${big.h} ${big.fs} icon ${big.err.iconW} ${big.pl}`);
    await page.setViewportSize({ width: 320, height: 900 });
    const reflow = await page.evaluate(() => ({ doc: document.scrollingElement.scrollWidth, vw: window.innerWidth, out: [...document.querySelectorAll(".ch-text-field")].filter((a) => a.getBoundingClientRect().right > window.innerWidth + 0.5).map((a) => a.querySelector("input").dataset.testid) }));
    assert(reflow.doc <= reflow.vw && reflow.out.length === 0, `reflow at 320px / 200 %: ${JSON.stringify(reflow)}`);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1280, height: 900 });
    lines.push(`wrapping: label, helper and error message wrap (${w1.label}/${w1.helper}/${w1.error} lines; ${w2.label}/${w2.helper}/${w2.error} at 200 % text) and a long value scrolls inside the native input without widening the field; height, padding, type and icon scale ×2 with the root size; no horizontal overflow at 320px / 200 %`);

    // ---- Hover-incapable devices -------------------------------------------------------------------------------------
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const tp = await touch.newPage();
    await tp.goto(server.url);
    await tp.waitForFunction(() => window.__ready === true);
    assert(!(await tp.evaluate(() => matchMedia("(hover: hover)").matches)), "emulated touch device should report hover: none");
    await tp.locator('[data-testid="financial-default"]').hover();
    const th = await tp.locator('[data-testid="financial-default"]').evaluate(READ);
    assert(th.bc === col("border.input", "financial"), `no hover change on hover-incapable devices (${th.bc})`);
    await touch.close();
    lines.push("hover capability: on an emulated touch device (hover: none) the field keeps its rest border (no sticky hover)");

    // ---- Forced colours ------------------------------------------------------------------------------------------------
    await page.emulateMedia({ forcedColors: "active" });
    await reset();
    const sys = await page.evaluate(() => { const p = document.createElement("span"); document.body.append(p); const c = (v) => { p.style.color = v; return getComputedStyle(p).color; }; const r = { text: c("CanvasText"), gray: c("GrayText"), hl: c("Highlight") }; p.remove(); return r; });
    const fd = await read("financial-default"), fe = await read("financial-error"), fdis = await read("financial-disabled");
    assert(fd.bc === sys.text && fd.bw === `${px("border-width.default")}px`, `forced colours default ${fd.bc} ${fd.bw}`);
    assert(fe.bc === sys.text && fe.bw === `${px("border-width.strong")}px` && fe.err.color === sys.text && fe.err.iconStroke === sys.text && fe.err.iconW === px("size.icon.sm"), `forced colours error: ${fe.bc} ${fe.bw} ${JSON.stringify(fe.err)}`);
    assert(fdis.bc === sys.gray && fdis.value === sys.gray, `forced colours disabled ${fdis.bc} ${fdis.value}`);
    await el("financial-error").focus();
    const ff = await read("financial-error");
    assert(ff.fv && ff.outlineStyle === "solid" && ff.outlineWidth === `${px("focus.width.indicator")}px` && ff.outlineColor === sys.hl, `forced colours focus ${ff.outlineStyle} ${ff.outlineColor}`);
    await reset();
    await page.emulateMedia({ forcedColors: "none" });
    lines.push("forced colours (emulated): CanvasText field boundary; errors keep the 2px width plus the visible icon and message; disabled boundary and value GrayText; focus-visible keeps a 3px Highlight outline");
  } finally {
    await browser.close();
    server.close();
    harness.cleanup();
  }
  return lines;
}
