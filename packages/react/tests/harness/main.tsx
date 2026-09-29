// AUTHORED. Browser test harness for Button v1 (not a demo, not Storybook). The token stylesheet is loaded ONCE here,
// at the application entry, exactly as consumers must do. Layout here uses no design values.
import "@chavosh/tokens/ch-tokens.css";
import { createRoot } from "react-dom/client";
import { Button, type ButtonHierarchy, type ButtonSize } from "../../src";

declare global {
  interface Window {
    __clicks: Record<string, number>;
    __submits: number;
    __ref: HTMLButtonElement | null;
    __ready: boolean;
  }
}
window.__clicks = {};
window.__submits = 0;
const count = (k: string) => () => { window.__clicks[k] = (window.__clicks[k] ?? 0) + 1; };

const HIERARCHIES: ButtonHierarchy[] = ["primary", "secondary", "tertiary", "destructive"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];

function Matrix({ ctx }: { ctx: string }) {
  return (
    <div>
      {HIERARCHIES.flatMap((h) => SIZES.flatMap((s) => [false, true].map((d) => {
        const id = `${ctx}-${h}-${s}-${d ? "disabled" : "enabled"}`;
        return <Button key={id} data-testid={id} hierarchy={h} size={s} disabled={d} onClick={count(id)}>Continue</Button>;
      })))}
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
        <Button data-testid="default">Continue</Button>
        <Button data-testid="native" id="native-id" name="action" value="save" form="f1" title="Save draft" aria-describedby="hint" data-extra="yes" className="consumer-class" tabIndex={0} onClick={count("native")}>Save draft</Button>
        <Button data-testid="ref" ref={(el) => { window.__ref = el; }}>With ref</Button>
        <span id="hint">Saves without submitting</span>
        <form id="f1" onSubmit={(e) => { e.preventDefault(); window.__submits += 1; }}>
          <Button data-testid="in-form-default" onClick={count("in-form-default")}>Default type</Button>
          <Button data-testid="in-form-submit" type="submit">Submit</Button>
          <Button data-testid="in-form-reset" type="reset">Reset</Button>
          <input data-testid="field" name="f" defaultValue="x" />
        </form>
      </section>

      <section id="keyboard">
        <button data-testid="before" type="button">before</button>
        <Button data-testid="kb-1" onClick={count("kb-1")}>First</Button>
        <Button data-testid="kb-disabled" disabled onClick={count("kb-disabled")}>Unavailable</Button>
        <Button data-testid="kb-2" hierarchy="secondary" onClick={count("kb-2")}>Second</Button>
      </section>

      <section id="wrap" style={{ width: "9em" }}>
        <Button data-testid="wrap-md" hierarchy="secondary">Continue to review and confirm your payment details</Button>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => { window.__ready = true; });
