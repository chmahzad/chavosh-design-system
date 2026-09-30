// AUTHORED. Compile-time API contract for Radio v1 (ADR 0015 §2). Checked by `tsc --noEmit` (check-react-types.mjs
// compiles tests/types; check-radio-tokens.mjs adds a Radio-specific self-test). Every @ts-expect-error line MUST fail
// to compile; if one compiles, tsc reports an unused directive and the check fails.
import { useRef } from "react";
import { Radio } from "../../src";

export function RadioApiContract() {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* allowed */}
      <Radio label="Monthly" name="frequency" value="monthly" />
      <Radio label="Quarterly" name="frequency" value="quarterly" supportingText="Every three months" defaultChecked />
      <Radio label="Annually" name="frequency" value="annually" checked={false} onChange={(e) => e.currentTarget.checked} ref={ref} />
      <Radio label="No preference" name="frequency" value="none" required disabled form="f" id="none" className="row" aria-describedby="hint" data-testid="t" />

      {/* excluded by ADR 0015 */}
      {/* @ts-expect-error — the label is required (accessible name) */}
      <Radio name="frequency" value="x" />
      {/* @ts-expect-error — the type is always radio */}
      <Radio label="x" type="checkbox" />
      {/* @ts-expect-error — no children: the label prop is the label */}
      <Radio label="x">x</Radio>
      {/* @ts-expect-error — no indeterminate radio */}
      <Radio label="x" indeterminate />
      {/* @ts-expect-error — no hidden label in v1 (a later, non-breaking extension) */}
      <Radio label="x" hideLabel />
      {/* @ts-expect-error — validation lives in the future Radio Group */}
      <Radio label="x" error="Select a payment frequency" />
      {/* @ts-expect-error — validation lives in the future Radio Group */}
      <Radio label="x" invalid />
      {/* @ts-expect-error — no size variants in v1 */}
      <Radio label="x" size="sm" />
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Radio label="x" hover />
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Radio label="x" focus />
      {/* @ts-expect-error — no read-only radio in v1 */}
      <Radio label="x" readOnlyState />
      {/* @ts-expect-error — the form-field name is a string (never derived from the label) */}
      <Radio label="x" name={42} />
    </>
  );
}
