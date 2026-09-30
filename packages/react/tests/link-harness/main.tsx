// AUTHORED. Browser test harness for Link v1 (not a demo, not Storybook). The token stylesheet is loaded ONCE here, at
// the application entry, exactly as consumers must do. Layout here uses no design values.
import "@chavosh/tokens/ch-tokens.css";
import { createRoot } from "react-dom/client";
import { Link, type LinkSize } from "../../src";

// __clicks and __ready are declared by the Button harness (same TypeScript program); only the Link ref is added here.
declare global {
  interface Window {
    __linkRef: HTMLAnchorElement | null;
  }
}
window.__clicks = {};
// Counts activations and keeps the page in place (navigation itself is tested separately on "nav").
const count = (k: string) => (e: { preventDefault: () => void }) => { e.preventDefault(); window.__clicks[k] = (window.__clicks[k] ?? 0) + 1; };

const SIZES: LinkSize[] = ["md", "sm"];

function Matrix({ ctx }: { ctx: string }) {
  return (
    <div>
      {SIZES.map((s) => {
        const id = `${ctx}-${s}`;
        return <div key={id}><Link data-testid={id} href="#matrix" size={s} onClick={count(id)}>View transactions</Link></div>;
      })}
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
        <Link data-testid="default" href="#default">View transactions</Link>
        <Link data-testid="native" id="native-id" href="/statement.pdf" download="statement.pdf" hrefLang="en" type="application/pdf" target="_blank" rel="noopener noreferrer" title="Statement" aria-describedby="hint" data-extra="yes" className="consumer-class" onClick={count("native")}>Download statement (PDF, 240 KB)</Link>
        <Link data-testid="ref" href="#ref" ref={(el) => { window.__linkRef = el; }}>With ref</Link>
        <span id="hint">Opens the PDF</span>
      </section>

      <section id="keyboard">
        <button data-testid="before" type="button">before</button>
        <Link data-testid="kb-1" href="#kb" onClick={count("kb-1")}>Investment options</Link>
        <Link data-testid="nav" href="#destination">Back to account overview</Link>
        <p id="destination">Destination</p>
      </section>

      <section id="wrap" style={{ width: "9em" }}>
        <Link data-testid="wrap-md" href="#wrap">Learn more about fees for international transfers and currency conversion</Link>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => { window.__ready = true; });
