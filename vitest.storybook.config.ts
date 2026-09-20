import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

/**
 * テーマごとに 1 つの project を作る。`initialGlobals` で toolbar の global を固定すると、
 * 同じ story が両方のテーマで走る (addon-vitest の公式パターン)。light だけで回すと、
 * `parameters.a11y.test: "error"` が dark の contrast を検査していないのに検査しているように
 * 見える。`theme` は `@storybook/addon-themes` の global 名である。
 */
export function storybookProject(theme: "light" | "dark") {
  return defineProject({
    // vite.config.ts と同じく .env を読まない (ADR-0002)
    envDir: false,
    plugins: [
      viteReact(),
      tailwindcss(),
      storybookTest({ configDir: ".storybook", initialGlobals: { theme } }),
    ],
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
      // 含める。axe-core は addon-a11y の a11y 検査が story 実行中にブラウザ側で参照する。
      // class-variance-authority / cn は tokens.stories.tsx が
      // src/components/parts/page-title.tsx (pageTitle) を経由して依存する。事前バンドル漏れで
      // 実際に "Vite unexpectedly reloaded a test" が発生し 3 story 全滅を実測した
      // (2026-09-20、tokens.stories.tsx へ pageTitle の import を足したコミットで発生)
      include: [
        "@tanstack/react-query",
        "@tanstack/react-form",
        "axe-core",
        "class-variance-authority",
        "cn",
      ],
      // @tanstack/react-start 系は exclude しない: @storybook/tanstack-react の framework
      // preset (viteFinal) が moduleInterceptionPlugin で @tanstack/react-start /
      // react-start/server / react-start-server / start-server-core への import を
      // resolveId でモック (export-mocks/start.js) へ差し替え、同じ 4 モジュールを自らの
      // optimizeDeps.exclude にも登録している。storybookTest() はこの viteFinal を経由して
      // 読み込むため (addon-vitest の vitest-plugin が presets.apply("viteFinal", ...) を
      // 呼ぶ)、この project では実パッケージへ到達せず二重に書く必要がない
    },
    test: {
      name: `storybook-${theme}`,
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: "chromium" }],
      },
    },
  });
}
