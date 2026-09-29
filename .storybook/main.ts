// AUTHORED. Storybook 10.6.0 (React + Vite) for the Chavosh Financial Design System.
// Stories live next to their components (packages/react/src/**); design-system pages live in .storybook/pages.
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["./pages/*.mdx", "../packages/react/src/**/*.mdx", "../packages/react/src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "storybook-addon-pseudo-states"],
  framework: { name: "@storybook/react-vite", options: {} },
  // react-docgen (Babel-based) reads the Button prop types; no TypeScript compiler API needed.
  typescript: { reactDocgen: "react-docgen" },
  core: { disableTelemetry: true },
};

export default config;
