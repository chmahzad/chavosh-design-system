// AUTHORED. Compile-time API contract for Switch v1 (ADR 0016 §2). Checked by `tsc --noEmit` (check-react-types.mjs
// compiles tests/types; check-switch-tokens.mjs adds a Switch-specific self-test). Every @ts-expect-error line MUST fail
// to compile; if one compiles, tsc reports an unused directive and the check fails.
import { useRef } from "react";
import { Switch } from "../../src";

export function SwitchApiContract() {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* allowed */}
      <Switch label="Show balances on dashboard" />
      <Switch label="Email me when my statement is ready" supportingText="Sent to your registered email" defaultChecked name="statementEmail" value="on" />
      <Switch label="Sign in with Face ID" checked={false} onChange={(e) => e.currentTarget.checked} ref={ref} />
      <Switch label="Marketing messages" disabled required form="f" id="marketing" className="row" aria-describedby="hint" data-testid="t" />

      {/* excluded by ADR 0016 */}
      {/* @ts-expect-error — the label is required (accessible name) */}
      <Switch name="x" />
      {/* @ts-expect-error — the type is always checkbox */}
      <Switch label="x" type="radio" />
      {/* @ts-expect-error — the role is always switch */}
      <Switch label="x" role="checkbox" />
      {/* @ts-expect-error — no children: the label prop is the label */}
      <Switch label="x">x</Switch>
      {/* @ts-expect-error — a switch is never indeterminate */}
      <Switch label="x" indeterminate />
      {/* @ts-expect-error — no visible On/Off text in v1 */}
      <Switch label="x" onLabel="On" />
      {/* @ts-expect-error — pending/loading feedback belongs to the surrounding pattern */}
      <Switch label="x" loading />
      {/* @ts-expect-error — no error state */}
      <Switch label="x" error="Could not save" />
      {/* @ts-expect-error — no size variants in v1 */}
      <Switch label="x" size="sm" />
      {/* @ts-expect-error — no hidden label in v1 */}
      <Switch label="x" hideLabel />
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Switch label="x" hover />
      {/* @ts-expect-error — the form-field name is a string (never derived from the label) */}
      <Switch label="x" name={42} />
    </>
  );
}
