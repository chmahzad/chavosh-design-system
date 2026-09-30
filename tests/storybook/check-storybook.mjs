// AUTHORED. Storybook verification (Storybook 10.6.0, Playwright 1.56.1 / Chromium) — complements, never replaces,
// the component checks. Static: real Button, Link, Checkbox, Radio, Switch and Text Field, token CSS loaded once, data-brand toolbar, no raw/duplicated values or
// excluded props in stories. Build: the production static build succeeds; every story renders, its play function
// passes (a failing play emits playFunctionThrewException while storyFinished still says "success", so both are
// checked) and the a11y addon (axe-core) reports no violations; docs pages render; the Brand toolbar switches the real
// Button, Link, Checkbox, Radio, Switch and Text Field through data-brand; pseudo-state demos apply the real CSS rules. No output snapshots.
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

const STORY_FILES = ["packages/react/src/Button/Button.stories.tsx", "packages/react/src/Button/Button.mdx", "packages/react/src/Link/Link.stories.tsx", "packages/react/src/Link/Link.mdx", "packages/react/src/Checkbox/Checkbox.stories.tsx", "packages/react/src/Checkbox/Checkbox.mdx", "packages/react/src/Radio/Radio.stories.tsx", "packages/react/src/Radio/Radio.mdx", "packages/react/src/Switch/Switch.stories.tsx", "packages/react/src/Switch/Switch.mdx", "packages/react/src/TextField/TextField.stories.tsx", "packages/react/src/TextField/TextField.mdx", ".storybook/pages/Introduction.mdx", ".storybook/pages/Foundations.mdx"];
const EXPECTED_ENTRIES = [
  "introduction--docs", "foundations-design-tokens--docs", "components-button--docs",
  "components-button--playground", "components-button--hierarchies", "components-button--sizes", "components-button--states",
  "components-button--brand-comparison", "components-button--long-label", "components-button--disabled", "components-button--keyboard",
  "components-link--docs", "components-link--playground", "components-link--sizes", "components-link--states",
  "components-link--brand-comparison", "components-link--examples", "components-link--long-label", "components-link--keyboard",
  "components-checkbox--docs", "components-checkbox--playground", "components-checkbox--selection", "components-checkbox--states",
  "components-checkbox--supporting-text", "components-checkbox--select-all", "components-checkbox--group", "components-checkbox--brand-comparison",
  "components-checkbox--long-label", "components-checkbox--keyboard", "components-checkbox--disabled",
  "components-radio--docs", "components-radio--playground", "components-radio--selection", "components-radio--states",
  "components-radio--supporting-text", "components-radio--group", "components-radio--brand-comparison",
  "components-radio--long-label", "components-radio--keyboard", "components-radio--disabled",
  "components-switch--docs", "components-switch--playground", "components-switch--states", "components-switch--supporting-text",
  "components-switch--settings", "components-switch--controlled", "components-switch--brand-comparison",
  "components-switch--long-label", "components-switch--keyboard", "components-switch--disabled",
  "components-text-field--docs", "components-text-field--playground", "components-text-field--states", "components-text-field--helper-and-optional",
  "components-text-field--error-message", "components-text-field--financial-examples", "components-text-field--disabled-and-read-only",
  "components-text-field--brand-comparison", "components-text-field--long-content", "components-text-field--keyboard",
];
const TEXT_FIELD_EXCLUDED = ["error", "invalid", "aria-invalid", "size", "hover", "focus", "leadingIcon", "trailingIcon", "icon", "hideLabel", "children", "validation", "variant"];
const SWITCH_EXCLUDED = ["type", "role", "error", "size", "hover", "focus", "indeterminate", "hideLabel", "children", "onLabel", "loading"];
const RADIO_EXCLUDED = ["type", "error", "invalid", "size", "hover", "focus", "indeterminate", "hideLabel", "children", "variant"];
const CHECKBOX_EXCLUDED = ["type", "error", "invalid", "size", "hover", "focus", "icon", "children", "variant"];
// JSX attribute names of every <Tag …> in source (brace/quote aware, so arrow functions inside props are handled).
function jsxAttrNames(src, tag) {
  const out = [];
  for (const m of src.matchAll(new RegExp(`<${tag}\\b`, "g"))) {
    let i = m.index + tag.length + 1, depth = 0, quote = null, buf = "";
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'" || c === "`") { if (depth === 0) buf += " "; quote = c; continue; }
      if (c === "{") { depth++; continue; }
      if (c === "}") { depth--; if (depth === 0) buf += " "; continue; }
      if (depth > 0) continue;
      if (c === ">") break;
      buf += c;
    }
    out.push(...buf.replace(/=/g, " ").replace(/\//g, " ").trim().split(/\s+/).filter(Boolean));
  }
  return out;
}
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
  assert(/import "\.\/checkbox\.css"/.test(read("packages/react/src/Checkbox/Checkbox.tsx")), "Checkbox must import its own checkbox.css");
  assert(/import "\.\/radio\.css"/.test(read("packages/react/src/Radio/Radio.tsx")), "Radio must import its own radio.css");
  assert(/import "\.\/switch\.css"/.test(read("packages/react/src/Switch/Switch.tsx")), "Switch must import its own switch.css");
  assert(/import "\.\/text-field\.css"/.test(read("packages/react/src/TextField/TextField.tsx")), "Text Field must import its own text-field.css");

  const stories = noComments(read("packages/react/src/Button/Button.stories.tsx"));
  assert(/import \{ Button[^}]*\} from "\.\/Button";/.test(stories) && /component: Button,/.test(stories), "stories must use the real Button (./Button)");
  for (const f of STORY_FILES) {
    // MDX prose may mention `<button>` etc. inside inline code spans; only executable/markup content is scanned.
    const code = f.endsWith(".mdx") ? noComments(read(f)).replace(/`[^`\n]*`/g, "") : noComments(read(f));
    assert(!/<button\b/.test(code), `${f}: renders a <button> of its own — stories must use the real Button`);
    assert(!/<a\b/.test(code), `${f}: renders an <a> of its own — stories must use the real Link`);
    assert(!/<input\b/.test(code), `${f}: renders an <input> of its own — stories must use the real Checkbox / Radio / Switch / Text Field`);
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

  // Checkbox stories: the real Checkbox and only its API.
  const cbStories = noComments(read("packages/react/src/Checkbox/Checkbox.stories.tsx"));
  assert(/import \{ Checkbox[^}]*\} from "\.\/Checkbox";/.test(cbStories) && /component: Checkbox,/.test(cbStories), "stories must use the real Checkbox (./Checkbox)");
  const cbProps = jsxAttrNames(cbStories, "Checkbox");
  const cbArgs = [...cbStories.matchAll(/\bargs: \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((a) => a[1]));
  const cbAllowed = new Set(["label", "supportingText", "hideLabel", "indeterminate", "disabled", "defaultChecked", "checked", "onChange", "name", "value", "key", "data-demo-state"]);
  for (const p of [...cbProps, ...cbArgs]) assert(cbAllowed.has(p) && !CHECKBOX_EXCLUDED.includes(p), `prop "${p}" on Checkbox in stories is not part of the documented API`);
  assert(cbProps.length >= 10 && cbArgs.includes("label"), "Checkbox prop scan found nothing — pattern out of date");
  const cbInclude = /controls:\s*\{\s*include:\s*\[([^\]]*)\]/.exec(cbStories);
  assert(cbInclude && JSON.stringify(cbInclude[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort()) === JSON.stringify(["defaultChecked", "disabled", "hideLabel", "indeterminate", "label", "supportingText"]), "Checkbox controls must be exactly label, supportingText, hideLabel, indeterminate, disabled, defaultChecked");
  const cbArgTypes = /argTypes:\s*\{([\s\S]*?)\n  \},\n  parameters/.exec(cbStories)[1];
  const cbKeys = [...cbArgTypes.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert(JSON.stringify(cbKeys) === JSON.stringify(["defaultChecked", "disabled", "hideLabel", "indeterminate", "label", "onChange", "supportingText"]), `Checkbox argTypes ${cbKeys}`);
  assert(/<fieldset className="sb-fieldset">/.test(cbStories) && /<legend className="sb-legend">/.test(cbStories) && !/CheckboxGroup/.test(cbStories), "groups are native fieldset/legend composition (no CheckboxGroup)");

  // Radio stories: the real Radio and only its API; groups are fieldset/legend + shared name.
  const rdStories = noComments(read("packages/react/src/Radio/Radio.stories.tsx"));
  assert(/import \{ Radio[^}]*\} from "\.\/Radio";/.test(rdStories) && /component: Radio,/.test(rdStories), "stories must use the real Radio (./Radio)");
  const rdProps = jsxAttrNames(rdStories, "Radio");
  const rdArgs = [...rdStories.matchAll(/\bargs: \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((a) => a[1]));
  const rdAllowed = new Set(["label", "supportingText", "name", "value", "disabled", "defaultChecked", "checked", "onChange", "key", "data-demo-state"]);
  for (const p of [...rdProps, ...rdArgs]) assert(rdAllowed.has(p) && !RADIO_EXCLUDED.includes(p), `prop "${p}" on Radio in stories is not part of the documented API`);
  assert(rdProps.length >= 10 && rdArgs.includes("label") && rdProps.includes("name"), "Radio prop scan found nothing — pattern out of date");
  const rdInclude = /controls:\s*\{\s*include:\s*\[([^\]]*)\]/.exec(rdStories);
  assert(rdInclude && JSON.stringify(rdInclude[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort()) === JSON.stringify(["defaultChecked", "disabled", "label", "name", "supportingText", "value"]), "Radio controls must be exactly label, supportingText, name, value, disabled, defaultChecked");
  const rdArgTypes = /argTypes:\s*\{([\s\S]*?)\n  \},\n  parameters/.exec(rdStories)[1];
  const rdKeys = [...rdArgTypes.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert(JSON.stringify(rdKeys) === JSON.stringify(["defaultChecked", "disabled", "label", "name", "onChange", "supportingText", "value"]), `Radio argTypes ${rdKeys}`);
  assert(/<fieldset className="sb-fieldset">/.test(rdStories) && /<legend className="sb-legend">/.test(rdStories) && !/RadioGroup/.test(rdStories), "Radio groups are native fieldset/legend composition (no RadioGroup)");

  // Switch stories: the real Switch and only its API; settings lists are fieldset/legend (no Switch Group).
  const swStories = noComments(read("packages/react/src/Switch/Switch.stories.tsx"));
  assert(/import \{ Switch[^}]*\} from "\.\/Switch";/.test(swStories) && /component: Switch,/.test(swStories), "stories must use the real Switch (./Switch)");
  const swProps = jsxAttrNames(swStories, "Switch");
  const swArgs = [...swStories.matchAll(/\bargs: \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((a) => a[1]));
  const swAllowed = new Set(["label", "supportingText", "disabled", "defaultChecked", "checked", "onChange", "name", "value", "key", "data-demo-state"]);
  for (const p of [...swProps, ...swArgs]) assert(swAllowed.has(p) && !SWITCH_EXCLUDED.includes(p), `prop "${p}" on Switch in stories is not part of the documented API`);
  assert(swProps.length >= 10 && swArgs.includes("label"), "Switch prop scan found nothing — pattern out of date");
  const swInclude = /controls:\s*\{\s*include:\s*\[([^\]]*)\]/.exec(swStories);
  assert(swInclude && JSON.stringify(swInclude[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort()) === JSON.stringify(["defaultChecked", "disabled", "label", "supportingText"]), "Switch controls must be exactly label, supportingText, disabled, defaultChecked");
  const swArgTypes = /argTypes:\s*\{([\s\S]*?)\n  \},\n  parameters/.exec(swStories)[1];
  const swKeys = [...swArgTypes.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert(JSON.stringify(swKeys) === JSON.stringify(["defaultChecked", "disabled", "label", "onChange", "supportingText"]), `Switch argTypes ${swKeys}`);
  assert(/<fieldset className="sb-fieldset sb-narrow-md">/.test(swStories) && !/SwitchGroup/.test(swStories), "Switch settings lists are native fieldset/legend composition (no Switch Group)");

  // Text Field stories: the real TextField and only its API (+ native input attributes); no unsupported combinations.
  const tfStories = noComments(read("packages/react/src/TextField/TextField.stories.tsx"));
  assert(/import \{ TextField[^}]*\} from "\.\/TextField";/.test(tfStories) && /component: TextField,/.test(tfStories), "stories must use the real TextField (./TextField)");
  const tfProps = jsxAttrNames(tfStories, "TextField");
  const tfArgs = [...tfStories.matchAll(/\bargs: \{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/(\w+):/g)].map((a) => a[1]));
  const tfAllowed = new Set(["label", "helperText", "errorMessage", "optional", "placeholder", "disabled", "readOnly", "defaultValue", "value", "onChange", "onBlur", "type", "autoComplete", "inputMode", "name", "required", "key", "data-demo-state"]);
  for (const p of [...tfProps, ...tfArgs]) assert(tfAllowed.has(p) && !TEXT_FIELD_EXCLUDED.includes(p), `prop "${p}" on TextField in stories is not part of the documented API`);
  assert(tfProps.length >= 20 && tfArgs.includes("label"), "Text Field prop scan found nothing — pattern out of date");
  const tfInclude = /controls:\s*\{\s*include:\s*\[([^\]]*)\]/.exec(tfStories);
  assert(tfInclude && JSON.stringify(tfInclude[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1)).sort()) === JSON.stringify(["disabled", "errorMessage", "helperText", "label", "optional", "placeholder", "readOnly"]), "Text Field controls must be exactly label, helperText, errorMessage, optional, placeholder, disabled, readOnly");
  const tfArgTypes = /argTypes:\s*\{([\s\S]*?)\n  \},\n  parameters/.exec(tfStories)[1];
  const tfKeys = [...tfArgTypes.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
  assert(JSON.stringify(tfKeys) === JSON.stringify(["disabled", "errorMessage", "helperText", "label", "onChange", "optional", "placeholder", "readOnly"]), `Text Field argTypes ${tfKeys}`);
  for (const m of tfStories.matchAll(/<TextField\b[^>]*>/g)) assert(!(/errorMessage=/.test(m[0]) && /\b(disabled|readOnly)(=\{true\})?[\s/]/.test(m[0])), `unsupported Disabled/Read-only + Error combination in a story: ${m[0].slice(0, 120)}`);

  // Brand toolbar via data-brand; viewport presets.
  assert(/value: "financial", title: "Financial"/.test(preview) && /value: "invest", title: "Invest"/.test(preview) && /initialGlobals: \{ brand: "financial" \}/.test(preview), "Brand toolbar: Financial (default) / Invest");
  assert(/<div data-brand=\{context\.globals\.brand \?\? "financial"\}>/.test(preview) && !/invest\s*\?|brand\s*===/.test(preview), "brand applied only through data-brand on the wrapper (no conditionals)");
  for (const w of ["375px", "768px", "1024px"]) assert(preview.includes(`width: "${w}"`), `viewport ${w}`);
  assert(read(".gitignore").includes("storybook-static/"), "storybook-static/ must be git-ignored");
  return [
    "static: ch-tokens.css imported once (.storybook/preview.tsx); Button, Link, Checkbox, Radio, Switch and Text Field keep their own CSS; stories use the real ./Button, ./Link, ./Checkbox, ./Radio, ./Switch and ./TextField; no <button>, <a> or <input>, raw colours, token declarations/references or inline styles in stories/docs; storybook.css is neutral layout",
    "API: Button controls exactly hierarchy/size/type/disabled/children, no excluded props (loading, icons, href, as, fullWidth, state props, disabledBehavior); Link controls exactly href/size/children, no excluded props (disabled, as/asChild, icons, visited, variant, current, state props); Checkbox controls exactly label/supportingText/hideLabel/indeterminate/disabled/defaultChecked, no excluded props (type, error/invalid, size, state props, icon, children); Radio controls exactly label/supportingText/name/value/disabled/defaultChecked, no excluded props (type, error/invalid, size, state props, indeterminate, hideLabel, children); Switch controls exactly label/supportingText/disabled/defaultChecked, no excluded props (type, role, error, size, state props, indeterminate, hideLabel, On/Off text, loading); Text Field controls exactly label/helperText/errorMessage/optional/placeholder/disabled/readOnly, no excluded props (error/invalid/aria-invalid, size, state props, icons, hideLabel, validation, children) and no unsupported Disabled/Read-only + Error story; groups are native fieldset/legend (no CheckboxGroup/RadioGroup/Switch Group); stories render no <button>/<a>/<input> of their own; Brand toolbar Financial (default)/Invest via data-brand only; viewports 375/768/1024",
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
    lines.push(`static build: storybook build succeeded in ${Math.round((Date.now() - t0) / 1000)}s; index = Introduction, Foundations/Design tokens, Components/Button (docs + ${storyCount("button")} stories), Components/Link (docs + ${storyCount("link")} stories), Components/Checkbox (docs + ${storyCount("checkbox")} stories), Components/Radio (docs + ${storyCount("radio")} stories), Components/Switch (docs + ${storyCount("switch")} stories), Components/Text Field (docs + ${storyCount("text-field")} stories) — nothing else`);

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
    assert(plays === 27, `expected 27 play functions to complete, saw ${plays}`);
    const axe = JSON.parse(read("node_modules/axe-core/package.json")).version;
    lines.push(`stories: all ${ids.filter((i) => index.entries[i].type === "story").length} render; ${plays} play functions pass (Button: Playground click, Disabled non-activation + not focusable, Keyboard Tab/focus-visible/Enter/Space, Long label no clipping; Link: Playground click, Keyboard Tab/focus-visible/Enter activates/Space does not, Long label wraps underlined without clipping; Checkbox: Playground label click, Select all indeterminate ↔ all, Long label first-line box, Keyboard Space toggles / Enter does not, Disabled cannot change or focus; Radio: Playground label click with consumer name, Group single selection, Long label first-line circle, Keyboard Tab/Space/ArrowDown skips disabled, Disabled cannot select or focus; Switch: Playground row click, Controlled immediate effect, Long label trailing first-line track, Keyboard Space toggles / Enter does not, Disabled cannot change or focus; Text Field: Playground label click + typing, Error on blur sets/clears aria-invalid and the description, Disabled not focusable / Read-only focusable but not editable, Long content wraps and scrolls without widening, Keyboard Tab order skips disabled); a11y addon (axe-core ${axe}) reports 0 violations on every story (${a11yPasses} passed rule results) — automated evidence only`);

    for (const id of ids.filter((i) => index.entries[i].type === "docs")) {
      const { page } = await open(`id=${id}&viewMode=docs`, "docsRendered");
      await page.close();
    }
    lines.push("docs: Introduction, Foundations/Design tokens and the Button, Link, Checkbox, Radio, Switch and Text Field docs pages render without errors");

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
    for (const brand of ["financial", "invest"]) {
      const { page } = await open(`id=components-checkbox--selection&viewMode=story&globals=brand:${brand}`, "storyFinished");
      const r = await page.evaluate(() => {
        const input = [...document.querySelectorAll("#storybook-root input")].find((i) => i.checked);
        const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
        return { root: input.closest("label").className, wrapper: input.closest("[data-brand]")?.getAttribute("data-brand"), bg: getComputedStyle(input.nextElementSibling).backgroundColor, minH: getComputedStyle(input.closest("label")).minHeight, cbRules: rules.filter((x) => x.selectorText === ".ch-checkbox").length };
      });
      assert(r.root === "ch-checkbox" && r.wrapper === brand && r.bg === colour("color.control.checked", brand), `${brand}: real Checkbox ${JSON.stringify(r)} ≠ ${colour("color.control.checked", brand)}`);
      assert(r.minH === `${resolve("size.touch-target.min", "financial").value}px` && r.cbRules === 1, `Checkbox min-height ${r.minH} / checkbox.css loaded ×${r.cbRules}`);
      await page.close();
    }
    for (const brand of ["financial", "invest"]) {
      const { page } = await open(`id=components-radio--selection&viewMode=story&globals=brand:${brand}`, "storyFinished");
      const r = await page.evaluate(() => {
        const input = [...document.querySelectorAll("#storybook-root input")].find((i) => i.checked);
        const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
        return { root: input.closest("label").className, wrapper: input.closest("[data-brand]")?.getAttribute("data-brand"), bc: getComputedStyle(input.nextElementSibling).borderTopColor, dot: getComputedStyle(input.nextElementSibling.firstElementChild).borderTopColor, minH: getComputedStyle(input.closest("label")).minHeight, rdRules: rules.filter((x) => x.selectorText === ".ch-radio").length };
      });
      assert(r.root === "ch-radio" && r.wrapper === brand && r.bc === colour("color.control.checked", brand) && r.dot === colour("color.control.checked", brand), `${brand}: real Radio ${JSON.stringify(r)}`);
      assert(r.minH === `${resolve("size.touch-target.min", "financial").value}px` && r.rdRules === 1, `Radio min-height ${r.minH} / radio.css loaded ×${r.rdRules}`);
      await page.close();
    }
    for (const brand of ["financial", "invest"]) {
      const { page } = await open(`id=components-switch--brand-comparison&viewMode=story&globals=brand:${brand}`, "storyFinished");
      // let the 150ms colour transitions settle (bounded wait; the assertion below reports the final values)
      await page.waitForFunction((want) => { const i = document.querySelector('#storybook-root .sb-panel[data-brand="invest"] input:checked'); return i && getComputedStyle(i.nextElementSibling).backgroundColor === want; }, colour("color.control.checked", "invest"), { timeout: 5000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const input = document.querySelector('#storybook-root .sb-panel[data-brand="invest"] input:checked');
        const fin = document.querySelector('#storybook-root .sb-panel[data-brand="financial"] input:checked');
        const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
        return { role: input.getAttribute("role"), inv: getComputedStyle(input.nextElementSibling).backgroundColor, fin: getComputedStyle(fin.nextElementSibling).backgroundColor, minH: getComputedStyle(input.closest("label")).minHeight, swRules: rules.filter((x) => x.selectorText === ".ch-switch").length };
      });
      assert(r.role === "switch" && r.fin === colour("color.control.checked", "financial") && r.inv === colour("color.control.checked", "invest"), `Switch brand panels ${JSON.stringify(r)}`);
      assert(r.minH === `${resolve("size.touch-target.min", "financial").value}px` && r.swRules === 1, `Switch min-height ${r.minH} / switch.css loaded ×${r.swRules}`);
      await page.close();
    }
    for (const brand of ["financial", "invest"]) {
      const { page } = await open(`id=components-text-field--brand-comparison&viewMode=story&globals=brand:${brand}`, "storyFinished");
      const r = await page.evaluate(() => {
        const pick = (b) => { const i = document.querySelector(`#storybook-root .sb-panel[data-brand="${b}"] input[aria-invalid="true"]`); const c = getComputedStyle(i); return { bc: c.borderTopColor, bw: c.borderTopWidth, err: getComputedStyle(i.closest(".ch-text-field").querySelector(".ch-text-field__error")).color, h: c.minHeight }; };
        const rules = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
        return { fin: pick("financial"), inv: pick("invest"), wrapper: document.querySelector("#storybook-root .sb-panel").closest("[data-brand]:not(.sb-panel)")?.getAttribute("data-brand"), tfRules: rules.filter((x) => x.selectorText === ".ch-text-field").length };
      });
      assert(r.wrapper === brand && JSON.stringify(r.fin) === JSON.stringify(r.inv) && r.fin.bc === colour("color.feedback.error.border", "financial") && r.fin.bw === `${resolve("border-width.strong", "financial").value}px` && r.fin.err === colour("color.feedback.error.foreground", "financial"), `Text Field brand panels ${JSON.stringify(r)}`);
      assert(r.fin.h === `${resolve("size.control.height.md", "financial").value}px` && r.tfRules === 1, `Text Field min-height ${r.fin.h} / text-field.css loaded ×${r.tfRules}`);
      await page.close();
    }
    lines.push("brand toolbar: globals brand=financial|invest sets data-brand on the wrapper; the real Button resolves the matching DTCG primary colour and the real Link the matching link colour (underlined, 44px minimum); the real Checkbox the matching control/checked fill (44px row); the real Radio the matching control/checked ring and dot (44px row); token stylesheet, button.css, link.css, checkbox.css, radio.css and switch.css each loaded exactly once; Switch brand panels resolve the Financial and Invest On track through data-brand; Text Field brand panels are identical in Financial and Invest (error border 2px feedback/error/border, error text, 48px) with text-field.css loaded once");

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
    {
      const { page: cp } = await open("id=components-checkbox--states&viewMode=story", "storyFinished");
      await cp.waitForTimeout(300);
      const cs = await cp.evaluate(() => {
        const boxes = [...document.querySelectorAll(".ch-checkbox__input")];
        const q = (label) => boxes.find((i) => i.closest(".ch-checkbox").textContent === label);
        const s = (i) => { const b = getComputedStyle(i.nextElementSibling); return { bg: b.backgroundColor, bc: b.borderTopColor, outline: `${b.outlineStyle} ${b.outlineWidth}`, disabled: i.disabled }; };
        return { def: s(q("Unchecked · Default")), hover: s(q("Unchecked · Hover")), chHover: s(q("Checked · Hover")), focus: s(q("Checked · Focus-visible")), dis: s(q("Indeterminate · Disabled")) };
      });
      assert(cs.def.bc === colour("color.border.input", "financial") && cs.hover.bc === colour("color.border.strong", "financial") && cs.chHover.bg === colour("color.control.checked-hover", "financial"), `Checkbox pseudo hover ${JSON.stringify(cs)}`);
      assert(cs.focus.outline === `solid ${resolve("focus.width.indicator", "financial").value}px` && cs.dis.disabled && cs.dis.bg === colour("color.surface.disabled", "financial"), `Checkbox pseudo focus/disabled ${JSON.stringify(cs)}`);
      await cp.close();
    }
    lines.push("Checkbox States story: pseudo-states addon applies the real row :hover (border/strong unchecked, checked-hover fill) and box :focus-visible (3px ring); disabled is the native attribute — no state props");
    {
      const { page: rp } = await open("id=components-radio--states&viewMode=story", "storyFinished");
      await rp.waitForTimeout(300);
      const rs = await rp.evaluate(() => {
        const inputs = [...document.querySelectorAll(".ch-radio__input")];
        const q = (label) => inputs.find((i) => i.closest(".ch-radio").textContent === label);
        const s = (i) => { const c = getComputedStyle(i.nextElementSibling); return { bc: c.borderTopColor, dot: getComputedStyle(i.nextElementSibling.firstElementChild).borderTopColor, outline: `${c.outlineStyle} ${c.outlineWidth}`, disabled: i.disabled }; };
        return { def: s(q("Unselected · Default")), hover: s(q("Unselected · Hover")), selHover: s(q("Selected · Hover")), focus: s(q("Selected · Focus-visible")), dis: s(q("Selected · Disabled")) };
      });
      assert(rs.def.bc === colour("color.border.input", "financial") && rs.hover.bc === colour("color.border.strong", "financial") && rs.selHover.bc === colour("color.control.checked-hover", "financial") && rs.selHover.dot === colour("color.control.checked-hover", "financial"), `Radio pseudo hover ${JSON.stringify(rs)}`);
      assert(rs.focus.outline === `solid ${resolve("focus.width.indicator", "financial").value}px` && rs.dis.disabled && rs.dis.dot === colour("color.icon.disabled", "financial"), `Radio pseudo focus/disabled ${JSON.stringify(rs)}`);
      await rp.close();
    }
    lines.push("Radio States story: pseudo-states addon applies the real row :hover (border/strong unselected, checked-hover ring and dot) and circle :focus-visible (3px ring); disabled is the native attribute (dot kept) — no state props");
    {
      const { page: wp } = await open("id=components-switch--states&viewMode=story", "storyFinished");
      await wp.waitForTimeout(400);
      const ws = await wp.evaluate(() => {
        const inputs = [...document.querySelectorAll(".ch-switch__input")];
        const q = (label) => inputs.find((i) => i.closest(".ch-switch").textContent === label);
        const s = (i) => { const t = getComputedStyle(i.nextElementSibling); const tr = i.nextElementSibling.getBoundingClientRect(), th = i.nextElementSibling.firstElementChild.getBoundingClientRect(); return { bc: t.borderTopColor, bg: t.backgroundColor, thumb: getComputedStyle(i.nextElementSibling.firstElementChild).borderTopColor, x: th.left - tr.left, outline: `${t.outlineStyle} ${t.outlineWidth}`, disabled: i.disabled }; };
        return { off: s(q("Off · Default")), offHover: s(q("Off · Hover")), onHover: s(q("On · Hover")), focus: s(q("On · Focus-visible")), onDis: s(q("On · Disabled")) };
      });
      assert(ws.off.bc === colour("color.border.input", "financial") && ws.offHover.bc === colour("color.border.strong", "financial") && ws.offHover.thumb === colour("color.icon.default", "financial") && ws.onHover.bg === colour("color.control.checked-hover", "financial"), `Switch pseudo hover ${JSON.stringify(ws)}`);
      assert(ws.focus.outline === `solid ${resolve("focus.width.indicator", "financial").value}px` && ws.onDis.disabled && ws.onDis.bg === colour("color.surface.disabled", "financial") && Math.abs(ws.off.x - 4) < 0.5 && Math.abs(ws.onDis.x - 24) < 0.5, `Switch pseudo focus/disabled/position ${JSON.stringify(ws)}`);
      await wp.close();
    }
    lines.push("Switch States story: pseudo-states addon applies the real row :hover (border/strong + icon/default thumb Off, checked-hover track On) and track :focus-visible (3px ring); disabled is native; thumb position Off 4px / On 24px — no state props");
    {
      const { page: tp } = await open("id=components-text-field--states&viewMode=story", "storyFinished");
      await tp.waitForTimeout(300);
      const ts = await tp.evaluate(() => {
        const inputs = [...document.querySelectorAll(".ch-text-field__input")];
        const q = (label) => inputs.find((i) => i.labels[0].textContent === label);
        const s = (i) => { const c = getComputedStyle(i); return { bg: c.backgroundColor, bc: c.borderTopColor, bw: c.borderTopWidth, outline: `${c.outlineStyle} ${c.outlineWidth}`, disabled: i.disabled, readOnly: i.readOnly, invalid: i.getAttribute("aria-invalid") }; };
        return { def: s(q("Default")), hover: s(q("Hover")), focus: s(q("Focus-visible")), dis: s(q("Disabled")), ro: s(q("Read-only")), err: s(q("Error · Default")), errHover: s(q("Error · Hover")), errFocus: s(q("Error · Focus-visible")), count: inputs.length };
      });
      const iw = `solid ${resolve("focus.width.indicator", "financial").value}px`;
      assert(ts.count === 8 && ts.def.bc === colour("color.border.input", "financial") && ts.hover.bc === colour("color.border.strong", "financial") && ts.focus.bc === colour("color.border.input", "financial") && ts.focus.outline === iw, `Text Field pseudo hover/focus ${JSON.stringify(ts)}`);
      assert(ts.dis.disabled && ts.dis.bg === colour("color.surface.disabled", "financial") && ts.ro.readOnly && ts.ro.bg === colour("color.surface.sunken", "financial") && ts.ro.bc === colour("color.border.input", "financial"), `Text Field disabled/read-only ${JSON.stringify(ts)}`);
      for (const e of [ts.err, ts.errHover, ts.errFocus]) assert(e.invalid === "true" && e.bc === colour("color.feedback.error.border", "financial") && e.bw === `${resolve("border-width.strong", "financial").value}px`, `Text Field error states ${JSON.stringify(e)}`);
      assert(ts.errFocus.outline === iw, `Text Field error + focus ring ${JSON.stringify(ts.errFocus)}`);
      await tp.close();
    }
    lines.push("Text Field States story: the 8 designed states — pseudo-states addon applies the real :hover (border/strong) and :focus-visible (3px ring, border kept) rules; Disabled and Read-only are the native attributes (surface/disabled; surface/sunken + border/input); Error × Default/Hover/Focus-visible keep the 2px feedback/error/border and combine with the ring — no state props");
    lines.push("Link States story: pseudo-states addon applies the real rules — underline 1px at rest; :hover (via @media (hover: hover)) hover colour + 2px underline; :focus-visible 3px ring with the underline kept — no state props");
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    rmSync(out, { recursive: true, force: true });
  }
  return lines;
}
