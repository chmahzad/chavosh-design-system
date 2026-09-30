// AUTHORED. Storybook stories for Text Field v1 — the real production component (./TextField), never a recreation.
// Contract: docs/decisions/0017-text-field-v1-implementation-mapping.md. Stories add no props beyond the Text Field API
// (plus native input attributes) and no design values: layout comes from .storybook/storybook.css (neutral structure
// only), colours and sizes from tokens. Disabled + Error and Read-only + Error are unsupported design combinations in v1
// and are never shown.
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { TextField } from "./TextField";

const meta = {
  title: "Components/Text Field",
  component: TextField,
  args: { label: "Account name", helperText: "", errorMessage: "", optional: false, placeholder: "", disabled: false, readOnly: false, onChange: fn() },
  argTypes: {
    label: { control: "text", description: "Persistent visible label — also the accessible name. Required. Never replaced by the placeholder.", table: { type: { summary: "ReactNode" } } },
    helperText: { control: "text", description: "Optional instructions under the label (e.g. a format hint), announced as a description.", table: { type: { summary: "ReactNode" } } },
    errorMessage: { control: "text", description: "Error message. Shows the error treatment (2px error border, icon, message) and marks the field invalid; the message is announced first.", table: { type: { summary: "ReactNode" } } },
    optional: { control: "boolean", description: "Adds \"(optional)\" to the label. Mark required fields with the native `required`.", table: { defaultValue: { summary: "false" } } },
    placeholder: { control: "text", description: "Native placeholder — a hint only, never a replacement for the label. Prefer helper text for format hints.", table: { type: { summary: "string" } } },
    disabled: { control: "boolean", description: "Native disabled: not focusable, not submitted.", table: { defaultValue: { summary: "false" } } },
    readOnly: { control: "boolean", description: "Native readOnly: focusable, selectable and submitted, but not editable.", table: { defaultValue: { summary: "false" } } },
    onChange: { control: false, table: { category: "Events" } },
  },
  parameters: { controls: { include: ["label", "helperText", "errorMessage", "optional", "placeholder", "disabled", "readOnly"] } },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explore the real Text Field API. Click the label or Tab to the field and type. */
export const Playground: Story = {
  decorators: [(Story) => <div className="sb-narrow-md"><Story /></div>],
  play: async ({ args, canvasElement }) => {
    const c = within(canvasElement);
    const input = c.getByRole("textbox", { name: "Account name" });
    await userEvent.click(c.getByText("Account name"));
    await expect(input).toHaveFocus();
    await userEvent.type(input, "Everyday");
    await expect(input).toHaveValue("Everyday");
    await expect(args.onChange).toHaveBeenCalledTimes(8);
  },
};

const STATES = [
  { label: "Default", demo: undefined },
  { label: "Hover", demo: "hover" },
  { label: "Focus-visible", demo: "focus" },
  { label: "Disabled", demo: "disabled" },
  { label: "Read-only", demo: "readonly" },
] as const;
const ERROR_STATES = STATES.slice(0, 3);

/**
 * The eight designed states. Hover and Focus-visible are simulated with the Storybook pseudo-states addon, which applies
 * Text Field's real :hover / :focus-visible CSS — Text Field has no state props. Disabled and Read-only are the native
 * attributes. Error exists for Default, Hover and Focus-visible only.
 */
export const States: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: ['[data-demo-state="hover"]'], focusVisible: ['[data-demo-state="focus"]'] },
  },
  render: () => (
    <div className="sb-stack sb-narrow-md">
      {STATES.map((st) => (
        <TextField key={st.label} label={st.label} defaultValue="Everyday" disabled={st.demo === "disabled"} readOnly={st.demo === "readonly"} data-demo-state={st.demo} />
      ))}
      {ERROR_STATES.map((st) => (
        <TextField key={`e-${st.label}`} label={`Error · ${st.label}`} defaultValue="0412" errorMessage="Enter a 10-digit mobile number" data-demo-state={st.demo} />
      ))}
    </div>
  ),
};

/** Helper text sits between the label and the input and is announced as a description. "(optional)" is part of the label. */
export const HelperAndOptional: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack sb-narrow-md">
      <TextField label="Mobile" type="tel" autoComplete="tel" helperText="For example 0412 345 678" />
      <TextField label="Nickname" optional helperText="Shown on your dashboard instead of the account name" />
      <TextField label="Full name" autoComplete="name" required />
    </div>
  ),
};

