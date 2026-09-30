// AUTHORED. Browser test harness for Text Field v1 (not a demo, not Storybook). The token stylesheet is loaded ONCE here,
// at the application entry, exactly as consumers must do. Layout here uses no design values.
// __clicks and __ready are declared by the Button harness (same TypeScript program); only Text Field globals are added.
import "@chavosh/tokens/ch-tokens.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TextField } from "../../src";

declare global {
  interface Window {
    __tfRef: HTMLInputElement | null;
    __tfChanges: number;
    __tfSubmitted: string[] | null | undefined;
    __tfControlled: string;
  }
}
window.__clicks = {};
window.__tfChanges = 0;
window.__tfSubmitted = undefined;
window.__tfControlled = "";

function Matrix({ ctx }: { ctx: string }) {
  return (
    <div>
      <TextField data-testid={`${ctx}-default`} label="Account name" defaultValue="Everyday" />
      <TextField data-testid={`${ctx}-placeholder`} label="Nickname" placeholder="e.g. Holiday fund" />
      <TextField data-testid={`${ctx}-disabled`} label="Account name" defaultValue="Everyday" disabled />
      <TextField data-testid={`${ctx}-disabled-ph`} label="Nickname" placeholder="e.g. Holiday fund" disabled />
      <TextField data-testid={`${ctx}-readonly`} label="Customer ID" defaultValue="CF-1234" readOnly />
      <TextField data-testid={`${ctx}-error`} label="Mobile" defaultValue="0412" errorMessage="Enter a 10-digit mobile number" />
    </div>
  );
}

function Controlled() {
  const [v, setV] = useState("");
  window.__tfControlled = v;
  return (
    <div>
      <TextField data-testid="controlled" label="Reference" value={v} onChange={(e) => setV(e.currentTarget.value.toUpperCase())} />
      <TextField data-testid="locked" label="Fixed" value="LOCKED" onChange={() => undefined} />
    </div>
  );
}

function Validated() {
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <TextField data-testid="validated" label="Email" type="email" helperText="We'll send your statements here" errorMessage={error}
      onBlur={(e) => setError(e.currentTarget.value.includes("@") ? undefined : "Enter an email address in the format name@example.com")} />
  );
}

function App() {
  return (
    <main style={{ maxWidth: "30em" }}>
      <section id="financial"><Matrix ctx="financial" /></section>
      <section data-brand="invest"><Matrix ctx="invest" /></section>
      <section data-brand="invest"><div data-brand="financial"><Matrix ctx="fin-in-inv" /></div></section>
      <section data-brand="financial"><div data-brand="invest"><Matrix ctx="inv-in-fin" /></div></section>

      <section id="structure">
        <TextField data-testid="plain" label="Account name" />
        <TextField data-testid="full" label="Email" optional helperText="We'll send your statements here" errorMessage="Enter an email address" aria-describedby="extra" />
        <span id="extra">Extra description</span>
        <TextField data-testid="helper-only" label="Mobile" helperText="For example 0412 345 678" />
        <TextField data-testid="native" id="native-id" label="Account number" name="accountNumber" inputMode="numeric" autoComplete="off" maxLength={9} title="Account number" className="consumer-class" onChange={() => { window.__tfChanges += 1; }} />
        <TextField data-testid="ref" label="With ref" ref={(el) => { window.__tfRef = el; }} />
        <TextField data-testid="typed" label="Email" type="email" />
        <TextField data-testid="empty-error" label="Empty error" errorMessage="" />
        <form id="f1" onSubmit={(e) => { e.preventDefault(); window.__tfSubmitted = [...new FormData(e.currentTarget).entries()].map(([k, v]) => `${k}=${String(v)}`); }}>
          <TextField data-testid="f-required" label="Full name" name="fullName" required />
          <TextField data-testid="f-readonly" label="Customer ID" name="customerId" defaultValue="CF-1234" readOnly />
          <TextField data-testid="f-disabled" label="Branch" name="branch" defaultValue="Sydney" disabled />
          <TextField data-testid="f-unnamed" label="Unnamed" defaultValue="not submitted" />
          <button data-testid="submit" type="submit">Submit</button>
        </form>
        <fieldset disabled data-testid="fs">
          <legend>Disabled group</legend>
          <TextField data-testid="in-disabled-fieldset" label="Postcode" defaultValue="2000" />
        </fieldset>
        <Controlled />
        <Validated />
      </section>

      <section id="keyboard">
        <button data-testid="before" type="button">before</button>
        <TextField data-testid="kb-1" label="First" />
        <TextField data-testid="kb-disabled" label="Unavailable" disabled />
        <TextField data-testid="kb-readonly" label="Read-only" defaultValue="Fixed value" readOnly />
        <TextField data-testid="kb-2" label="Second" />
      </section>

      <section id="wrap" style={{ width: "9em" }}>
        <TextField data-testid="wrap" label="Contribution amount for this financial year" optional helperText="Enter the amount before tax, in Australian dollars" errorMessage="The amount must be less than your concessional contributions cap" defaultValue="A very long value that is wider than the field" />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => { window.__ready = true; });
