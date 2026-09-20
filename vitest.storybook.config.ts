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
      // "Vite unexpectedly reloaded a test" や React 二重解決
      // ("Cannot read properties of null (reading 'useContext')") が出る。
      //
      // ここに書くのは、静的な走査で見つからない依存だけにする。story から辿れる依存は
      // Storybook 10.6 が story と preview annotation を optimizeDeps.entries へ積むので
      // (storybookjs/storybook#33875)、手で並べる必要がない。逆に、到達しない名前を書くと
      // Vite は解決できてしまうため警告を出さないまま configHash の入力になり、
      // 無関係な変更で deps キャッシュ全体が無効になる。
      //
      // axe-core は addon-a11y の preview が import("axe-core") で読む
      // (dist/_browser-chunks/chunk-P5J2FJ2Z.js)。動的 import なので走査に出ない
      include: ["axe-core"],
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
