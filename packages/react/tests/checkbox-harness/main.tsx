// AUTHORED. Browser test harness for Checkbox v1 (not a demo, not Storybook). The token stylesheet is loaded ONCE here,
// at the application entry, exactly as consumers must do. Layout here uses no design values.
// __clicks and __ready are declared by the Button harness (same TypeScript program); only Checkbox globals are added.
import "@chavosh/tokens/ch-tokens.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Checkbox } from "../../src";

declare global {
  interface Window {
    __cbRef: HTMLInputElement | null;
    __cbChanges: number;
    __submitted: string[] | null;
  }
}
window.__clicks = {};
window.__cbChanges = 0;
window.__submitted = null;

function Matrix({ ctx }: { ctx: string }) {
  return (
    <div>
      {(["unchecked", "checked", "indeterminate"] as const).flatMap((sel) => [false, true].map((d) => {
        const id = `${ctx}-${sel}-${d ? "disabled" : "enabled"}`;
        return <Checkbox key={id} data-testid={id} label="Remember my preference" defaultChecked={sel === "checked"} indeterminate={sel === "indeterminate"} disabled={d} />;
      }))}
    </div>
  );
}

function SelectAll() {
  const [rows, setRows] = useState([true, false, true]);
  const all = rows.every(Boolean);
  const some = rows.some(Boolean) && !all;
  return (
    <div>
      <Checkbox data-testid="all" label="Select all transactions" hideLabel checked={all} indeterminate={some} onChange={() => setRows(rows.map(() => !all))} />
      {rows.map((r, i) => <Checkbox key={i} data-testid={`row-${i}`} label={`Select transaction ${i + 1}`} hideLabel checked={r} onChange={() => setRows(rows.map((x, j) => (j === i ? !x : x)))} />)}
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

      <section id="structure">
        <Checkbox data-testid="default" label="Remember my preference" />
        <Checkbox data-testid="support" label="Email" supportingText="Statements and account notices" aria-describedby="extra" />
        <span id="extra">Extra description</span>
        <Checkbox data-testid="native" id="native-id" label="Marketing messages" name="pref" value="marketing" form="f1" title="Marketing" required className="consumer-class" onChange={() => { window.__cbChanges += 1; }} />
        <Checkbox data-testid="ref" label="With ref" ref={(el) => { window.__cbRef = el; }} />
        <Checkbox data-testid="hidden" label="Select transaction 12 Sep, $120.00" hideLabel />
        <form id="f1" onSubmit={(e) => { e.preventDefault(); window.__submitted = [...new FormData(e.currentTarget).getAll("pref")].map(String); }}>
          <Checkbox data-testid="in-form" label="SMS" name="pref" value="sms" defaultChecked />
          <Checkbox data-testid="in-form-mixed" label="Post" name="pref" value="post" indeterminate />
          <button data-testid="submit" type="submit">Submit</button>
        </form>
        <fieldset disabled data-testid="fs">
          <legend>Disabled group</legend>
          <Checkbox data-testid="in-disabled-fieldset" label="Paper statements" defaultChecked />
        </fieldset>
      </section>

      <section id="select-all"><SelectAll /></section>

      <section id="keyboard">
        <button data-testid="before" type="button">before</button>
        <Checkbox data-testid="kb-1" label="Show balances" />
        <Checkbox data-testid="kb-disabled" label="Unavailable" disabled />
        <Checkbox data-testid="kb-2" label="Face ID" />
      </section>

      <section id="wrap" style={{ width: "9em" }}>
        <Checkbox data-testid="wrap" label="Email me when my statement is ready and when a payment is due" supportingText="You can change this at any time in your notification settings" />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => { window.__ready = true; });
