import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

import { BROWSER_TEST_GLOB } from "./scripts/lib/companion-files";
import { ASSERT_TIMEOUT_MS } from "./src/test/assert-budget";
import { DEFAULT_VIEWPORT } from "./src/test/viewport-sizes";

export default defineProject({
  // vite.config.ts と同じく .env を読まない。vitest.config.ts は vite.config.ts を
  // 継承せず上書きする (Vitest 公式「all options in your vite.config will be ignored」)。
  // mergeConfig で引き継ぐ手はあるが、この config は tanstackStart() を外すために
  // 分けているので、全体を継承すると plugin ごと戻ってしまう。1 行だけ写す (ADR-0005)
  envDir: false,
  // Tailwind をブラウザテストでも実 CSS に解決する。setupFiles の
  // src/test/browser-setup.tsx が src/styles.css を import し、この plugin が
  // ユーティリティクラスを生成する。node 側 (vitest.config.ts) には不要。
  plugins: [viteReact(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    // registry combobox の @base-ui/react barrel import が React を二重解決し invalid hook call になるのを防ぐ。
    dedupe: ["react", "react-dom"],
  },
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
    // test 環境では plugin ごと外しており (この構成自体が回避策)、その穴を埋める対症療法として
    // include を置く。出口条件: 次のどちらかが解消したら本項の削除を再評価する。
    // - TanStack/router#6246 (plugin が test 環境にも optimizeDeps を無条件注入し React が null 解決)
    // - vitest-dev/vitest#10775 (テストファイル読込中の依存最適化で suite を喪失)。
    //   この issue は closed だが上流修正ではなく報告者が自分のテストを直しただけで
    //   (コメント 1 件、closed イベントの commit_id は null)、close を出口条件にしない。
    //   判定は include を外して browser project を回し、上の症状が出ないことで行う
    // テストからしか参照されない依存が増えたらここへ足す
    include: ["@tanstack/react-query", "@tanstack/react-form", "@tanstack/react-pacer", "axe-core"],
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
    // `src/test/assert-budget.ts` が持つ。`actionTimeout` と対で効き、これを消すと
    // vitest の既定 1000ms、`actionTimeout` を消すと残り予算を使い切る側へ戻る
    expect: { poll: { timeout: ASSERT_TIMEOUT_MS } },
    // a11y の検査は project ではなく tag で分ける。runner の設定が挙動テストと同じで、
    // project を足すとそのぶん描画が増えるため。挙動テストの途中の状態を測る assert には
    // tag を付けない。専用テストへ降ろすと操作の再現が重複する。
    //
    // `strictTags` は既定で有効なので、ここに無い tag を書いたテストはエラーで落ちる。
    tags: [
      {
        name: "a11y",
        description:
          "この project で axe を回すテスト。story 側の a11y は addon が別に当てるので含まない",
      },
    ],
    setupFiles: ["src/test/browser-setup.tsx"],
    include: [BROWSER_TEST_GLOB],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/worktrees/**",
      "**/.claude/skills/**",
    ],
    browser: {
      enabled: true,
      // CI の遅さに備えて操作の上限を config で置くための option (vitest-dev/vitest#6983)。
      // あわせて `expect.poll.timeout` を `expect.element` へ届かせる役も持つ。vitest は
      // actionTimeout が未設定のときだけ assert の timeout をタスクの残り予算から計算する
      // (#8308 が OPEN)。固定値にするとテスト後半ほど予算が縮む問題も消える (#7871)
      provider: playwright({ actionTimeout: ASSERT_TIMEOUT_MS }),
      headless: true,
      // 既定 viewport は src/test/viewport.ts が持つ。写すとどちらかが古くなるので import する
      viewport: DEFAULT_VIEWPORT,
      instances: [{ browser: "chromium" }],
    },
  },
});
