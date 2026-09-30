// AUTHORED. Storybook stories for Radio v1 — the real production component (./Radio), never a recreation.
// Contract: docs/decisions/0015-radio-v1-implementation-mapping.md. Stories add no props beyond the Radio API and no
// design values: layout comes from .storybook/storybook.css (neutral structure only), colours and sizes from tokens.
// Groups are native <fieldset>/<legend> composition with a shared `name` — there is no RadioGroup component in v1.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Radio } from "./Radio";

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
] as const;

const meta = {
  title: "Components/Radio",
  component: Radio,
  args: { label: "Monthly", supportingText: "", name: "playground", value: "monthly", disabled: false, defaultChecked: false, onChange: fn() },
  argTypes: {
    label: { control: "text", description: "Visible label — also the accessible name. Required.", table: { type: { summary: "ReactNode" } } },
    supportingText: { control: "text", description: "Optional supporting text under the label, announced as the description.", table: { type: { summary: "ReactNode" } } },
    name: { control: "text", description: "Native form-field name. Radios with the same name form one group. Only what you pass — never derived from the label.", table: { type: { summary: "string" } } },
    value: { control: "text", description: "Native value submitted when this radio is selected.", table: { type: { summary: "string" } } },
    disabled: { control: "boolean", description: "Native disabled: skipped by Tab and arrow keys, cannot be selected.", table: { defaultValue: { summary: "false" } } },
    defaultChecked: { control: "boolean", description: "Native initial selection (uncontrolled). Use `checked` + `onChange` for controlled use.", table: { defaultValue: { summary: "false" } } },
    onChange: { control: false, table: { category: "Events" } },
  },
  parameters: { controls: { include: ["label", "supportingText", "name", "value", "disabled", "defaultChecked"] } },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explore the real Radio API. Click the label or the circle to select it. */
export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const radio = within(canvasElement).getByRole("radio", { name: "Monthly" });
    await expect(radio).toHaveAttribute("name", "playground");
    await userEvent.click(within(canvasElement).getByText("Monthly"));
    await expect(radio).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

/** Unselected is an empty ring; Selected adds the dot — the selection never relies on colour alone. */
export const Selection: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack">
      <Radio name="selection-demo-a" value="a" label="Unselected" />
      <Radio name="selection-demo-b" value="b" label="Selected" defaultChecked />
    </div>
  ),
};

const STATES = [
  { label: "Default", demo: undefined },
  { label: "Hover", demo: "hover" },
  { label: "Focus-visible", demo: "focus" },
  { label: "Disabled", demo: "disabled" },
] as const;

/**
 * Static demonstration of the browser states. Hover (on the whole row) and Focus-visible (on the circle) are simulated
 * with the Storybook pseudo-states addon, which applies Radio's real :hover / :focus-visible CSS — Radio has no state
 * props. Disabled is the native attribute. Each example has its own name so the selections can be shown side by side.
 */
