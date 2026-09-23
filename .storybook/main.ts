import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  // story は部品と同じディレクトリに置く (docs/guides/storybook.md「story を置く」)。
  // src/components/ の外は対象にしない
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  // a11y-incomplete は addon-a11y より前に置く。afterEach は annotation の並びの逆順に走るので、
  // 前に置いたものほど後に走る (.storybook/a11y-incomplete/preset.ts)
  addons: [
    "./a11y-incomplete/preset.ts",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  // tanstackStart() plugin と標準の Vite builder が衝突するので TanStack 専用の framework を
  // 使う。router を memory-backed で包み、server function を stub する。衝突 (storybookjs/storybook
  // の issue 33747) が未解決なので、静的ビルドは検証していない
  // (docs/guides/storybook.md「framework を TanStack 専用にし、telemetry を切る理由」)
  framework: "@storybook/tanstack-react",
  // telemetry は既定で有効で、実行したコマンド・バージョン・addon 一覧・story と
  // コンポーネントの件数などを送る (storybook.js.org/docs/configure/telemetry)。
  // テンプレートから作られる全プロジェクトへ配られる設定なので、暗黙の挙動を明示で潰す側に
  // 揃える。設定を読む前に出る boot イベントだけはこの設定の対象外である
  core: { disableTelemetry: true },
};

export default config;
