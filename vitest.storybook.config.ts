import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

export default defineProject({
  // vite.config.ts と同じく .env を読まない (ADR-0002)
  envDir: false,
  plugins: [viteReact(), tailwindcss(), storybookTest({ configDir: ".storybook" })],
  resolve: {
    tsconfigPaths: true,
    // registry combobox の @base-ui/react barrel import が React を二重解決するのを防ぐ
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // standalone の defineProject で vitest.config.ts / vitest.browser.config.ts の
    // 設定を継承しないため、story が触れる依存はここに個別に持つ必要がある。
    // src/components/parts/form-fields.tsx は src/hooks/form-context.ts 経由で
    // @tanstack/react-form に依存し、後続 Task で story が付く見込み。事前バンドル漏れは
    // vitest.browser.config.ts が 2026-08-17 に観測した React 二重解決
    // ("Cannot read properties of null (reading 'useContext')") を再現しうるため先取りで
    // 含める。axe-core は addon-a11y の a11y 検査が story 実行中にブラウザ側で参照する
    include: ["@tanstack/react-query", "@tanstack/react-form", "axe-core"],
    // @tanstack/react-start 系は exclude しない: @storybook/tanstack-react の framework
    // preset (viteFinal) が moduleInterceptionPlugin で @tanstack/react-start /
    // react-start/server / react-start-server / start-server-core への import を
    // resolveId でモック (export-mocks/start.js) へ差し替え、同じ 4 モジュールを自らの
    // optimizeDeps.exclude にも登録している。storybookTest() はこの viteFinal を経由して
    // 読み込むため (addon-vitest の vitest-plugin が presets.apply("viteFinal", ...) を
    // 呼ぶ)、この project では実パッケージへ到達せず二重に書く必要がない
  },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