export const States: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: ['.ch-radio:has([data-demo-state="hover"])'], focusVisible: ['[data-demo-state="focus"]'] },
  },
  render: () => (
    <div className="sb-stack">
      {(["Unselected", "Selected"] as const).map((sel) => (
        <div className="sb-grid" key={sel}>
          {STATES.map((st) => (
            <Radio key={st.label} name={`states-${sel}-${st.label}`} value="v" label={`${sel} · ${st.label}`} defaultChecked={sel === "Selected"} disabled={st.demo === "disabled"} data-demo-state={st.demo} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Supporting text adds detail under the label and is announced as the radio's description. */
export const SupportingText: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <fieldset className="sb-fieldset">
      <legend className="sb-legend">Statement delivery</legend>
      <Radio name="delivery" value="email" label="Email" supportingText="Available the day it is issued" defaultChecked />
      <Radio name="delivery" value="post" label="Post" supportingText="Arrives within 5 business days" />
    </fieldset>
  ),
};

/**
 * A group: native <fieldset> + <legend>, and the same `name` on every radio. The browser keeps a single selection.
 * If "none" is a valid answer, offer it as an explicit option. Group-level required rules and error messages
 * ("Select a payment frequency") belong to a future Radio Group — Radio itself has no error state.
 */
export const Group: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <fieldset className="sb-fieldset">
      <legend className="sb-legend">Contribution type</legend>
      <Radio name="contribution" value="fixed" label="Fixed amount" supportingText="The same amount every pay" />
      <Radio name="contribution" value="percent" label="Percentage of salary" defaultChecked />
      <Radio name="contribution" value="none" label="No preference" />
    </fieldset>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByText("Fixed amount"));
    await expect(c.getByRole("radio", { name: "Fixed amount" })).toBeChecked();
    await expect(c.getByRole("radio", { name: "Percentage of salary" })).not.toBeChecked();
    await expect(c.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked)).toHaveLength(1);
  },
};

/** The same Radios in both brand contexts, side by side, through the production data-brand attribute. Only the selected ring and dot change. */
export const BrandComparison: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-row">
      {(["financial", "invest"] as const).map((brand) => (
        <div className="sb-panel" data-brand={brand} key={brand}>
          <fieldset className="sb-fieldset">
            <legend className="sb-legend">data-brand="{brand}"</legend>
            {FREQUENCIES.map((f, i) => (
              <Radio key={f.value} name={`brand-${brand}`} value={f.value} label={f.label} defaultChecked={i === 0} />
            ))}
          </fieldset>
        </div>
      ))}
    </div>
  ),
};

/** Constrained width: label and supporting text wrap, the circle stays on the first line, and nothing is clipped. */
export const LongLabel: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow">
      <Radio name="long" value="full" label="Pay the full statement balance on the due date every month" supportingText="The amount is taken from your everyday account" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector(".ch-radio") as HTMLElement;
    const circle = row.querySelector(".ch-radio__circle") as HTMLElement;
    const label = row.querySelector(".ch-radio__label") as HTMLElement;
    const lh = parseFloat(getComputedStyle(label).lineHeight);
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(lh);
    await expect(circle.getBoundingClientRect().top).toBeLessThan(label.getBoundingClientRect().top + lh);
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  },
};

/**
 * Keyboard (native): Tab enters the group as one stop; arrow keys move focus and selection together and skip disabled
 * options; Space selects the focused radio. Changing the selection must not submit or trigger financial recalculation.
 */
export const Keyboard: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <fieldset className="sb-fieldset">
      <legend className="sb-legend">Payment frequency</legend>
      <Radio name="kb-frequency" value="monthly" label="Monthly" />
      <Radio name="kb-frequency" value="weekly" label="Weekly (unavailable)" disabled />
      <Radio name="kb-frequency" value="quarterly" label="Quarterly" />
      <Radio name="kb-frequency" value="annually" label="Annually" />
    </fieldset>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const monthly = c.getByRole("radio", { name: "Monthly" });
    await userEvent.tab();
    await expect(monthly).toHaveFocus();
    await expect(monthly.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard(" ");
    await expect(monthly).toBeChecked();
    await userEvent.keyboard("{ArrowDown}");
    const quarterly = c.getByRole("radio", { name: "Quarterly" });
    await expect(quarterly).toHaveFocus();
    await expect(quarterly).toBeChecked();
    await expect(monthly).not.toBeChecked();
  },
};

/** Native disabled: skipped by Tab and arrow keys, cannot be selected. A selected disabled radio keeps its dot. */
export const Disabled: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <fieldset className="sb-fieldset">
      <legend className="sb-legend">Statement format</legend>
      <Radio name="format" value="pdf" label="PDF" defaultChecked disabled />
      <Radio name="format" value="csv" label="CSV (unavailable)" disabled />
    </fieldset>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const csv = c.getByRole("radio", { name: "CSV (unavailable)" });
    await expect(csv).toBeDisabled();
    await userEvent.click(c.getByText("CSV (unavailable)"), { pointerEventsCheck: 0 });
    await expect(csv).not.toBeChecked();
    await expect(c.getByRole("radio", { name: "PDF" })).toBeChecked();
    await userEvent.tab();
    await expect(csv).not.toHaveFocus();
  },
};
