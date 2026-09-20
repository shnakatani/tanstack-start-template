import type { StorybookConfig } from "@storybook/tanstack-react";

const config: StorybookConfig = {
  // story は部品と同じディレクトリに置く (ADR-0022)。src/components/ の外は対象にしない
  stories: ["../src/components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes", "@storybook/addon-vitest"],
  framework: "@storybook/tanstack-react",
  // telemetry は既定で有効で、実行したコマンド・バージョン・addon 一覧・story と
  // コンポーネントの件数などを送る (storybook.js.org/docs/configure/telemetry)。
  // このリポジトリは暗黙の挙動を明示で潰す方針なので切る。設定を読む前に出る boot
  // イベントだけはこの設定の対象外である
  core: { disableTelemetry: true },
};

export default config;
