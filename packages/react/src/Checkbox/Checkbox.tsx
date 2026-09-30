// AUTHORED. Chavosh Financial — Checkbox v1. Contract: docs/decisions/0014-checkbox-v1-implementation-mapping.md.
// One boolean choice: a native <input type="checkbox"> inside a wrapping <label> (the whole row is the target). The
// accessible name is the label text (aria-labelledby, so supporting text never enters the name); supporting text is
// the description (aria-describedby). Checked/indeterminate/disabled are the native properties; visual states are CSS.
// Brand comes from the token stylesheet via data-brand on an ancestor — there is no brand logic here.
import { useCallback, useId, useLayoutEffect, useRef, type ComponentPropsWithRef, type ReactNode, type Ref } from "react";
import "./checkbox.css";

export interface CheckboxProps extends Omit<ComponentPropsWithRef<"input">, "type" | "children" | "size"> {
  /** Visible label — also the accessible name. Required, also when `hideLabel` is set. Do not put links or other interactive content in it. */
  label: ReactNode;
  /** Optional supporting text under the label; exposed as the description (aria-describedby). */
  supportingText?: ReactNode;
  /** Visually hides the label (and supporting text) while keeping it as the accessible name, e.g. in table rows. Default `false`. */
  hideLabel?: boolean;
  /** Shows the "mixed" state (dash) for a parent with partially selected children. Not a submitted value: the form submits `checked`. Default `false`. */
  indeterminate?: boolean;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

/**
 * Checkbox v1. Native input attributes (checked, defaultChecked, onChange, disabled, name, value, required, form, id,
 * aria-*, data-*, …) and `ref` (React 19 ref-as-prop) reach the <input>. `className` is applied to the row (the
 * layout element); `style` exists only because it is a native attribute and is not a supported way to override
 * design-system visual properties.
 */
export function Checkbox({ label, supportingText, hideLabel = false, indeterminate = false, className, id, ref, "aria-describedby": describedBy, ...native }: CheckboxProps) {
  const auto = useId();
  const inputId = id ?? `${auto}-input`;
  const labelId = `${auto}-label`;
  const supportId = `${auto}-support`;
  const hasSupport = supportingText !== undefined && supportingText !== null && supportingText !== false && supportingText !== "";
  const describedByIds = [describedBy, hasSupport ? supportId : undefined].filter(Boolean).join(" ") || undefined;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const setRef = useCallback((el: HTMLInputElement | null) => { inputRef.current = el; assignRef(ref, el); }, [ref]);
  // `indeterminate` exists only as a DOM property. Re-applied after every render: a user click clears it natively,
  // and the owner decides the next state through its own onChange → render.
  useLayoutEffect(() => { if (inputRef.current) inputRef.current.indeterminate = indeterminate; });

  return (
    <label className={className ? `ch-checkbox ${className}` : "ch-checkbox"} data-hide-label={hideLabel ? "" : undefined}>
      <span className="ch-checkbox__control">
        <input {...native} ref={setRef} type="checkbox" id={inputId} className="ch-checkbox__input" aria-labelledby={labelId} aria-describedby={describedByIds} />
        <span className="ch-checkbox__box" aria-hidden="true">
          {/* Internal glyph geometry from the Figma component (20×20 box incl. border): check and dash. Not an icon. */}
          <svg className="ch-checkbox__glyph" viewBox="0 0 20 20" focusable="false" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path className="ch-checkbox__check" d="M5.5 10.5 L8.5 13.5 L14.5 6.5" />
            <path className="ch-checkbox__dash" d="M6 10 L14 10" />
          </svg>
        </span>
      </span>
      <span className="ch-checkbox__text">
        <span className="ch-checkbox__label" id={labelId}>{label}</span>
        {hasSupport ? <span className="ch-checkbox__supporting" id={supportId}>{supportingText}</span> : null}
      </span>
    </label>
  );
}
