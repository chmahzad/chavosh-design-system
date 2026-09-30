// AUTHORED. Browser test harness for Switch v1 (not a demo, not Storybook). The token stylesheet is loaded ONCE here, at
// the application entry, exactly as consumers must do. Layout here uses no design values.
// __clicks and __ready are declared by the Button harness (same TypeScript program); only Switch globals are added.
import "@chavosh/tokens/ch-tokens.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Switch } from "../../src";

declare global {
  interface Window {
    __swRef: HTMLInputElement | null;
    __swChanges: number;
    __swSubmitted: string[] | null | undefined;
    __swControlled: boolean;
  }
}
window.__clicks = {};
window.__swChanges = 0;
window.__swSubmitted = undefined;
window.__swControlled = false;

function Matrix({ ctx }: { ctx: string }) {
  return (
    <div>
      {(["off", "on"] as const).flatMap((c) => [false, true].map((d) => {
        const id = `${ctx}-${c}-${d ? "disabled" : "enabled"}`;
        return <Switch key={id} data-testid={id} label="Show balances" defaultChecked={c === "on"} disabled={d} />;
      }))}
    </div>
  );
}

function Controlled() {
  const [on, setOn] = useState(false);
  window.__swControlled = on;
  return (
    <div>
      <Switch data-testid="controlled" label="Sign in with Face ID" checked={on} onChange={(e) => setOn(e.currentTarget.checked)} />
      <Switch data-testid="locked" label="Locked by policy" checked onChange={() => undefined} />
    </div>
  );
}

function App() {
  return (
    <main>
      <section id="financial"><Matrix ctx="financial" /></section>
      <section data-brand="invest"><Matrix ctx="invest" /></section>
      <section data-brand="invest"><div data-brand="financial"><Matrix ctx="fin-in-inv" /></div></section>
      <section data-brand="financial"><div data-brand="invest"><Matrix ctx="inv-in-fin" /></div></section>
      <section dir="rtl"><Switch data-testid="rtl-on" label="عرض الأرصدة" defaultChecked /></section>

      <section id="structure">
        <Switch data-testid="default" label="Show balances on dashboard" />
        <Switch data-testid="support" label="Marketing messages" supportingText="Offers and product news" aria-describedby="extra" />
        <span id="extra">Extra description</span>
        <Switch data-testid="native" id="native-id" label="Statement email" name="statementEmail" value="yes" title="Statement email" className="consumer-class" onChange={() => { window.__swChanges += 1; }} />
        <Switch data-testid="ref" label="With ref" ref={(el) => { window.__swRef = el; }} />
        <form id="f1" onSubmit={(e) => { e.preventDefault(); window.__swSubmitted = [...new FormData(e.currentTarget).entries()].map(([k, v]) => `${k}=${String(v)}`); }}>
          <Switch data-testid="f-required" label="I have read the key facts" name="keyFacts" value="read" required />
          <Switch data-testid="f-default" label="Paperless statements" name="paperless" />
          <button data-testid="submit" type="submit">Submit</button>
        </form>
        <fieldset disabled data-testid="fs">
          <legend>Disabled settings</legend>
          <Switch data-testid="in-disabled-fieldset" label="Round-up savings" defaultChecked />
        </fieldset>
        <Controlled />
      </section>

      <section id="keyboard">
        <button data-testid="before" type="button">before</button>
        <Switch data-testid="kb-1" label="Show balances" />
        <Switch data-testid="kb-disabled" label="Unavailable" disabled />
        <Switch data-testid="kb-2" label="Face ID" />
      </section>

      <section id="wrap" style={{ width: "9em" }}>
        <Switch data-testid="wrap" label="Email me when my statement is ready and when a payment is due" supportingText="You can change this at any time" />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => { window.__ready = true; });
