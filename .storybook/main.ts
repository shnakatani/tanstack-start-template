import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  // story は部品と同じディレクトリに置く。src/components/ の外は対象にしない
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  // a11y-incomplete は addon-a11y より前に置く。afterEach は annotation の並びの逆順に走るので、
  // 前に置いたものほど後に走る (.storybook/a11y-incomplete/preset.ts)
  addons: [
    "./a11y-incomplete/preset.ts",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: "@storybook/tanstack-react",
  // telemetry は既定で有効で、実行したコマンド・バージョン・addon 一覧・story と
  // コンポーネントの件数などを送る (storybook.js.org/docs/configure/telemetry)。
  // このリポジトリは暗黙の挙動を明示で潰す方針なので切る。設定を読む前に出る boot
  // イベントだけはこの設定の対象外である
  // telemetry を切る (ADR-0052)
  core: { disableTelemetry: true },
};

export default config;
