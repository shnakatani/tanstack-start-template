import { defineProject, mergeConfig } from "vite-plus/test/config";

import { BROWSER_TEST_GLOB } from "../../scripts/lib/companion-files";
import { ASSERT_TIMEOUT_MS } from "../../src/test/browser/assert-budget";
import { DEFAULT_VIEWPORT } from "../../src/test/browser/viewport-sizes";
import { chromiumProjectBase } from "./chromium-project";

/**
 * ブラウザテストの project。`tooling/test/config.ts` が inline の project として並べるので、
 * root の `vite.config.ts` の設定 (`envDir`、`resolve.tsconfigPaths`、テスト時の `plugins`) を
 * 継承する (Vitest 5 の `extends` の既定)。Vite+ の `defineConfig` が root に足す test 用の plugin
 * (`vite-plus:vitest-resolver` など) も継承する。ブラウザで走る project に共通する設定は
 * `chromiumProjectBase` が持ち、ここにはブラウザテストに固有のものだけを書く。
 *
 * playwright の provider は関数の中で読み込む (`docs/guides/vite-configuration.md`「重い依存を遅らせる理由」)
 */
export async function browserProject() {
  const { playwright } = await import("vite-plus/test/browser-playwright");
  return mergeConfig(
    chromiumProjectBase(),
    defineProject({
      optimizeDeps: {
        // ここに挙げた依存はテスト開始前にまとめて事前バンドルされる。挙げないと、その依存へ
        // 最初に到達したテストの実行中に再バンドルが走り Vite が page を reload することがあり、
        // reload をまたいだ React の二重解決で
        // "Cannot read properties of null (reading 'useContext')" が起きる。
        // 2026-08-17 に notes 画面のテスト追加で 2 回観測した (1 回は 9 case 全滅、1 回は
        // "dependency optimized: date-fns" + Vitest 自身の
        // "please add mentioned dependencies to your config's optimizeDeps.include field" 警告)。
        //
        // 本来の optimizer 事前管理は tanstackStart() plugin の仕事だが、下記の未解決バグのため
        // test 環境では plugin ごと外しており (`vite.config.ts` の plugins。外すこと自体が回避策)、その穴を埋める対症療法として
        // include を置く。出口条件: 次のどちらかが解消したら本項の削除を再評価する。
        // - TanStack/router#6246 (plugin が test 環境にも optimizeDeps を無条件注入し、React が二重に読み込まれうる。hooks が壊れる)
        // - vitest-dev/vitest#10775 (テストファイル読込中の依存最適化で suite を喪失)。
        //   この issue は closed だが上流修正ではなく報告者が自分のテストを直しただけで
        //   (コメント 1 件、closed イベントの commit_id は null)、close を出口条件にしない。
        //   判定は include を外して browser project を回し、上の症状が出ないことで行う
        // テストからしか参照されない依存が増えたらここへ足す
        // (@base-ui/react/popover と react-day-picker は、FormDateField のテストで初めて到達した
        // 実行中に "dependencies optimized" と reload を 2026-09-27 に観測して足した)
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
        // assert の予算。テストの予算 (`testTimeout`) と分ける。値とその根拠は
        // `src/test/browser/assert-budget.ts` が持つ。`actionTimeout` と対で効き、これを消すと
        // vitest の既定 1000ms、`actionTimeout` を消すと残り予算を使い切る側へ戻る (docs/guides/testing/waiting-and-assertions.md「assert の予算を宣言する」)
        expect: { poll: { timeout: ASSERT_TIMEOUT_MS } },
        // a11y の検査は project ではなく tag で分ける。runner の設定が挙動テストと同じで、
        // project を足すとそのぶん描画が増えるため。挙動テストの途中の状態を測る assert には
        // a11y の tag を付けない。専用テストへ降ろすと操作の再現が重複する。axe の tag の付け方は
        // docs/guides/accessibility.md「a11y の tag を付ける」。
        //
        // `strictTags` は既定で有効なので、ここに無い tag を書いたテストはエラーで落ちる。
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
          // CI の遅さに備えて操作の上限を config で置くための option (vitest-dev/vitest#6983)。
          // あわせて `expect.poll.timeout` を `expect.element` へ届かせる役も持つ。vitest は
          // actionTimeout が未設定のときだけ assert の timeout をタスクの残り予算から計算する
          // (vitest-dev/vitest#8308 が OPEN)。固定値にするとテスト後半ほど予算が縮む問題も消える (vitest-dev/vitest#7871)
          provider: playwright({ actionTimeout: ASSERT_TIMEOUT_MS }),
          // 既定 viewport は src/test/browser/viewport-sizes.ts が持つ。写すとどちらかが古くなるので import する
          viewport: DEFAULT_VIEWPORT,
        },
      },
    }),
  );
}
