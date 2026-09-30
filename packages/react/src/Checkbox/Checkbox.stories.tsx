// AUTHORED. Storybook stories for Checkbox v1 — the real production component (./Checkbox), never a recreation.
// Contract: docs/decisions/0014-checkbox-v1-implementation-mapping.md. Stories add no props beyond the Checkbox API and
// no design values: layout comes from .storybook/storybook.css (neutral structure only), colours and sizes from tokens.
// Groups are shown as native <fieldset>/<legend> composition — there is no CheckboxGroup component in v1.
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Checkbox } from "./Checkbox";

const SELECTIONS = [
  { label: "Unchecked", checked: false, indeterminate: false },
  { label: "Checked", checked: true, indeterminate: false },
  { label: "Indeterminate", checked: false, indeterminate: true },
] as const;

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  args: { label: "Remember my preference", supportingText: "", hideLabel: false, indeterminate: false, disabled: false, defaultChecked: false, onChange: fn() },
  argTypes: {
    label: { control: "text", description: "Visible label — also the accessible name. Required, also when the label is hidden.", table: { type: { summary: "ReactNode" } } },
    supportingText: { control: "text", description: "Optional supporting text under the label, announced as the description.", table: { type: { summary: "ReactNode" } } },
    hideLabel: { control: "boolean", description: "Visually hides the label (e.g. in table rows); it stays the accessible name.", table: { defaultValue: { summary: "false" } } },
    indeterminate: { control: "boolean", description: 'Shows the "mixed" state for a parent with partially selected children. Not a submitted value.', table: { defaultValue: { summary: "false" } } },
    disabled: { control: "boolean", description: "Native disabled: removed from the tab order, cannot change.", table: { defaultValue: { summary: "false" } } },
    defaultChecked: { control: "boolean", description: "Native initial checked state (uncontrolled). Use `checked` + `onChange` for controlled use.", table: { defaultValue: { summary: "false" } } },
    onChange: { control: false, table: { category: "Events" } },
  },
  parameters: { controls: { include: ["label", "supportingText", "hideLabel", "indeterminate", "disabled", "defaultChecked"] } },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explore the real Checkbox API. Click the label or the box, or Tab and press Space. */
export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const box = within(canvasElement).getByRole("checkbox", { name: "Remember my preference" });
    await userEvent.click(within(canvasElement).getByText("Remember my preference"));
    await expect(box).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

/** Unchecked has no glyph, Checked a check and Indeterminate a dash — the selection never relies on colour alone. */
export const Selection: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack">
      {SELECTIONS.map((s) => (
        <Checkbox key={s.label} label={s.label} defaultChecked={s.checked} indeterminate={s.indeterminate} />
      ))}
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
 * Static demonstration of the browser states. Hover (on the whole row) and Focus-visible (on the box) are simulated
 * with the Storybook pseudo-states addon, which applies Checkbox's real :hover / :focus-visible CSS — Checkbox has no
 * state props. Disabled is the native attribute. Interact with the Playground for the real behaviour.
 */
