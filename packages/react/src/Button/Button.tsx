// AUTHORED. Chavosh Financial — Button v1 (labels only). Contract: docs/decisions/0010-button-v1-implementation-mapping.md.
// A native <button>. Visual states (hover, pressed, focus-visible, disabled) are CSS, not props. Brand comes from
// the token stylesheet via data-brand on an ancestor — there is no brand logic here.
import type { ComponentPropsWithRef } from "react";
import "./button.css";

export type ButtonHierarchy = "primary" | "secondary" | "tertiary" | "destructive";
/** `sm` is RESTRICTED (ADR 0010 §6): dense Desktop/Tablet data contexts only; not production-ready where the effective 44×44 target is required. */
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ComponentPropsWithRef<"button">, "type"> {
  /** Visual hierarchy. Default `"primary"` — one primary action per view. */
  hierarchy?: ButtonHierarchy;
  /** Default `"md"`. */
  size?: ButtonSize;
  /** Default `"button"` (never an accidental form submit). Pass `"submit"` or `"reset"` explicitly. */
  type?: "button" | "submit" | "reset";
}

/**
 * Button v1 — triggers an action. The visible children are the label and accessible name.
 * Native attributes (disabled, onClick, form, name, value, id, className, aria-*, data-*, …) and `ref` (React 19
 * ref-as-prop) reach the <button>. `style` exists only because it is a native attribute: it is not a supported
 * way to override design-system visual properties.
 */
export function Button({ hierarchy = "primary", size = "md", type = "button", className, children, ...native }: ButtonProps) {
  return (
    <button {...native} type={type} className={className ? `ch-button ${className}` : "ch-button"} data-hierarchy={hierarchy} data-size={size}>
      {children}
    </button>
  );
}