/**
 * Error: set `errorMessage` after validation (on submit or blur, not on every keystroke). The field gets a 2px error
 * border, the alert icon and the message; it is exposed as invalid and the message is announced before the helper text.
 */
export const ErrorMessage: Story = {
  parameters: { controls: { disable: true } },
  render: function ErrorStory() {
    const [error, setError] = useState<string | undefined>(undefined);
    return (
      <div className="sb-narrow-md">
        <TextField label="Email" type="email" autoComplete="email" helperText="We'll send your statements here" errorMessage={error}
          onBlur={(e) => setError(e.currentTarget.value.includes("@") ? undefined : "Enter an email address in the format name@example.com")} />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const input = c.getByRole("textbox", { name: "Email" });
    await userEvent.type(input, "name");
    await userEvent.tab();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("Enter an email address in the format name@example.com We'll send your statements here");
    await userEvent.type(input, "@example.com");
    await userEvent.tab();
    await expect(input).not.toHaveAttribute("aria-invalid");
    await expect(input).toHaveAccessibleDescription("We'll send your statements here");
  },
};

/** Common financial fields: the right native type, autocomplete and input mode (never type="number" for account numbers). */
export const FinancialExamples: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack sb-narrow-md">
      <TextField label="Account name" />
      <TextField label="Email" type="email" autoComplete="email" />
      <TextField label="Mobile" type="tel" autoComplete="tel" helperText="For example 0412 345 678" />
      <TextField label="Account number" inputMode="numeric" autoComplete="off" helperText="6 to 9 digits" />
    </div>
  ),
};

/** Disabled is removed from the tab order and not submitted. Read-only stays focusable, selectable and submitted, and never looks disabled. */
export const DisabledAndReadOnly: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack sb-narrow-md">
      <TextField label="Branch" defaultValue="Sydney" disabled />
      <TextField label="Customer ID" defaultValue="CF-1234" readOnly />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const disabled = c.getByRole("textbox", { name: "Branch" });
    const readOnly = c.getByRole("textbox", { name: "Customer ID" });
    await expect(disabled).toBeDisabled();
    await userEvent.tab();
    await expect(readOnly).toHaveFocus();
    await userEvent.keyboard("X");
    await expect(readOnly).toHaveValue("CF-1234");
  },
};

/** The same fields in both brand contexts. Text Field has no brand-dependent colours, by design. */
export const BrandComparison: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-row">
      {(["financial", "invest"] as const).map((brand) => (
        <div className="sb-panel sb-narrow-md" data-brand={brand} key={brand}>
          <div className="sb-stack">
            <p className="sb-caption">data-brand="{brand}"</p>
            <TextField label="Account name" defaultValue="Everyday" />
            <TextField label="Mobile" defaultValue="0412" errorMessage="Enter a 10-digit mobile number" />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Constrained width: label, helper and error text wrap; a long value scrolls inside the input and never widens the field. */
export const LongContent: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow">
      <TextField label="Contribution amount for this financial year" optional helperText="Enter the amount before tax" errorMessage="The amount must be less than your contributions cap" defaultValue="A long value that is wider than the field" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const field = canvasElement.querySelector(".ch-text-field") as HTMLElement;
    const input = field.querySelector("input") as HTMLInputElement;
    const label = field.querySelector(".ch-text-field__label-text") as HTMLElement;
    await expect(label.getBoundingClientRect().height).toBeGreaterThan(parseFloat(getComputedStyle(label).lineHeight));
    await expect(input.scrollWidth).toBeGreaterThan(input.clientWidth);
    await expect(field.scrollWidth).toBeLessThanOrEqual(field.clientWidth);
    await expect(input.getBoundingClientRect().width).toBeLessThanOrEqual(field.getBoundingClientRect().width);
  },
};

/** Keyboard: Tab moves through the fields in order and skips the disabled one; the focus ring shows on the input. */
export const Keyboard: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack sb-narrow-md">
      <TextField label="First name" />
      <TextField label="Middle name" disabled />
      <TextField label="Last name" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.tab();
    await expect(c.getByRole("textbox", { name: "First name" })).toHaveFocus();
    await expect(c.getByRole("textbox", { name: "First name" }).matches(":focus-visible")).toBe(true);
    await userEvent.tab();
    await expect(c.getByRole("textbox", { name: "Last name" })).toHaveFocus();
  },
};
