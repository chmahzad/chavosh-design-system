// AUTHORED. Chromium (Playwright 1.56.1) check of the PRODUCTION stylesheet dist/ch-tokens.css for the Button closure:
// every brand-dependent Button colour resolves to the expected Financial / Invest value in default, explicit, nested
// and page-level brand contexts; brand-independent colours never change; dimension/typography tokens compute to the
// DTCG values at 375 / 768 / 1024 px. Expected values are computed from the generated DTCG (primitive → brand →
// semantic), independently of the CSS build. PENDING until the canonical snapshot exists.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { assert, config, ROOT } from "./lib.mjs";
import { flatten } from "../build/build-css.mjs";

const hexToRgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

export async function run() {
  const cfg = config();
  if (!cfg.publicSnapshots.some((e) => existsSync(join(ROOT, e.path)))) return { status: "PENDING", lines: ["production render check waits for the public snapshots"] };
  const dtcg = join(ROOT, "generated/dtcg");
  const load = (s) => new Map(flatten(JSON.parse(readFileSync(join(dtcg, `${s}.tokens.json`), "utf8"))));
  const prim = load("primitives"), color = load("color"), dim = load("dimension"), mob = load("responsive-mobile");
  const brand = { financial: load("brand-financial"), invest: load("brand-invest") };
  const resolve = (ref, b) => {
    const p = ref.slice(1, -1);
    const t = prim.get(p) || brand[b].get(p) || color.get(p);
    if (!t) throw new Error(`unresolved ${ref}`);
    return typeof t.$value === "string" && t.$value.startsWith("{") ? resolve(t.$value, b) : t.$value;
  };
  const colours = [...color.entries()].map(([p, t]) => ({
    css: t.$extensions.chavosh.css, brandDependent: t.$extensions.chavosh.brandDependent,
    fin: hexToRgb(resolve(t.$value, "financial").hex), inv: hexToRgb(resolve(t.$value, "invest").hex),
  }));
  const dependent = colours.filter((c) => c.brandDependent);
  assert(dependent.length === 11 && colours.length === 21, `expected 21 Button colours (11 brand-dependent), got ${colours.length}/${dependent.length}`);
  assert(dependent.every((c) => c.fin !== c.inv || c.css.includes("secondary")), "brand-dependent colours should differ between brands (except where the mapping assigns equal hues)");

  const css = readFileSync(join(ROOT, "dist/ch-tokens.css"), "utf8");
  const probes = colours.map((c, i) => `<i data-k="${i}" style="color: var(${c.css})"></i>`).join("");
  const html = `<!doctype html><html><head><style>${css}</style></head><body>
<div id="default">${probes}</div>
<div data-brand="invest"><div id="invest">${probes}</div><div data-brand="financial"><div id="fin-in-inv">${probes}</div></div></div>
<div data-brand="financial"><div data-brand="invest"><div id="inv-in-fin">${probes}</div></div></div>
<div id="dims" style="min-height: var(--ch-size-control-height-sm); padding-inline: var(--ch-space-component-xl); gap: var(--ch-space-gap-sm); border-radius: var(--ch-radius-md); border: var(--ch-border-width-default) solid; outline: var(--ch-focus-width-indicator) solid; font-family: var(--ch-font-family-sans); font-weight: var(--ch-font-weight-medium); font-size: var(--ch-font-size-label-sm); line-height: var(--ch-font-line-height-label-sm); display: flex"></div>
</body></html>`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const lines = [];
  try {
    const read = async (page, id) => page.evaluate((id) => [...document.querySelectorAll(`#${id} i`)].map((e) => getComputedStyle(e).color), id);
    const page = await browser.newPage({ viewport: { width: 375, height: 600 } });
    await page.setContent(html);
    const want = { default: "fin", invest: "inv", "fin-in-inv": "fin", "inv-in-fin": "inv" };
    for (const [id, b] of Object.entries(want)) {
      const got = await read(page, id);
      colours.forEach((c, i) => assert(got[i] === c[b], `${c.css} in #${id}: ${got[i]} ≠ expected ${c[b]}`));
    }
    await page.evaluate(() => document.documentElement.setAttribute("data-brand", "invest"));
    const pageLevel = await read(page, "default");
    colours.forEach((c, i) => assert(pageLevel[i] === c.inv, `${c.css} with <html data-brand="invest">: ${pageLevel[i]}`));
    lines.push(`brand (${browser.version()}): all ${colours.length} Button colours correct in default (Financial), explicit Invest, Financial-in-Invest, Invest-in-Financial and page-level Invest; ${dependent.length} brand-dependent switch, ${colours.length - dependent.length} brand-independent constant`);

    const px = (m, p) => `${m.get(p).$value.value}px`;
    for (const w of [375, 768, 1024]) {
      await page.setViewportSize({ width: w, height: 600 });
      const d = await page.evaluate(() => { const s = getComputedStyle(document.getElementById("dims")); return { h: s.minHeight, pad: s.paddingLeft, gap: s.columnGap, r: s.borderTopLeftRadius, bw: s.borderTopWidth, ow: s.outlineWidth, ff: s.fontFamily, fw: s.fontWeight, fs: s.fontSize, lh: s.lineHeight }; });
      const res = (m, p) => { const t = m.get(p); return typeof t.$value === "string" ? prim.get(t.$value.slice(1, -1)).$value : t.$value; };
      const exp = { h: `${res(dim, "size.control.height.sm").value}px`, pad: `${res(dim, "space.component.xl").value}px`, gap: `${res(dim, "space.gap.sm").value}px`, r: `${res(dim, "radius.md").value}px`, bw: `${res(dim, "border-width.default").value}px`, ow: `${res(dim, "focus.width.indicator").value}px`, ff: "Inter, system-ui, sans-serif", fw: String(res(dim, "font.weight.medium")), fs: `${res(mob, "font.size.label.sm").value}px`, lh: `${res(mob, "font.line-height.label.sm").value}px` };
      assert(JSON.stringify(d) === JSON.stringify(exp), `computed at ${w}px ${JSON.stringify(d)} ≠ ${JSON.stringify(exp)}`);
    }
    lines.push("dimensions/typography: min-height, padding, gap, radius, border and focus widths, font family/weight/size/line-height compute to the DTCG values at 375 / 768 / 1024 px");
  } finally {
    await browser.close();
  }
  return { status: "PASS", lines };
}
