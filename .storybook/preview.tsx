// AUTHORED. Storybook preview for the Chavosh Financial Design System.
// - The generated token stylesheet is loaded ONCE here, exactly as an application entry would. Components import
//   their own CSS (Button → button.css). No token values are defined in Storybook.
// - Brand: the toolbar sets data-brand on the story wrapper — the production runtime (--ch-brand-* → semantic
//   tokens re-declared on [data-brand]). No React conditionals, no Storybook-specific tokens.
// - Viewports are preview sizes that sit in each band of the frozen web breakpoints (Tablet ≥ 48rem, Desktop ≥ 64rem);
//   they do not define breakpoints.
import "@chavosh/tokens/ch-tokens.css";
import "./storybook.css";
import type { Decorator, Preview } from "@storybook/react-vite";

export const BRANDS = [
  { value: "financial", title: "Financial" },
  { value: "invest", title: "Invest" },
] as const;

const withBrand: Decorator = (Story, context) => (
  <div data-brand={context.globals.brand ?? "financial"}>
    <Story />
  </div>
);

const preview: Preview = {
  globalTypes: {
    brand: {
      description: "Brand context — sets data-brand on the story wrapper",
      toolbar: { title: "Brand", icon: "paintbrush", items: [...BRANDS], dynamicTitle: true },
    },
  },
  initialGlobals: { brand: "financial" },
  decorators: [withBrand],
  parameters: {
    layout: "padded",
    controls: { expanded: true, sort: "requiredFirst" },
    viewport: {
      options: {
        chMobile: { name: "Mobile · 375", styles: { width: "375px", height: "812px" }, type: "mobile" },
        chTablet: { name: "Tablet · 768", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        chDesktop: { name: "Desktop · 1024", styles: { width: "1024px", height: "768px" }, type: "desktop" },
      },
    },
    a11y: { test: "error" },
    options: {
      storySort: { order: ["Introduction", "Foundations", ["Design tokens"], "Components", ["Button"]] },
    },
  },
};

export default preview;
