// AUTHORED. Compile-time API contract for Button v1 (ADR 0010 §2). Checked by `tsc --noEmit` (tests/check-react-types.mjs).
// Every @ts-expect-error line MUST fail to compile; if one compiles, tsc reports an unused directive and the check fails.
import { useRef } from "react";
import { Button } from "../../src";

export function ApiContract() {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      {/* allowed */}
      <Button>Continue</Button>
      <Button hierarchy="secondary" size="lg" type="submit" disabled ref={ref} onClick={(e) => e.currentTarget.blur()}>Save</Button>
      <Button hierarchy="tertiary" size="sm" type="reset" form="f" name="n" value="v" id="x" className="extra" aria-describedby="hint" data-testid="t">Reset</Button>
      <Button hierarchy="destructive" aria-label="Delete transaction 12 Sep">Delete transaction</Button>

      {/* excluded by ADR 0010 */}
      {/* @ts-expect-error — unknown hierarchy */}
      <Button hierarchy="ghost">x</Button>
      {/* @ts-expect-error — unknown size */}
      <Button size="xl">x</Button>
      {/* @ts-expect-error — invalid type */}
      <Button type="link">x</Button>
      {/* @ts-expect-error — loading is deferred (G6) */}
      <Button loading>x</Button>
      {/* @ts-expect-error — icons are deferred (G6) */}
      <Button leadingIcon={<span />}>x</Button>
      {/* @ts-expect-error — icons are deferred (G6) */}
      <Button trailingIcon={<span />}>x</Button>
      {/* @ts-expect-error — no navigation: use Link */}
      <Button href="/x">x</Button>
      {/* @ts-expect-error — no polymorphism */}
      <Button as="a">x</Button>
      {/* @ts-expect-error — width is a layout concern */}
      <Button fullWidth>x</Button>
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Button hover>x</Button>
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Button pressed>x</Button>
      {/* @ts-expect-error — interaction states are CSS, not props */}
      <Button focus>x</Button>
      {/* @ts-expect-error — no custom disabled behaviour API in v1 */}
      <Button disabledBehavior="focusable">x</Button>
    </>
  );
}
