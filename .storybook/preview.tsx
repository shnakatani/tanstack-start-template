import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/tanstack-react";

import "../src/styles.css";

const preview: Preview = {
  decorators: [
    // styles.css の @custom-variant dark (&:is(.dark *)) に合わせて html へ class を当てる
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
  parameters: {
    // 違反を警告で留めない。expectNoA11yViolations が持つ「違反ゼロ」と基準を揃える (ADR-0022)
    a11y: { test: "error" },
  },
};

export default preview;
