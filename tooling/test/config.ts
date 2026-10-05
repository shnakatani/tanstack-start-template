import type { TestProjectConfiguration, TestUserConfig } from "vite-plus/test/config";

import { companionGlobs } from "../../scripts/lib/companion-files";
import { isStorybookRun } from "../../scripts/lib/storybook-env";
import { browserProject } from "./browser-project";
import { storybookProject } from "./storybook-project";

type StorybookVariant = Parameters<typeof storybookProject>[0];

/**
 * story の project。テーマは両方を Compiler を通して回し (ADR-0028)、Compiler を通さない project は
 * light だけにする (docs/guides/testing/configuration.md「テストでも React Compiler を通す理由」)
 */
const STORYBOOK_VARIANTS: readonly StorybookVariant[] = [
  { theme: "light", compiler: true },
  { theme: "dark", compiler: true },
  { theme: "light", compiler: false },
];

/**
 * story の project を並べる。Storybook 経由の実行だけ light の Compiler を通す 1 つに絞り、
 * `vp test run` と `mise run verify` は全部を回す (ADR-0028、storybookjs/storybook#32427)
 */
function storybookProjects(): TestProjectConfiguration[] {
  const storybookRun = isStorybookRun(process.env.VITEST_STORYBOOK);
  const variants = storybookRun
    ? STORYBOOK_VARIANTS.filter((variant) => variant.theme === "light" && variant.compiler)
    : STORYBOOK_VARIANTS;
  return variants.map((variant) => () => {
    // VITEST_STORYBOOK がシェルに残ったまま `vp test run` を叩くと dark と Compiler なしの story が黙って消えるので知らせる。
    // 関数の中で出す (docs/guides/vite-configuration.md「読み込むだけで起きる副作用を持たせない理由」)。
    // Vitest は --project で絞る前に関数の project を全部呼ぶので、story を回さない実行でも出る
    if (storybookRun)
      console.warn(
        "[storybook] VITEST_STORYBOOK が真なので light の Compiler を通す project だけを回す (ADR-0028、docs/guides/testing/configuration.md「React Compiler を通さない project を足す」)",
      );
    return storybookProject(variant);
  });
}

/**
 * `vite.config.ts` の `test` (ADR-0037)。project は inline に並べ、重い依存を使う project は関数で渡す
 * (`docs/guides/testing/configuration.md`「project を足す」、`docs/guides/vite-configuration.md`「重い依存を遅らせる理由」)
 */
export const testConfig = {
  // テスト全体のタイムゾーンを決める (docs/guides/testing/time-zones.md「基準を root の globalSetup に置く理由」)
  globalSetup: ["./tooling/test/global-setup.ts"],
  // `vi.stubEnv` と `vi.stubGlobal` の値を戻す。設定は次のテストの前に戻し、setup の `afterEach` は
  // `--no-isolate` でファイルの最後の値が次のファイルへ残るのを塞ぐ (docs/guides/testing/mocking.md「環境変数とグローバルを差し替える」)
  unstubEnvs: true,
  unstubGlobals: true,
  setupFiles: ["./tooling/test/setup.ts"],
  // project はどれもこれを継承し、自分の exclude を後ろに連結する (Vitest 5 の extends は配列を連結する)
  exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/worktrees/**", "**/.claude/skills/**"],
  projects: [
    {
      test: {
        name: "unit",
        include: ["src/**/*.test.ts"],
      },
    },
    {
      test: {
        name: "scripts-tools",
        // 検査 (scripts/checks/) だけを除く拒否リストで拾う。検査の置き場所と project の対は
        // docs/guides/testing/check-scripts.md「検査スクリプトを分けて置く理由」
        include: ["scripts/**/*.test.ts"],
        exclude: ["scripts/checks/**"],
        // bash / git の subprocess を起動するので、全体 run の並列負荷で既定 5s を超えることがある
        testTimeout: 20_000,
      },
    },
    {
      test: {
        name: "checks-integrity",
        include: ["scripts/checks/integrity/**/*.test.ts"],
        testTimeout: 20_000,
      },
    },
    () => browserProject({ compiler: true }),
    // NO_COMPILER_DIR は Compiler を通さずにも走らせる (docs/guides/testing/configuration.md「テストでも React Compiler を通す理由」)
    () => browserProject({ compiler: false }),
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
