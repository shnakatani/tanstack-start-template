import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

import { DEFAULT_VIEWPORT } from "./src/test/viewport-sizes";

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
      // 事前バンドルから漏れた依存を実行中に見つけると Vite が再最適化を挟み、
      // "Vite unexpectedly reloaded a test" と React 二重解決
      // ("Cannot read properties of null") が出る。
      //
      // この一覧は「story が import する依存」ではない。storybook-light と storybook-dark は
      // 同じ configDir を渡すので、@storybook/addon-vitest が configDir のハッシュから
      // cacheDir を導く結果 (vitest-plugin の oneWayHash(configDir))、2 つの project が
      // 1 つの deps キャッシュを共有する。事前宣言が足りないと、両者が実行中に別々の依存を
      // 見つけて互いのキャッシュを無効化し合う。到達しない名前でも減らしてはいけない。
      //
      // story 53 件の段で実測した (2026-09-20)。
      //   この一覧なし + 2 project : 98 件失敗 / reloaded 8
      //   この一覧あり + 2 project : 444 件 pass / reloaded 0
      //   どちらでも 1 project なら   222 件 pass / reloaded 0
      //
      // axe-core だけは理由が別で、addon-a11y の preview が import("axe-core") で読む
      // (dist/_browser-chunks/chunk-P5J2FJ2Z.js)。動的 import なので静的な走査に出ない
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
        // browser project と同じ寸法で走らせる。書かないと Playwright の既定に落ち、
        // 2 つの project が別の baseline を持つ
        viewport: DEFAULT_VIEWPORT,
        instances: [{ browser: "chromium" }],
      },
    },
  });
}
