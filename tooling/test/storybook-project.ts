import { defineProject, mergeConfig } from "vite-plus/test/config";

import { chromiumProjectBase } from "./chromium-project";

export const STORYBOOK_THEMES = ["light", "dark"] as const;

/**
 * テーマごとに 1 つの project を作る (ADR-0028)。`theme` は `@storybook/addon-themes` の global 名
 */
export async function storybookProject(theme: (typeof STORYBOOK_THEMES)[number]) {
  // root の `vite.config.ts` を継承し、共通の設定は chromiumProjectBase から重ねるので、story の実行に
  // 固有のものだけを書き、重い依存は関数の中で読み込む (`docs/guides/testing/configuration.md`「project を足す」)
  const [{ storybookTest }, { playwright }] = await Promise.all([
    import("@storybook/addon-vitest/vitest-plugin"),
    import("vite-plus/test/browser-playwright"),
  ]);
  return mergeConfig(
    await chromiumProjectBase(),
    defineProject({
      plugins: [
        storybookTest({ configDir: ".storybook", initialGlobals: { theme } }),
        // 事前バンドルのキャッシュをテーマごとに分ける。相対ではなく固定値で組み立てる
        // (docs/guides/testing/configuration.md「story の project の `cacheDir` をテーマで分ける理由」)
        {
          name: "storybook-theme-cache-dir",
          config: {
            order: "post" as const,
            handler: () => ({ cacheDir: `node_modules/.cache/storybook-vitest/${theme}` }),
          },
        },
      ],
      optimizeDeps: {
        // 静的な走査で見つからない依存だけを書く (story と preview annotation は Storybook が entries に積む。
        // storybookjs/storybook#33875)。axe-core は addon-a11y が動的 import で読む
        // (docs/guides/testing/configuration.md「project に `optimizeDeps` を書く理由」)
        include: ["axe-core"],
        // @tanstack/react-start 系は exclude しない。@storybook/tanstack-react の preset がモックへ差し替え、除外もする
        // (docs/guides/testing/configuration.md「project に `optimizeDeps` を書く理由」)
      },
      test: {
        name: `storybook-${theme}`,
        browser: {
          provider: playwright(),
          // viewport はここで指定できない (docs/guides/storybook.md「vitest 経由の story の viewport が決まる仕組み」)
        },
      },
    }),
  );
}
