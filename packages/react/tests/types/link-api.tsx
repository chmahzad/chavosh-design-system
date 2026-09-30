// AUTHORED. Compile-time API contract for Link v1 (ADR 0013 §2). Checked by `tsc --noEmit` (check-react-types.mjs
// compiles tests/types; check-link-tokens.mjs adds a Link-specific self-test). Every @ts-expect-error line MUST fail
// to compile; if one compiles, tsc reports an unused directive and the check fails.
import { useRef } from "react";
import { Link } from "../../src";

export function LinkApiContract() {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <>
      {/* allowed */}
      <Link href="/transactions">View transactions</Link>
      <Link href="/fees" size="sm" ref={ref} onClick={(e) => e.currentTarget.blur()}>Learn more about fees</Link>
      <Link href="/statement.pdf" download hrefLang="en" type="application/pdf" id="x" className="extra" aria-describedby="hint" data-testid="t">Download statement (PDF, 240 KB)</Link>
      <Link href="https://example.com/privacy" target="_blank" rel="noopener noreferrer">Privacy policy (opens in a new tab)</Link>

      {/* excluded by ADR 0013 */}
      {/* @ts-expect-error — href is required (no link without a destination) */}
      <Link>View transactions</Link>
      {/* @ts-expect-error — the visible label is required */}
      <Link href="/x" />
      {/* @ts-expect-error — unknown size */}
      <Link href="/x" size="lg">x</Link>
      {/* @ts-expect-error — no disabled Link (render plain text instead) */}
      <Link href="/x" disabled>x</Link>
      {/* @ts-expect-error — no polymorphism */}
      <Link href="/x" as="button">x</Link>
      {/* @ts-expect-error — no polymorphism */}
      <Link href="/x" asChild>x</Link>
      {/* @ts-expect-error — icons are out of v1 scope */}
      <Link href="/x" leadingIcon={<span />}>x</Link>
      {/* @ts-expect-error — icons are out of v1 scope */}
      <Link href="/x" trailingIcon={<span />}>x</Link>
      {/* @ts-expect-error — no visited styling API */}
      <Link href="/x" visited>x</Link>
      {/* @ts-expect-error — no hierarchy/variant (emphasis comes from context) */}
      <Link href="/x" variant="primary">x</Link>
      {/* @ts-expect-error — current page belongs to Navigation components */}
      <Link href="/x" current>x</Link>
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Link href="/x" hover>x</Link>
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Link href="/x" focus>x</Link>
      {/* @ts-expect-error — href must be a string */}
      <Link href={42}>x</Link>
    </>
  );
}
