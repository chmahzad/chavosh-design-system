// AUTHORED. Compile-time API contract for Text Field v1 (ADR 0017 §2). Checked by `tsc --noEmit` (check-react-types.mjs
// compiles tests/types; check-text-field-tokens.mjs adds a Text Field-specific self-test). Every @ts-expect-error line
// MUST fail to compile; if one compiles, tsc reports an unused directive and the check fails.
import { useRef } from "react";
import { TextField } from "../../src";

export function TextFieldApiContract() {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {/* allowed */}
      <TextField label="Account name" />
      <TextField label="Email" type="email" autoComplete="email" helperText="We'll send your statements here" optional name="email" />
      <TextField label="Mobile" type="tel" autoComplete="tel" helperText="For example 0412 345 678" errorMessage="Enter a mobile number" required />
      <TextField label="Account number" inputMode="numeric" value="123" onChange={(e) => e.currentTarget.value} ref={ref} />
      <TextField label="Customer ID" defaultValue="CF-1234" readOnly id="cid" className="field" aria-describedby="hint" data-testid="t" placeholder="Optional hint" />
      <TextField label="Website" type="url" disabled form="f" maxLength={80} pattern="https://.*" onBlur={() => undefined} />
      <TextField label="Password" type="password" autoComplete="current-password" />

      {/* excluded by ADR 0017 */}
      {/* @ts-expect-error — the label is required (persistent visible label, accessible name) */}
      <TextField name="x" />
      {/* @ts-expect-error — no type="number": use inputMode for numbers, BSB and amounts */}
      <TextField label="x" type="number" />
      {/* @ts-expect-error — not a text field type */}
      <TextField label="x" type="checkbox" />
      {/* @ts-expect-error — search is a future Search component */}
      <TextField label="x" type="search" />
      {/* @ts-expect-error — no children: the label prop is the label */}
      <TextField label="x">x</TextField>
      {/* @ts-expect-error — the invalid state comes only from errorMessage */}
      <TextField label="x" aria-invalid />
      {/* @ts-expect-error — the error message is the description, not aria-errormessage */}
      <TextField label="x" aria-errormessage="e" />
      {/* @ts-expect-error — the error prop is errorMessage */}
      <TextField label="x" error="Required" />
      {/* @ts-expect-error — no leading icon in v1 */}
      <TextField label="x" leadingIcon="search" />
      {/* @ts-expect-error — one size in v1 */}
      <TextField label="x" size="sm" />
      {/* @ts-expect-error — no hidden label: the label is persistent and visible */}
      <TextField label="x" hideLabel />
      {/* @ts-expect-error — no success/warning validation in v1 */}
      <TextField label="x" validation="success" />
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <TextField label="x" hover />
      {/* @ts-expect-error — optional is a boolean indicator, not custom text */}
      <TextField label="x" optional="(not required)" />
    </>
  );
}
