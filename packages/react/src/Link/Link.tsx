// AUTHORED. Chavosh Financial — Link v1 (standalone, labels only). Contract: docs/decisions/0013-link-v1-implementation-mapping.md.
// A native <a href>: it navigates to a destination or resource (actions are Buttons). Visual states (hover,
// focus-visible) are CSS, not props. Brand comes from the token stylesheet via data-brand on an ancestor — there is
// no brand logic here.
import type { ComponentPropsWithRef, ReactNode } from "react";
import "./link.css";

export type LinkSize = "md" | "sm";

export interface LinkProps extends Omit<ComponentPropsWithRef<"a">, "href" | "children"> {
  /** Destination. Required: a Link without a destination is not a link (render plain text instead). */
  href: string;
  /** Default `"md"` (`label/md`); `"sm"` uses `label/sm`. Both keep the 44px minimum target. */
  size?: LinkSize;
  /** Visible label — also the accessible name. It must make sense out of context. */
  children: ReactNode;
}

/**
 * Link v1 — standalone navigation link. Always underlined. Native anchor attributes (target, rel, download,
 * hrefLang, onClick, id, className, aria-*, data-*, …) and `ref` (React 19 ref-as-prop) reach the <a>. `style` exists
 * only because it is a native attribute: it is not a supported way to override design-system visual properties.
 */
export function Link({ size = "md", className, children, ...native }: LinkProps) {
  return (
    <a {...native} className={className ? `ch-link ${className}` : "ch-link"} data-size={size}>
      {children}
    </a>
  );
}
