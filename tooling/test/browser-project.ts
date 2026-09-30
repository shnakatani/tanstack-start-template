import { defineProject, mergeConfig } from "vite-plus/test/config";

import { BROWSER_TEST_GLOB } from "../../scripts/lib/companion-files";
import { ASSERT_TIMEOUT_MS } from "../../src/test/browser/assert-budget";
import { DEFAULT_VIEWPORT } from "../../src/test/browser/viewport-sizes";
import { chromiumProjectBase } from "./chromium-project";

/**
 * ブラウザテストの project。inline の project として root の `vite.config.ts` を継承し、ブラウザで
 * 走る project に共通する設定は `chromiumProjectBase` から重ねるので、ここにはブラウザテストに固有の
 * ものだけを書き、playwright の provider は関数の中で読み込む (`docs/guides/testing/configuration.md`「project を足す」)
 */
export async function browserProject() {
  const { playwright } = await import("vite-plus/test/browser-playwright");
  return mergeConfig(
    chromiumProjectBase(),
    defineProject({
      optimizeDeps: {
        // テストの実行中に初めて到達した依存は、再バンドルと reload をまたいだ React の二重解決で落ちる。
        // 出口条件 (TanStack/router#6246、vitest-dev/vitest#10775。後者の close は出口ではない) は
        // docs/guides/testing/configuration.md「project に `optimizeDeps` を書く理由」、足し方と判定の手順は
        // 同「ブラウザと story の project に事前バンドルする依存を足す」
        include: [
          "@tanstack/react-query",
          "@tanstack/react-form",
          "@tanstack/react-pacer",
          "axe-core",
          "@base-ui/react/popover",
          "react-day-picker",
        ],
        // Start plugin 不在の test 環境では #tanstack-*-entry 仮想 import が解決不能
        exclude: [
          "@tanstack/react-start",
          "@tanstack/react-start-server",
          "@tanstack/start-server-core",
        ],
      },
      test: {
        name: "browser",
        // assert の予算。値は `src/test/browser/assert-budget.ts` が持ち、`actionTimeout` と対で効く
        // (docs/guides/testing/waiting-and-assertions.md「assert の予算を宣言する」)
        expect: { poll: { timeout: ASSERT_TIMEOUT_MS } },
        // a11y の検査は project ではなく tag で分ける (docs/guides/accessibility.md「a11y の検査を tag で分ける理由」)。
        // 付け方 (挙動テストの途中の assert には付けない) は同「a11y の tag を付ける」。
        // `strictTags` は既定で有効なので、ここに無い tag を書いたテストはエラーで落ちる
        tags: [
          {
            name: "a11y",
            description:
              "この project で axe に「アクセシブルか」を問うテスト。story 側の a11y は addon が別に当てるので含まない",
          },
          {
            name: "axe",
            description: "描画した DOM を axe で検査し、アクセシビリティの違反を見つけるテスト",
          },
        ],
        setupFiles: ["src/test/browser/browser-setup.tsx"],
        include: [BROWSER_TEST_GLOB],
        browser: {
          // 操作の上限を置き (vitest-dev/vitest#6983)、`expect.poll.timeout` を `expect.element` へ届かせる
          // (vitest-dev/vitest#8308、vitest-dev/vitest#7871。docs/guides/testing/waiting-and-assertions.md「assert の予算を分ける理由」)
          provider: playwright({ actionTimeout: ASSERT_TIMEOUT_MS }),
          viewport: DEFAULT_VIEWPORT,
        },
      },
    }),
  );
}
