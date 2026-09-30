// AUTHORED. Storybook stories for Link v1 — the real production component (./Link), never a recreation.
// Contract: docs/decisions/0013-link-v1-implementation-mapping.md. Stories add no props beyond the Link API and no
// design values: layout comes from .storybook/storybook.css (neutral structure only), colours and sizes from tokens.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Link, type LinkSize } from "./Link";

const SIZES: { value: LinkSize; label: string; note: string }[] = [
  { value: "md", label: "md (default)", note: "label/md — standalone links in content and forms." },
  { value: "sm", label: "sm", note: "label/sm — compact contexts. Same 44px minimum target." },
];

const meta = {
  title: "Components/Link",
  component: Link,
  args: { children: "View transactions", href: "#transactions", size: "md", onClick: fn() },
  argTypes: {
    href: { control: "text", description: "Destination (required). A Link without a destination is not a link — render plain text instead.", table: { type: { summary: "string" } } },
    size: {
      control: "inline-radio",
      options: ["md", "sm"],
      description: "Label size (`label/md` or `label/sm`). Both keep the 44px minimum target.",
      table: { type: { summary: '"md" | "sm"' }, defaultValue: { summary: '"md"' } },
    },
    children: { control: "text", description: "Visible label — also the accessible name. It must make sense out of context.", table: { type: { summary: "ReactNode" } } },
    onClick: { control: false, table: { category: "Events" } },
  },
  parameters: { controls: { include: ["href", "size", "children"] } },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Explore the real Link API. Hover and Tab to see the browser states. */
export const Playground: Story = {
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "View transactions" });
    await expect(link).toHaveAttribute("href", "#transactions");
    await userEvent.click(link);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Sizes: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack">
      {SIZES.map((s) => (
        <div className="sb-cell" key={s.value}>
          <Link href="#transactions" size={s.value}>View transactions</Link>
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
  { label: "Focus-visible", demo: "focus" },
] as const;

/**
 * Static demonstration of the browser states. Hover and Focus-visible are simulated with the Storybook pseudo-states
 * addon (it applies the real :hover / :focus-visible CSS rules to the marked examples) — Link has no state props.
 * There is no Visited, Pressed, Disabled or Current state in v1. Interact with the Playground for real behaviour.
 */
export const States: Story = {
  parameters: {
    controls: { disable: true },
    pseudo: { hover: ['[data-demo-state="hover"]'], focusVisible: ['[data-demo-state="focus"]'] },
  },
  render: () => (
    <div className="sb-stack">
      {SIZES.map((s) => (
        <div className="sb-grid" key={s.value}>
          {STATES.map((st) => (
            <div className="sb-cell" key={st.label}>
              <Link href="#transactions" size={s.value} data-demo-state={st.demo}>View transactions</Link>
              <p className="sb-caption">
                {st.label} · {s.value}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** The same Links in both brand contexts, side by side, through the production data-brand attribute. The toolbar Brand switch does not apply here — both brands are shown. */
export const BrandComparison: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-row">
      {(["financial", "invest"] as const).map((brand) => (
        <div className="sb-panel" data-brand={brand} key={brand}>
          <div className="sb-stack">
            <p className="sb-caption">data-brand="{brand}"</p>
            <Link href="#transactions">View transactions</Link>
            <Link href="#options" size="sm">Investment options</Link>
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Financial examples: meaningful link text, file type and size for downloads, and the new-tab warning in the accessible name. */
export const Examples: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-stack">
      <Link href="#transactions">View transactions</Link>
      <Link href="#fees">Learn more about fees</Link>
      <Link href="#overview">Back to account overview</Link>
      <Link href="#statement" download type="application/pdf">Download statement (PDF, 240 KB)</Link>
      <Link href="#privacy" target="_blank" rel="noopener noreferrer">Privacy policy (opens in a new tab)</Link>
    </div>
  ),
};

/** Constrained width: the label wraps, stays underlined, the link grows beyond its 44px minimum and nothing is clipped. */
export const LongLabel: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="sb-narrow">
      <Link href="#fees">Learn more about fees for international transfers and currency conversion</Link>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole("link");
    const style = getComputedStyle(link);
    await expect(style.textDecorationLine).toBe("underline");
    await expect(link.getBoundingClientRect().height).toBeGreaterThan(parseFloat(style.minHeight));
    await expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth);
    await expect(link.scrollHeight).toBeLessThanOrEqual(link.clientHeight);
  },
};

/** Keyboard: Tab focuses the link and shows the focus ring; Enter activates it; Space does not (native link behaviour). */
export const Keyboard: Story = {
  parameters: { controls: { disable: true } },
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole("link", { name: "View transactions" });
    await userEvent.tab();
    await expect(link).toHaveFocus();
    await expect(link.matches(":focus-visible")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(" ");
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};
