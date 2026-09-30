// AUTHORED. Compile-time API contract for Checkbox v1 (ADR 0014 §2). Checked by `tsc --noEmit` (check-react-types.mjs
// compiles tests/types; check-checkbox-tokens.mjs adds a Checkbox-specific self-test). Every @ts-expect-error line MUST
// fail to compile; if one compiles, tsc reports an unused directive and the check fails.
import { useRef } from "react";
import { Checkbox } from "../../src";

export function CheckboxApiContract() {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* allowed */}
      <Checkbox label="Remember my preference" />
      <Checkbox label="Email" supportingText="Statements and account notices" defaultChecked name="channels" value="email" />
      <Checkbox label="Select all transactions" hideLabel indeterminate checked={false} onChange={(e) => e.currentTarget.checked} ref={ref} />
      <Checkbox label="I agree to the terms" required disabled form="f" id="terms" className="row" aria-describedby="terms-error" data-testid="t" />

      {/* excluded by ADR 0014 */}
      {/* @ts-expect-error — the label is required (accessible name) */}
      <Checkbox />
      {/* @ts-expect-error — the type is always checkbox */}
      <Checkbox label="x" type="radio" />
      {/* @ts-expect-error — no children: the label prop is the label */}
      <Checkbox label="x">x</Checkbox>
      {/* @ts-expect-error — validation lives in the future group / field wrapper */}
      <Checkbox label="x" error="Required" />
      {/* @ts-expect-error — validation lives in the future group / field wrapper */}
      <Checkbox label="x" invalid />
      {/* @ts-expect-error — no size variants in v1 */}
      <Checkbox label="x" size="sm" />
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Checkbox label="x" hover />
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Checkbox label="x" focus />
      {/* @ts-expect-error — no icon swap */}
      <Checkbox label="x" icon={<span />} />
      {/* @ts-expect-error — hideLabel is a boolean */}
      <Checkbox label="x" hideLabel="yes" />
      {/* @ts-expect-error — indeterminate is a boolean */}
      <Checkbox label="x" indeterminate="mixed" />
    </>
  );
}
