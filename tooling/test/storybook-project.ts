import { posix } from "node:path";

import { defineProject, mergeConfig } from "vite-plus/test/config";

import { chromiumProjectBase, NO_COMPILER_DIR } from "./chromium-project";

/** `.storybook/main.ts` の stories が集める起点 */
const STORIES_ROOT = "src/components";

/** `@storybook/addon-themes` の global 名 (ADR-0028) */
type StorybookTheme = "light" | "dark";

/**
 * テーマごとに 1 つの project を作る (ADR-0028)。
 * `compiler` が偽の project は React Compiler を通さず、`NO_COMPILER_DIR` の story だけを走らせる
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
  // 除外は stories の起点の直下で組むので、範囲が起点の直下でなくなったら黙って広がらないように止める
  if (!compiler && posix.dirname(NO_COMPILER_DIR) !== STORIES_ROOT) {
    throw new Error(
      `NO_COMPILER_DIR (${NO_COMPILER_DIR}) が .storybook/main.ts の stories の起点 (${STORIES_ROOT}) の直下に無い。除外の組み方を変える`,
    );
  }
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
        // (docs/guides/testing/configuration.md「story の project の `cacheDir` を分ける理由」)
        {
          name: "storybook-cache-dir",
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
        // addon は `include` を無視して `.storybook/main.ts` の stories (`src/components` の下) から集めるので、
        // stories の起点の直下の story と、起点の下の `NO_COMPILER_DIR` 以外を除く
        exclude: compiler
          ? []
          : [
              `${STORIES_ROOT}/*.stories.*`,
              `${STORIES_ROOT}/!(${posix.basename(NO_COMPILER_DIR)})/**`,
            ],
        browser: {
          provider: playwright(),
          // viewport はここで指定できない (docs/guides/storybook.md「vitest 経由の story の viewport が決まる仕組み」)
        },
      },
    }),
  );
}
