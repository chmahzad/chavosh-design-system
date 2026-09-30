// AUTHORED. Chavosh Financial — Text Field v1. Contract: docs/decisions/0017-text-field-v1-implementation-mapping.md.
// A single-line native <input> with a persistent visible <label for>, optional helper text and an error message. The
// accessible name is the label (incl. the visible "(optional)" indicator); the description is the error message, then
// the helper text, then any consumer aria-describedby. `errorMessage` is the only source of the error treatment and of
// aria-invalid. Disabled and read-only are the native attributes; visual states are CSS. Brand comes from the token
// stylesheet via data-brand on an ancestor — there is no brand logic here.
import { useId, type ComponentPropsWithRef, type ReactNode } from "react";
import "./text-field.css";

export interface TextFieldProps extends Omit<ComponentPropsWithRef<"input">, "type" | "children" | "size" | "aria-invalid" | "aria-errormessage"> {
  /** Persistent visible label — also the accessible name. Required. Never replaced by the placeholder. */
  label: ReactNode;
  /** Optional instructions under the label (e.g. a format hint); exposed as a description (aria-describedby). */
  helperText?: ReactNode;
  /** Error message. When set, the field shows the error treatment (2px error border, icon, message) and is exposed as invalid (aria-invalid) with the message as the first description. */
  errorMessage?: ReactNode;
  /** Adds the visible "(optional)" indicator to the label (part of the accessible name). Mark required fields with the native `required` instead. Default `false`. */
  optional?: boolean;
  /** Native single-line text types. Use `inputMode` (not `type="number"`) for account numbers, BSB and amounts. Default `"text"`. */
  type?: "text" | "email" | "tel" | "url" | "password";
  /** Not accepted: the invalid state comes only from `errorMessage` (so it always has a visible, described message). */
  "aria-invalid"?: never;
  /** Not accepted: the error message is exposed through aria-describedby. */
  "aria-errormessage"?: never;
}

const present = (n: ReactNode) => n !== undefined && n !== null && n !== false && n !== "";

/**
 * Text Field v1. Native input attributes (value, defaultValue, onChange, onBlur, placeholder, name, required, disabled,
 * readOnly, autoComplete, inputMode, maxLength, pattern, form, id, aria-*, data-*, …) and `ref` (React 19 ref-as-prop)
 * reach the <input>. `className` is applied to the field wrapper; `style` exists only because it is a native attribute
 * and is not a supported way to override design-system visual properties.
 */
export function TextField({ label, helperText, errorMessage, optional = false, type = "text", className, id, "aria-describedby": describedBy, ...native }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? `${auto}-input`;
  const helperId = `${auto}-helper`;
  const errorId = `${auto}-error`;
  const hasHelper = present(helperText);
  const hasError = present(errorMessage);
  const describedByIds = [hasError ? errorId : undefined, hasHelper ? helperId : undefined, describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className ? `ch-text-field ${className}` : "ch-text-field"}>
      <label className="ch-text-field__label" htmlFor={inputId}>
        <span className="ch-text-field__label-text">{label}</span>
        {optional ? <span className="ch-text-field__optional">(optional)</span> : null}
      </label>
      {hasHelper ? <span className="ch-text-field__helper" id={helperId}>{helperText}</span> : null}
      <input {...native} type={type} id={inputId} className="ch-text-field__input" aria-invalid={hasError ? true : undefined} aria-describedby={describedByIds} />
      {hasError ? (
        <span className="ch-text-field__error" id={errorId}>
          {/* Temporary Icon/alert-circle artwork (Figma Foundations, pending the Icon system; ADR 0017). Decorative: the message carries the meaning. */}
          <svg className="ch-text-field__error-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4.66667V8.66667M8 11H8.00667M14 8C14 8.78793 13.8448 9.56815 13.5433 10.2961C13.2417 11.0241 12.7998 11.6855 12.2426 12.2426C11.6855 12.7998 11.0241 13.2417 10.2961 13.5433C9.56815 13.8448 8.78793 14 8 14C7.21207 14 6.43185 13.8448 5.7039 13.5433C4.97595 13.2417 4.31451 12.7998 3.75736 12.2426C3.20021 11.6855 2.75825 11.0241 2.45672 10.2961C2.15519 9.56815 2 8.78793 2 8C2 6.4087 2.63214 4.88258 3.75736 3.75736C4.88258 2.63214 6.4087 2 8 2C9.5913 2 11.1174 2.63214 12.2426 3.75736C13.3679 4.88258 14 6.4087 14 8Z" />
          </svg>
          <span className="ch-text-field__error-text">{errorMessage}</span>
        </span>
      ) : null}
    </div>
  );
}
