import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/tanstack-react";
import { StrictMode } from "react";

import { NARROW_VIEWPORT } from "@/test/browser/viewport-sizes";

import "./preview.css";

const preview: Preview = {
  decorators: [
    // styles.css の @custom-variant dark (&:is(.dark *)) に合わせて html へ class を当てる
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
    // story をアプリの root と同じく StrictMode で包む。配列の後ろほど外側に重なるので最後に置く。
    // main.ts の framework の strictMode は vitest 経由の story に届かないので使わない (ADR-0039)
    (Story) => (
      <StrictMode>
        <Story />
      </StrictMode>
    ),
  ],
  parameters: {
    // 違反を警告で留めない。addon はここで violations を見る (ADR-0028)
    a11y: { test: "error" },
    // 狭幅の見え方は story で見る (docs/guides/storybook.md「狭幅を story で見る理由」)。
    // 値は browser test と同じ src/test/browser/viewport-sizes から引き、写さない
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
