// AUTHORED. Browser test harness for Radio v1 (not a demo, not Storybook). The token stylesheet is loaded ONCE here, at
// the application entry, exactly as consumers must do. Layout here uses no design values.
// __clicks and __ready are declared by the Button harness (same TypeScript program); only Radio globals are added.
import "@chavosh/tokens/ch-tokens.css";
import { createRoot } from "react-dom/client";
import { Radio } from "../../src";

declare global {
  interface Window {
    __rdRef: HTMLInputElement | null;
    __rdChanges: number;
    __rdSubmitted: string | null | undefined;
  }
}
window.__clicks = {};
window.__rdChanges = 0;
window.__rdSubmitted = undefined;

function Matrix({ ctx }: { ctx: string }) {
  return (
    <div>
      {(["unselected", "selected"] as const).flatMap((sel) => [false, true].map((d) => {
        const id = `${ctx}-${sel}-${d ? "disabled" : "enabled"}`;
        return <Radio key={id} data-testid={id} name={id} value="v" label="Monthly" defaultChecked={sel === "selected"} disabled={d} />;
      }))}
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
        <Radio data-testid="default" label="Monthly" />
        <Radio data-testid="support" label="Quarterly" supportingText="Every three months" aria-describedby="extra" />
        <span id="extra">Extra description</span>
        <Radio data-testid="native" id="native-id" label="Annually" name="freq-native" value="annually" title="Annually" required className="consumer-class" onChange={() => { window.__rdChanges += 1; }} />
        <Radio data-testid="ref" label="With ref" ref={(el) => { window.__rdRef = el; }} />
        <form id="f1" onSubmit={(e) => { e.preventDefault(); window.__rdSubmitted = new FormData(e.currentTarget).get("delivery") as string | null; }}>
          <fieldset>
            <legend>Statement delivery</legend>
            <Radio data-testid="del-email" name="delivery" value="email" label="Email" required />
            <Radio data-testid="del-post" name="delivery" value="post" label="Post" />
          </fieldset>
          <button data-testid="submit" type="submit">Submit</button>
        </form>
        <fieldset disabled data-testid="fs">
          <legend>Disabled group</legend>
          <Radio data-testid="in-disabled-fieldset" name="fs" value="a" label="Paper" defaultChecked />
        </fieldset>
      </section>

      <section id="group">
        <button data-testid="before" type="button">before</button>
        <fieldset>
          <legend>Payment frequency</legend>
          <Radio data-testid="g-monthly" name="frequency" value="monthly" label="Monthly" />
          <Radio data-testid="g-quarterly" name="frequency" value="quarterly" label="Quarterly" />
          <Radio data-testid="g-disabled" name="frequency" value="weekly" label="Weekly" disabled />
          <Radio data-testid="g-annually" name="frequency" value="annually" label="Annually" />
        </fieldset>
        <button data-testid="after" type="button">after</button>
        <fieldset>
          <legend>Contribution type</legend>
          <Radio data-testid="c-fixed" name="contribution" value="fixed" label="Fixed amount" />
          <Radio data-testid="c-percent" name="contribution" value="percent" label="Percentage of salary" defaultChecked />
          <Radio data-testid="c-none" name="contribution" value="none" label="No preference" />
        </fieldset>
      </section>

      <section id="wrap" style={{ width: "9em" }}>
        <Radio data-testid="wrap" label="Pay the full statement balance on the due date every month" supportingText="The amount is taken from your everyday account" />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => { window.__ready = true; });
