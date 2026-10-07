import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  // src/components/ の外は対象にしない (docs/guides/storybook.md「story を置く」)
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-vitest"],
  // tanstackStart() と標準の Vite builder が衝突する (storybookjs/storybook#33747)。framework と telemetry の理由は
  // docs/guides/storybook.md「framework を TanStack 専用にし、telemetry を切る理由」
  framework: "@storybook/tanstack-react",
  core: { disableTelemetry: true },
};

export default config;
