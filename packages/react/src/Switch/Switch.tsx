// AUTHORED. Chavosh Financial — Switch v1. Contract: docs/decisions/0016-switch-v1-implementation-mapping.md.
// A binary setting that takes effect immediately: a native <input type="checkbox" role="switch"> inside a wrapping
// <label> (the whole row is the target), text first and the control trailing. The accessible name is the label text
// (aria-labelledby); supporting text is the description (aria-describedby). On/off is the native `checked` property,
// exposed as the switch's checked state; visual states and motion are CSS. Brand comes from data-brand on an ancestor —
// there is no brand logic here. There is no Switch Group component.
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import "./switch.css";

export interface SwitchProps extends Omit<ComponentPropsWithRef<"input">, "type" | "role" | "children" | "size"> {
  /** Visible label — also the accessible name. Required. It does not change with the state (no On/Off text). */
  label: ReactNode;
  /** Optional supporting text under the label; exposed as the description (aria-describedby). */
  supportingText?: ReactNode;
}

/**
 * Switch v1. Native checkbox attributes (checked, defaultChecked, onChange, disabled, name, value, required, form, id,
 * aria-*, data-*, …) and `ref` (React 19 ref-as-prop) reach the <input>. The form-field `name` is only what you pass —
 * it is never derived from the label. `className` is applied to the row (the layout element); `style` exists only
 * because it is a native attribute and is not a supported way to override design-system visual properties.
 */
export function Switch({ label, supportingText, className, id, "aria-describedby": describedBy, ...native }: SwitchProps) {
  const auto = useId();
  const inputId = id ?? `${auto}-input`;
  const labelId = `${auto}-label`;
  const supportId = `${auto}-support`;
  const hasSupport = supportingText !== undefined && supportingText !== null && supportingText !== false && supportingText !== "";
  const describedByIds = [describedBy, hasSupport ? supportId : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <label className={className ? `ch-switch ${className}` : "ch-switch"}>
      <span className="ch-switch__text">
        <span className="ch-switch__label" id={labelId}>{label}</span>
        {hasSupport ? <span className="ch-switch__supporting" id={supportId}>{supportingText}</span> : null}
      </span>
      <span className="ch-switch__control">
        <input {...native} type="checkbox" role="switch" id={inputId} className="ch-switch__input" aria-labelledby={labelId} aria-describedby={describedByIds} />
        <span className="ch-switch__track" aria-hidden="true">
          <span className="ch-switch__thumb" />
        </span>
      </span>
    </label>
  );
}
