// AUTHORED. Storybook stories for Switch v1 — the real production component (./Switch), never a recreation.
// Contract: docs/decisions/0016-switch-v1-implementation-mapping.md. Stories add no props beyond the Switch API and no
// design values: layout comes from .storybook/storybook.css (neutral structure only), colours and sizes from tokens.
// Settings lists are native <fieldset>/<legend> composition — there is no Switch Group component.
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Switch } from "./Switch";

const meta = {
  title: "Components/Switch",
  component: Switch,
  args: { label: "Show balances on dashboard", supportingText: "", disabled: false, defaultChecked: false, onChange: fn() },
  argTypes: {
    label: { control: "text", description: "Visible label — also the accessible name. Required. It never changes with the state.", table: { type: { summary: "ReactNode" } } },
    supportingText: { control: "text", description: "Optional supporting text under the label, announced as the description.", table: { type: { summary: "ReactNode" } } },
    disabled: { control: "boolean", description: "Native disabled: removed from the tab order, cannot change.", table: { defaultValue: { summary: "false" } } },
    defaultChecked: { control: "boolean", description: "Native initial state (uncontrolled). Use `checked` + `onChange` for controlled use.", table: { defaultValue: { summary: "false" } } },
    onChange: { control: false, table: { category: "Events" } },
  },
  parameters: { controls: { include: ["label", "supportingText", "disabled", "defaultChecked"] } },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explore the real Switch API. Click anywhere on the row, or Tab and press Space. */
export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const sw = within(canvasElement).getByRole("switch", { name: "Show balances on dashboard" });
    await expect(sw).not.toBeChecked();
    await userEvent.click(within(canvasElement).getByText("Show balances on dashboard"));
    await expect(sw).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

const STATES = [
  { label: "Default", demo: undefined },
  { label: "Hover", demo: "hover" },
  { label: "Focus-visible", demo: "focus" },
  { label: "Disabled", demo: "disabled" },
] as const;

/**
 * Static demonstration of the browser states. Hover (on the whole row) and Focus-visible (on the track) are simulated
 * with the Storybook pseudo-states addon, which applies Switch's real :hover / :focus-visible CSS — Switch has no state
 * props. Disabled is the native attribute. Off and On differ by thumb position in every state, not only by colour.
 */
export const States: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: ['.ch-switch:has([data-demo-state="hover"])'], focusVisible: ['[data-demo-state="focus"]'] },
  },
  render: () => (
    <div className="sb-grid">
      {(["Off", "On"] as const).map((c) => (
        <div className="sb-stack" key={c}>
          {STATES.map((st) => (
            <Switch key={st.label} label={`${c} · ${st.label}`} defaultChecked={c === "On"} disabled={st.demo === "disabled"} data-demo-state={st.demo} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Supporting text adds detail under the label and is announced as the switch's description. */
export const SupportingText: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow-md">
      <Switch label="Email me when my statement is ready" supportingText="Sent to your registered email address" defaultChecked />
    </div>
  ),
};

/**
 * A settings list: independent switches composed with a native <fieldset> and <legend>. Each switch takes effect
 * immediately and is its own tab stop — there is no Switch Group component.
 */
export const Settings: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <fieldset className="sb-fieldset sb-narrow-md">
      <legend className="sb-legend">Security and notifications</legend>
      <Switch label="Show balances on dashboard" defaultChecked />
      <Switch label="Sign in with Face ID or fingerprint" />
      <Switch label="Email me when my statement is ready" supportingText="Sent to your registered email address" defaultChecked />
      <Switch label="Marketing messages" supportingText="Offers and product news" />
    </fieldset>
  ),
};

/**
 * Controlled use: the owner keeps the state (`checked` + `onChange`) and the setting takes effect immediately — here the
 * balance becomes visible. If an effect is not visible, announce the result with a status message.
 */
export const Controlled: Story = {
  parameters: { controls: { disable: true } },
  render: function ControlledStory() {
    const [show, setShow] = useState(false);
    return (
      <div className="sb-stack sb-narrow-md">
        <Switch label="Show balances on dashboard" checked={show} onChange={(e) => setShow(e.currentTarget.checked)} />
        <p className="sb-caption" data-testid="balance">Everyday account: {show ? "$4,210.50" : "balance hidden"}</p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("switch", { name: "Show balances on dashboard" }));
    await expect(c.getByRole("switch", { name: "Show balances on dashboard" })).toBeChecked();
    await expect(c.getByText(/\$4,210\.50/)).toBeInTheDocument();
  },
};

/** The same Switches in both brand contexts, side by side, through the production data-brand attribute. Only the On track changes. */
export const BrandComparison: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-row">
      {(["financial", "invest"] as const).map((brand) => (
        <div className="sb-panel sb-narrow-md" data-brand={brand} key={brand}>
          <div className="sb-stack">
            <p className="sb-caption">data-brand="{brand}"</p>
            <Switch label="Show balances" defaultChecked />
            <Switch label="Marketing messages" />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Constrained width: label and supporting text wrap, the switch stays trailing on the first line, and nothing is clipped. */
export const LongLabel: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow">
      <Switch label="Email me when my statement is ready and when a payment is due" supportingText="You can change this at any time" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector(".ch-switch") as HTMLElement;
    const track = row.querySelector(".ch-switch__track") as HTMLElement;
    const label = row.querySelector(".ch-switch__label") as HTMLElement;
    const lh = parseFloat(getComputedStyle(label).lineHeight);
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(lh);
    await expect(track.getBoundingClientRect().top).toBeLessThan(label.getBoundingClientRect().top + lh);
    await expect(track.getBoundingClientRect().left).toBeGreaterThanOrEqual(label.getBoundingClientRect().right);
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  },
};

/** Keyboard: Tab focuses the switch and shows the focus ring on the track; Space toggles it; Enter does not. */
export const Keyboard: Story = {
  parameters: { controls: { disable: true } },
  play: async ({ args, canvasElement }) => {
    const sw = within(canvasElement).getByRole("switch", { name: "Show balances on dashboard" });
    await userEvent.tab();
    await expect(sw).toHaveFocus();
    await expect(sw.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard(" ");
    await expect(sw).toBeChecked();
    await userEvent.keyboard("{Enter}");
    await expect(sw).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

/** Native disabled: not focusable and cannot change. The thumb keeps its Off/On position. */
export const Disabled: Story = {
  args: { disabled: true, label: "Round-up savings", defaultChecked: true },
  play: async ({ args, canvasElement }) => {
    const sw = within(canvasElement).getByRole("switch", { name: "Round-up savings" });
    await expect(sw).toBeDisabled();
    await userEvent.click(within(canvasElement).getByText("Round-up savings"), { pointerEventsCheck: 0 });
    await expect(sw).toBeChecked();
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(sw).not.toHaveFocus();
  },
};
