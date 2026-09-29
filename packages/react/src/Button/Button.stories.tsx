// AUTHORED. Storybook stories for Button v1 — the real production component (./Button), never a recreation.
// Contract: docs/decisions/0010-button-v1-implementation-mapping.md. Stories add no props beyond the Button API and
// no design values: layout comes from .storybook/storybook.css (neutral structure only), colours and sizes from tokens.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button, type ButtonHierarchy, type ButtonSize } from "./Button";

const HIERARCHIES: { value: ButtonHierarchy; label: string; example: string }[] = [
  { value: "primary", label: "Primary", example: "Transfer money" },
  { value: "secondary", label: "Secondary", example: "View statement" },
  { value: "tertiary", label: "Tertiary", example: "Cancel" },
  { value: "destructive", label: "Destructive", example: "Delete payee" },
];
const SIZES: { value: ButtonSize; label: string; note: string }[] = [
  { value: "lg", label: "lg", note: "Prominent actions; production-ready." },
  { value: "md", label: "md (default)", note: "Default size; production-ready." },
  { value: "sm", label: "sm — restricted", note: "Dense Desktop/Tablet data contexts only. Does not yet implement the effective 44×44 hit area — not production-ready where that target is required." },
];

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Continue", hierarchy: "primary", size: "md", type: "button", disabled: false, onClick: fn() },
  argTypes: {
    hierarchy: {
      control: "inline-radio",
      options: ["primary", "secondary", "tertiary", "destructive"],
      description: "Visual hierarchy. Use one Primary action per view.",
      table: { type: { summary: '"primary" | "secondary" | "tertiary" | "destructive"' }, defaultValue: { summary: '"primary"' } },
    },
    size: {
      control: "inline-radio",
      options: ["lg", "md", "sm"],
      description: "Control size. `sm` is restricted (dense Desktop/Tablet data contexts; effective 44×44 target not yet implemented).",
      table: { type: { summary: '"sm" | "md" | "lg"' }, defaultValue: { summary: '"md"' } },
    },
    type: {
      control: "inline-radio",
      options: ["button", "submit", "reset"],
      description: 'Native button type. Defaults to "button" so it never submits a form by accident.',
      table: { type: { summary: '"button" | "submit" | "reset"' }, defaultValue: { summary: '"button"' } },
    },
    disabled: { control: "boolean", description: "Native disabled: removed from the tab order, not activatable.", table: { defaultValue: { summary: "false" } } },
    children: { control: "text", description: "Visible label — also the accessible name.", table: { type: { summary: "ReactNode" } } },
    onClick: { control: false, table: { category: "Events" } },
  },
  parameters: { controls: { include: ["hierarchy", "size", "type", "disabled", "children"] } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explore the real Button API. Hover, press and Tab to see the browser states. */
export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Continue" });
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute("type", "button");
  },
};

export const Hierarchies: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-grid">
      {HIERARCHIES.map((h) => (
        <div className="sb-cell" key={h.value}>
          <Button hierarchy={h.value}>{h.example}</Button>
          <p className="sb-caption">{h.label}</p>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack">
      {SIZES.map((s) => (
        <div className="sb-cell" key={s.value}>
          <Button size={s.value}>Continue</Button>
          <p className="sb-caption">
            <strong>{s.label}</strong> — {s.note}
          </p>
        </div>
      ))}
    </div>
  ),
};

const STATES = [
  { label: "Default", demo: undefined },
  { label: "Hover", demo: "hover" },
  { label: "Pressed", demo: "pressed" },
  { label: "Focus-visible", demo: "focus" },
  { label: "Disabled", demo: "disabled" },
] as const;

/**
 * Static demonstration of the browser states. Hover, Pressed and Focus-visible are simulated with the Storybook
 * pseudo-states addon (it applies the real :hover / :active / :focus-visible CSS rules to the marked examples) —
 * Button has no state props. Interact with the Playground for the real browser behaviour.
 */
export const States: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: ['[data-demo-state="hover"]'], active: ['[data-demo-state="pressed"]'], focusVisible: ['[data-demo-state="focus"]'] },
  },
  render: () => (
    <div className="sb-stack">
      {HIERARCHIES.map((h) => (
        <div className="sb-grid" key={h.value}>
          {STATES.map((s) => (
            <div className="sb-cell" key={s.label}>
              <Button hierarchy={h.value} disabled={s.demo === "disabled"} data-demo-state={s.demo}>
                {h.label}
              </Button>
              <p className="sb-caption">{s.label}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** The same Buttons in both brand contexts, side by side, through the production data-brand attribute. The toolbar Brand switch does not apply here — both brands are shown. */
export const BrandComparison: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-row">
      {(["financial", "invest"] as const).map((brand) => (
        <div className="sb-panel" data-brand={brand} key={brand}>
          <div className="sb-stack">
            <p className="sb-caption">data-brand="{brand}"</p>
            {HIERARCHIES.map((h) => (
              <Button hierarchy={h.value} key={h.value}>
                {h.example}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Constrained width: the label wraps, the control grows beyond its minimum height, and nothing is clipped. */
export const LongLabel: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow">
      <Button hierarchy="secondary">Review and confirm your scheduled payment details</Button>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    const style = getComputedStyle(button);
    await expect(button.getBoundingClientRect().height).toBeGreaterThan(parseFloat(style.minHeight));
    await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
    await expect(button.scrollHeight).toBeLessThanOrEqual(button.clientHeight);
  },
};

/** Native disabled only in Button v1: not focusable, not activatable, never underlined. There is no focusable aria-disabled API. */
export const Disabled: Story = {
  args: { disabled: true, children: "Continue" },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Continue" });
    await expect(button).toBeDisabled();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(button).not.toHaveFocus();
  },
};

/** Keyboard: Tab focuses the button and shows the focus ring; Enter and Space each activate it once. */
export const Keyboard: Story = {
  args: { children: "Continue" },
  parameters: { controls: { disable: true } },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Continue" });
    await userEvent.tab();
    await expect(button).toHaveFocus();
    await expect(button.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(2);
  },
};