export const States: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: ['.ch-checkbox:has([data-demo-state="hover"])'], focusVisible: ['[data-demo-state="focus"]'] },
  },
  render: () => (
    <div className="sb-stack">
      {SELECTIONS.map((s) => (
        <div className="sb-grid" key={s.label}>
          {STATES.map((st) => (
            <Checkbox key={st.label} label={`${s.label} · ${st.label}`} defaultChecked={s.checked} indeterminate={s.indeterminate} disabled={st.demo === "disabled"} data-demo-state={st.demo} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Supporting text adds detail under the label and is announced as the checkbox's description. */
export const SupportingText: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack">
      <Checkbox label="Email" supportingText="Statements, payment reminders and account notices" defaultChecked />
      <Checkbox label="Text message" supportingText="Security codes and urgent alerts only" />
    </div>
  ),
};

const TRANSACTIONS = [
  { date: "12 Sep", payee: "Harbour Energy", amount: "$120.00" },
  { date: "14 Sep", payee: "City Water", amount: "$64.20" },
  { date: "19 Sep", payee: "Northside Rent", amount: "$1,450.00" },
];

/**
 * Select all transactions: the header checkbox is Indeterminate while some rows are selected. Indeterminate is a
 * visual "mixed" state derived from the rows — it is set by the owner, never submitted. Labels are visually hidden,
 * but every checkbox keeps a full accessible name.
 */
export const SelectAll: Story = {
  parameters: { controls: { disable: true } },
  render: function SelectAllStory() {
    const [rows, setRows] = useState([true, false, true]);
    const all = rows.every(Boolean);
    const some = rows.some(Boolean) && !all;
    return (
      <table className="sb-table">
        <thead>
          <tr>
            <th scope="col">
              <Checkbox label="Select all transactions" hideLabel checked={all} indeterminate={some} onChange={() => setRows(rows.map(() => !all))} />
            </th>
            <th scope="col">Date</th>
            <th scope="col">Payee</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {TRANSACTIONS.map((t, i) => (
            <tr key={t.date}>
              <td>
                <Checkbox label={`Select transaction ${t.date}, ${t.payee}, ${t.amount}`} hideLabel checked={rows[i]} onChange={() => setRows(rows.map((x, j) => (j === i ? !x : x)))} />
              </td>
              <td>{t.date}</td>
              <td>{t.payee}</td>
              <td>{t.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const all = c.getByRole("checkbox", { name: "Select all transactions" }) as HTMLInputElement;
    await expect(all.indeterminate).toBe(true);
    await userEvent.click(all);
    for (const box of c.getAllByRole("checkbox")) await expect(box).toBeChecked();
    await userEvent.click(c.getByRole("checkbox", { name: /14 Sep/ }));
    await expect(all.indeterminate).toBe(true);
  },
};

/**
 * Several related options: native <fieldset> + <legend> composition. Group-level required rules and error messages
 * belong to a future Checkbox Group / field wrapper — Checkbox itself has no error state.
 */
export const Group: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <fieldset className="sb-fieldset">
      <legend className="sb-legend">Communication preferences</legend>
      <Checkbox name="channels" value="email" label="Email" supportingText="Statements and account notices" defaultChecked />
      <Checkbox name="channels" value="sms" label="Text message" supportingText="Security codes and urgent alerts" />
      <Checkbox name="channels" value="post" label="Post" />
    </fieldset>
  ),
};

/** The same Checkboxes in both brand contexts, side by side, through the production data-brand attribute. Only the selection colour changes. */
export const BrandComparison: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-row">
      {(["financial", "invest"] as const).map((brand) => (
        <div className="sb-panel" data-brand={brand} key={brand}>
          <div className="sb-stack">
            <p className="sb-caption">data-brand="{brand}"</p>
            {SELECTIONS.map((s) => (
              <Checkbox key={s.label} label={s.label} defaultChecked={s.checked} indeterminate={s.indeterminate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Constrained width: label and supporting text wrap, the box stays on the first line, and nothing is clipped. */
export const LongLabel: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow">
      <Checkbox label="Email me when my statement is ready and when a payment is due" supportingText="You can change this at any time in your notification settings" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector(".ch-checkbox") as HTMLElement;
    const box = row.querySelector(".ch-checkbox__box") as HTMLElement;
    const label = row.querySelector(".ch-checkbox__label") as HTMLElement;
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(parseFloat(getComputedStyle(label).lineHeight));
    await expect(box.getBoundingClientRect().top).toBeLessThan(label.getBoundingClientRect().top + parseFloat(getComputedStyle(label).lineHeight));
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
  },
};

/** Keyboard: Tab focuses the checkbox and shows the focus ring on the box; Space toggles it; Enter does not. */
export const Keyboard: Story = {
  parameters: { controls: { disable: true } },
  play: async ({ args, canvasElement }) => {
    const box = within(canvasElement).getByRole("checkbox", { name: "Remember my preference" });
    await userEvent.tab();
    await expect(box).toHaveFocus();
    await expect(box.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard(" ");
    await expect(box).toBeChecked();
    await userEvent.keyboard("{Enter}");
    await expect(box).toBeChecked();
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};

/** Native disabled: not focusable and cannot change. The structure (check / dash) stays visible in every selection. */
export const Disabled: Story = {
  args: { disabled: true, label: "Paper statements", defaultChecked: true },
  play: async ({ args, canvasElement }) => {
    const box = within(canvasElement).getByRole("checkbox", { name: "Paper statements" });
    await expect(box).toBeDisabled();
    await userEvent.click(within(canvasElement).getByText("Paper statements"), { pointerEventsCheck: 0 });
    await expect(box).toBeChecked();
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    await expect(box).not.toHaveFocus();
  },
};
