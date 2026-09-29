// AUTHORED. Chromium (Playwright 1.56.1) computed-style checks on the fixture CSS: brand switching (default,
// page-level, explicit and nested contexts), brand-scoped composite re-resolution (ADR 0008), typography
// properties, colours and responsive breakpoints. The harness page carries no token values of its own.
import { chromium } from "playwright";
import { assert, fixturePipeline } from "./lib.mjs";

const FIN = "rgb(30, 61, 122)"; // #1e3d7a (navy/800, Proof #1)
const INV = "rgb(89, 13, 162)"; // #590da2 (violet/800, Proof #1)
const page = (css) => `<!doctype html><html><head><style>${css}
.probe { color: var(--ch-color-control-checked); background-color: var(--ch-color-text-default); font-family: var(--ch-font-family-sans);
  font-weight: var(--ch-font-weight-medium); font-size: var(--ch-font-size-body-md); line-height: var(--ch-font-line-height-body-md);
  padding-left: var(--ch-layout-margin); box-shadow: var(--ch-elevation-overlay); }
</style></head><body>
<div id="default" class="probe"></div>
<div data-brand="invest"><div id="invest" class="probe"></div><div data-brand="financial"><div id="fin-in-inv" class="probe"></div></div></div>
<div data-brand="financial"><div data-brand="invest"><div id="inv-in-fin" class="probe"></div></div></div>
</body></html>`;

async function measure(browser, css, { width = 375, htmlBrand = null } = {}) {
  const p = await browser.newPage({ viewport: { width, height: 600 }, deviceScaleFactor: 1 });
  await p.setContent(page(css));
  if (htmlBrand) await p.evaluate((b) => document.documentElement.setAttribute("data-brand", b), htmlBrand);
  const r = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll(".probe")].map((el) => {
    const s = getComputedStyle(el);
    return [el.id, { color: s.color, bg: s.backgroundColor, font: s.fontFamily, weight: s.fontWeight, size: s.fontSize, lh: s.lineHeight, pad: s.paddingLeft, shadow: s.boxShadow }];
  })));
  await p.close();
  return r;
}

export async function run() {
  const lines = [];
  const opts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  const browser = await chromium.launch(opts).catch((e) => { throw new Error(`Could not launch Chromium (npx playwright install chromium, or set CHROMIUM_PATH): ${e.message.split("\n")[0]}`); });
  const base = await fixturePipeline();
  const moved = await fixturePipeline({
    mutateSnapshot: (s) => {
      const navy = s.variables.find((v) => v.name === "color/navy/800").valuesByMode["1:0"];
      for (const e of s.styles.effect[0].effects) { e.boundVariables.color.id = "VariableID:51:2"; e.color = { ...navy }; }
    },
  });
  try {
    const r = await measure(browser, base.cssText);
    assert(r.default.color === FIN && r.invest.color === INV && r["fin-in-inv"].color === FIN && r["inv-in-fin"].color === INV, `brand contexts: ${JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.color])))}`);
    const pageLevel = await measure(browser, base.cssText, { htmlBrand: "invest" });
    assert(pageLevel.default.color === INV && pageLevel["fin-in-inv"].color === FIN, "page-level data-brand on <html>");
    lines.push(`brand switching (${browser.version()}): default financial ${FIN}; explicit invest ${INV}; financial inside invest and invest inside financial re-resolve; page-level data-brand on <html> works`);

    const d = r.default;
    assert(d.font === "Inter, system-ui, sans-serif" && d.weight === "500" && d.size === "16px" && d.lh === "24px", `typography ${JSON.stringify(d)}`);
    assert(d.bg === "rgb(27, 34, 44)" && d.shadow === "rgba(27, 34, 44, 0.12) 0px 4px 12px -2px, rgba(27, 34, 44, 0.12) 0px 2px 4px 0px", `colours ${d.bg} / ${d.shadow}`);
    lines.push("typography: font-family Inter, system-ui, sans-serif · weight 500 · 16px/24px; colours: hex #1b222c → rgb(27, 34, 44); alpha shadow rgba(27, 34, 44, 0.12)");

    const pads = {};
    for (const w of [767, 768, 1023, 1024]) pads[w] = (await measure(browser, base.cssText, { width: w })).default.pad;
    assert(pads[767] === "16px" && pads[768] === "32px" && pads[1023] === "32px" && pads[1024] === "40px", `breakpoints ${JSON.stringify(pads)}`);
    lines.push("responsive: layout/margin 16px @767 → 32px @768 → 32px @1023 → 40px @1024 (48rem / 64rem)");

    const m = await measure(browser, moved.cssText);
    assert(m.default.shadow.includes(FIN) && m.invest.shadow.includes("rgb(89, 13, 162)") && m["fin-in-inv"].shadow.includes("rgb(30, 61, 122)"), `composite re-resolution: ${m.invest.shadow}`);
    lines.push("ADR 0008 in Chromium: a shadow using a brand-dependent colour re-resolves in nested brand contexts");
  } finally {
    await browser.close();
    base.cleanup();
    moved.cleanup();
  }
  return lines;
}
