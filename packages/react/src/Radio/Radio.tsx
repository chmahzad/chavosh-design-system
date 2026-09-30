// AUTHORED. Chavosh Financial — Radio v1. Contract: docs/decisions/0015-radio-v1-implementation-mapping.md.
// One option of a mutually exclusive set: a native <input type="radio"> inside a wrapping <label> (the whole row is the
// target). Radios that share the native `name` form one group; the browser owns single selection, arrow-key movement and
// tab stops. There is no RadioGroup component in v1. The accessible name is the label text (aria-labelledby, so
// supporting text never enters the name); supporting text is the description (aria-describedby). Selected/disabled are
// the native properties; visual states are CSS. Brand comes from data-brand on an ancestor — no brand logic here.
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import "./radio.css";

export interface RadioProps extends Omit<ComponentPropsWithRef<"input">, "type" | "children" | "size"> {
  /** Visible label — also the accessible name. Required. Do not put links or other interactive content in it. */
  label: ReactNode;
  /** Optional supporting text under the label; exposed as the description (aria-describedby). */
  supportingText?: ReactNode;
}

/**
 * Radio v1. Native input attributes (name, value, checked, defaultChecked, onChange, disabled, required, form, id,
 * aria-*, data-*, …) and `ref` (React 19 ref-as-prop) reach the <input>. The form-field `name` is only what you pass —
 * it is never derived from the label. `className` is applied to the row (the layout element); `style` exists only
 * because it is a native attribute and is not a supported way to override design-system visual properties.
 */
export function Radio({ label, supportingText, className, id, "aria-describedby": describedBy, ...native }: RadioProps) {
  const auto = useId();
  const inputId = id ?? `${auto}-input`;
  const labelId = `${auto}-label`;
  const supportId = `${auto}-support`;
  const hasSupport = supportingText !== undefined && supportingText !== null && supportingText !== false && supportingText !== "";
  const describedByIds = [describedBy, hasSupport ? supportId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <label className={className ? `ch-radio ${className}` : "ch-radio"}>
      <span className="ch-radio__control">
        <input {...native} type="radio" id={inputId} className="ch-radio__input" aria-labelledby={labelId} aria-describedby={describedByIds} />
        <span className="ch-radio__circle" aria-hidden="true">
          <span className="ch-radio__dot" />
        </span>
      </span>
      <span className="ch-radio__text">
        <span className="ch-radio__label" id={labelId}>{label}</span>
        {hasSupport ? <span className="ch-radio__supporting" id={supportId}>{supportingText}</span> : null}
      </span>
    </label>
  );
}
