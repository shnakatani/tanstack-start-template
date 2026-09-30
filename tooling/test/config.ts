import type { TestProjectConfiguration, TestUserConfig } from "vite-plus/test/config";

import { companionGlobs } from "../../scripts/lib/companion-files";
import { isStorybookRun } from "../../scripts/lib/storybook-env";
import { browserProject } from "./browser-project";
import { STORYBOOK_THEMES, storybookProject } from "./storybook-project";

const sharedExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.claude/worktrees/**",
  "**/.claude/skills/**",
];

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
function storybookProjects(): TestProjectConfiguration[] {
  const storybookRun = isStorybookRun(process.env.VITEST_STORYBOOK);
  const themes = storybookRun ? (["light"] as const) : STORYBOOK_THEMES;
  return themes.map((theme) => () => {
    // 縮退を黙って通さない。VITEST_STORYBOOK がシェルへ残ったまま `vp test run` を叩くと、
    // dark の a11y 検査が消えたことに誰も気付けない。関数の中で出すのは、project を解決する
    // テストの実行でだけ出すため (config を読むだけの lint / fmt / build では出さない)
    if (storybookRun)
      console.warn("[storybook] VITEST_STORYBOOK が真なので light だけを回す (ADR-0028)");
    return storybookProject(theme);
  });
}

/**
 * `vite.config.ts` の `test` (ADR-0037)。project はどれも inline に並べ、root の `vite.config.ts` の
 * 設定 (`envDir`、`resolve`、テスト時の `plugins`) を継承させる
 * (`docs/guides/testing/configuration.md`「project を inline に並べる理由」)。
 *
 * browser と storybook の project は関数で渡し、playwright の provider と
 * `@storybook/addon-vitest` の plugin を関数の中で `import()` する。`vite.config.ts` は
 * `vp lint` / `vp fmt` / `vp build` や `lint-config.test.ts` も読むので、先頭で import すると
 * その経路でも評価される (`docs/guides/vite-configuration.md`「重い依存を遅らせる理由」)
 */
export const testConfig = {
  // テスト全体のタイムゾーンを決める。root に置く。project に置くと、その project のテストを含む
  // 実行でだけ走り、他の project の TZ が選んだファイルで変わる
  globalSetup: ["./vitest.global-setup.ts"],
  projects: [
    {
      test: {
        name: "unit",
        include: ["src/**/*.test.ts"],
        exclude: sharedExclude,
      },
    },
    {
      test: {
        name: "scripts-tools",
        // 許可リストにすると、ツールを足すたびにここへ 1 行足すまでテストが無言で
        // 収集されない。検査だけを除いて残りを拾う形にする。検査は壊れる原因が違うので
        // 別 project が持つ (拒否リストの形は docs/guides/styling-and-tokens.md「比の測り方を置いた理由」)
        //
        // 除外した `scripts/checks/` の中は各検査の project が拾う。いま拾っているのは
        // `checks-integrity` の `integrity/` だけなので、そこへ検査を足すときは project も
        // 対で作る。除外がディレクトリ名に依っているぶん、検査を `scripts/checks/` の外へ
        // 置くと、走らないのではなく scripts-tools へ無言で合流する
        include: ["scripts/**/*.test.ts"],
        exclude: [...sharedExclude, "scripts/checks/**"],
        // scripts のテストは bash / git の subprocess 起動を伴い、全体 run の
        // 並列負荷では既定 5s を超えることがある
        testTimeout: 20_000,
      },
    },
    {
      test: {
        name: "checks-integrity",
        include: ["scripts/checks/integrity/**/*.test.ts"],
        exclude: sharedExclude,
        testTimeout: 20_000,
      },
    },
    browserProject,
    // テーマごとの project。経路によって数が変わる (storybookProjects の docstring)
    ...storybookProjects(),
  ],
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "json-summary"],
    include: ["src/**"],
    exclude: [
      "src/routeTree.gen.ts",
      // 付随ファイルは出荷されないので分母に入れない
      ...companionGlobs("src/**/"),
      // vi.mock の差し替え先。テストだけが読み、出荷されない
      "src/**/__mocks__/**",
      "src/test/**",
      "src/**/*.d.ts",
    ],
  },
} satisfies TestUserConfig;
