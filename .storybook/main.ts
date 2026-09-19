import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  // story は部品と同じディレクトリに置く (ADR-0022)。src/components/ の外は対象にしない
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-vitest"],
  framework: "@storybook/tanstack-react",
};

export default config;
