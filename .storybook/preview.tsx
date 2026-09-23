import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/tanstack-react";

import { NARROW_VIEWPORT } from "@/test/viewport-sizes";

import "./preview.css";

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
    // 違反を警告で留めない。addon はここで violations を見る (ADR-0057)
    a11y: { test: "error" },
    // 狭幅の見え方は story で見る (ADR-0036「寸法は機械で見ない」)。値は browser test と
    // 同じ src/test/viewport-sizes から引き、写さない。addon-vitest は story ごとに
    // この options を page.viewport() へ渡す (vitest.storybook.config.ts)
    viewport: {
      options: {
        narrow: {
          name: "Narrow (375px)",
          styles: { width: `${NARROW_VIEWPORT.width}px`, height: `${NARROW_VIEWPORT.height}px` },
        },
      },
    },
  },
};

export default preview;
