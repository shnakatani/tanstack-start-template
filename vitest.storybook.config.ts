import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

import { isStorybookRun } from "./scripts/lib/storybook-env";

const THEMES = ["light", "dark"] as const;

/**
 * テーマごとに 1 つの project を作る。`initialGlobals` で toolbar の global を固定すると、
 * 同じ story が両方のテーマで走る (addon-vitest の公式パターン)。light だけで回すと、
 * `parameters.a11y.test: "error"` が dark の contrast を検査していないのに検査しているように
 * 見える。`theme` は `@storybook/addon-themes` の global 名である。
 */
function storybookProject(theme: (typeof THEMES)[number]) {
  return defineProject({
    // vite.config.ts と同じく .env を読まない (ADR-0005)
    envDir: false,
    plugins: [
      viteReact(),
      tailwindcss(),
      storybookTest({ configDir: ".storybook", initialGlobals: { theme } }),
      // deps キャッシュを project ごとに分ける。storybookTest() は configDir のハッシュから
      // cacheDir を導く (addon-vitest の vitest-plugin が oneWayHash(configDir) を projectId に
      // する) ため、テーマ違いの 2 project が同じ configDir を渡す限り 1 つのキャッシュを
      // 共有し、実行中に別々の依存を見つけて互いに無効化し合う。config フックの post 順は
      // storybookTest() の返り値より後に merge されるので、ここで上書きできる。
      // 相対ではなく固定値で組み立てる。browser mode は config を再ロードするため、
      // 既存の cacheDir から相対で作ると light/light のように入れ子になる
      {
        name: "storybook-theme-cache-dir",
        config: {
          order: "post" as const,
          handler: () => ({ cacheDir: `node_modules/.cache/storybook-vitest/${theme}` }),
        },
      },
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
      // 書くのは静的な走査で見つからない依存だけでよい。story から辿れる依存は
      // Storybook 10.6 が story と preview annotation を optimizeDeps.entries へ積む
      // (storybookjs/storybook#33875)。cacheDir を project ごとに分けたので、走査の結果が
      // 2 つの project で違っても互いのキャッシュを壊さない。
      //
      // axe-core は addon-a11y の preview が import("axe-core") で読む
      // (dist/_browser-chunks/chunk-P5J2FJ2Z.js)。動的 import なので静的な走査に出ない
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
        // viewport はここで指定できない。@storybook/addon-vitest の setViewport が story ごとに
        // page.viewport() を呼び、parameters.viewport を持たない story は同 addon の既定
        // (1200x900) へ固定する。browser project (1280x720) とは別の baseline になる
        instances: [{ browser: "chromium" }],
      },
    },
  });
}

/**
 * テーマごとの project を並べる。Storybook 経由の実行だけ light の 1 つに絞る。
 *
 * `@storybook/addon-vitest@10.6.0` は `VITEST_STORYBOOK=true` のとき project 名を
 * `storybook:${configDir}` へ強制上書きする (`dist/vitest-plugin/index.js` の
 * `storybook:workspace-name-override`)。同じ `configDir` から 2 つ作ると名前が衝突し、
 * Storybook の test panel も `storybook tools test run` も起動しない
 * (storybookjs/storybook#32427、2025-09-07 から open)。
 *
 * 上書きは `order: "pre"` の config フックで入り、こちらの post 順の上書きでは戻せない
 * (2026-09-21 実測。同じ手は `cacheDir` には効く)。configDir を分ければ名前も分かれるが、
 * 上流のバグのために設定ディレクトリを 2 つ持つことになる。
 *
 * 絞るのは Storybook 経由の経路だけで、`vp test run` と `mise run verify` は両テーマを回す。
 * 判定の正本は後者で、test panel は書いている最中の確認に使う。
 */
export function storybookProjects() {
  if (!isStorybookRun(process.env.VITEST_STORYBOOK))
    return THEMES.map((theme) => storybookProject(theme));

  // 縮退を黙って通さない。VITEST_STORYBOOK がシェルへ残ったまま `vp test run` を叩くと、
  // dark の a11y 検査が消えたことに誰も気付けない
  console.warn("[storybook] VITEST_STORYBOOK が真なので light だけを回す (ADR-0057)");
  return [storybookProject("light")];
}
