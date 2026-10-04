import { defineProject, mergeConfig } from "vite-plus/test/config";

import { chromiumProjectBase } from "./chromium-project";

/** `@storybook/addon-themes` の global 名 (ADR-0028) */
type StorybookTheme = "light" | "dark";

/**
 * テーマごとに 1 つの project を作る (ADR-0028)。
 * `compiler` が偽の project は React Compiler を通さず、`src/components/ui/` の story だけを走らせる
 * (`docs/guides/testing/configuration.md`「テストでも React Compiler を通す理由」)
 */
export async function storybookProject({
  theme,
  compiler,
}: {
  theme: StorybookTheme;
  compiler: boolean;
}) {
  const variant = compiler ? theme : `${theme}-no-compiler`;
  // root の `vite.config.ts` を継承し、共通の設定は chromiumProjectBase から重ねるので、story の実行に
  // 固有のものだけを書き、重い依存は関数の中で読み込む (`docs/guides/testing/configuration.md`「project を足す」)
  const [{ storybookTest }, { playwright }] = await Promise.all([
    import("@storybook/addon-vitest/vitest-plugin"),
    import("vite-plus/test/browser-playwright"),
  ]);
  return mergeConfig(
    chromiumProjectBase({ compiler }),
    defineProject({
      plugins: [
        storybookTest({ configDir: ".storybook", initialGlobals: { theme } }),
        // 事前バンドルのキャッシュを project ごとに分ける。相対ではなく固定値で組み立てる
        // (docs/guides/testing/configuration.md「story の project の `cacheDir` をテーマで分ける理由」)
        {
          name: "storybook-theme-cache-dir",
          config: {
            order: "post" as const,
            handler: () => ({ cacheDir: `node_modules/.cache/storybook-vitest/${variant}` }),
          },
        },
      ],
      optimizeDeps: {
        // 静的な走査で見つからない依存だけを書く (story と preview annotation は Storybook が entries に積む。
        // storybookjs/storybook#33875)。axe-core は addon-a11y が動的 import で読む
        // (docs/guides/testing/configuration.md「project に `optimizeDeps` を書く理由」)
        include: ["axe-core"],
        // ブラウザテストの project (browser-project.ts) と違い、@tanstack/react-start 系を exclude に書かない。
        // @storybook/tanstack-react の preset が、それらの import をモックへ差し替え、自分で exclude にも足す
        // (docs/guides/testing/configuration.md「project に `optimizeDeps` を書く理由」)
      },
      test: {
        name: `storybook-${variant}`,
        // addon は `include` を無視して `.storybook/main.ts` の stories から集めるので、`exclude` で絞る
        exclude: compiler ? [] : ["src/components/*.stories.*", "src/components/!(ui)/**"],
        browser: {
          provider: playwright(),
          // viewport はここで指定できない (docs/guides/storybook.md「vitest 経由の story の viewport が決まる仕組み」)
        },
      },
    }),
  );
}
