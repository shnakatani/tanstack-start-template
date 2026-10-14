import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

import { companionFilePattern } from "./scripts/lib/companion-files";
import { lintConfig } from "./tooling/lint/config";
import { reactPlugin } from "./tooling/plugins/react";
import { testConfig } from "./tooling/test/config";

// CI はこの手順を 1 つずつ別の step で打つ。足したら .github/workflows/ci.yml にも step を足す。
// 足し忘れても CI は落ちず、その手順が CI で走らないだけになる (ADR-0004)
const verifySteps = {
  // 素の pnpm で打つ。vp pm は peers を中継しない (docs/guides/dependencies-and-toolchain.md「peer の食い違いを数える」)
  "verify:peers": "pnpm peers check",
  "verify:check": "vp check",
  "verify:test": "vp test run",
  "verify:time-zones": "node scripts/time-zones/run-tests.ts",
  "verify:build": "vp build",
  "verify:security-headers": "node scripts/checks/runtime/security-headers.ts",
};

export default defineConfig({
  // Vite の .env 読み込みを切る (ADR-0004、vitejs/vite#19373)
  envDir: false,
  staged: {
    // --no-error-on-unmatched-pattern: staged が生成ファイル (routeTree.gen.ts) だけのとき対象ゼロを error にしない
    "*.{ts,tsx,js,jsx}": [
      "vp fmt --write --no-error-on-unmatched-pattern",
      "vp lint --fix --no-error-on-unmatched-pattern",
    ],
    "*.md": ["vp fmt --write --no-error-on-unmatched-pattern"],
  },
  run: {
    // キャッシュすると、gate の 2 回目がリプレイで済まされる。キャッシュが効くタスクには、既定の組に無い
    // 親の環境変数 (mise の DB_FILE_NAME) が 1 回目から届かない (ADR-0004)。
    // `vp run --cache` はこの設定を外すので、gate には付けない
    cache: false,
    tasks: {
      // worktree を知らず、既定の port で起動する。worktree ごとの port は .mise.toml の
      // 同名のタスクが引数で足す。使用中なら次の port へずらさずに止める (ADR-0004)。
      // serve は DB_FILE_NAME が無ければ起動の前に止める。代入の形で書く (docs/guides/vite-configuration.md
      // 「タスクを足す」)
      serve:
        "DB_FILE_NAME=${DB_FILE_NAME:?mise の環境が要る。mise run serve で打つ} vp dev --strictPort",
      storybook: "vp exec storybook dev --no-open --exact-port",
      ...verifySteps,
      verify: Object.keys(verifySteps).map((task) => `vp run ${task}`),
      contrast: "node scripts/contrast/report.ts",
      "db:generate": "vp exec drizzle-kit generate",
      "db:migrate": "vp exec drizzle-kit migrate",
      "db:seed": { command: "vp exec tsx scripts/db/seed.ts", dependsOn: ["db:migrate"] },
      "a11y:incomplete":
        "vp test run --project browser --tags-filter axe --reporter=verbose --hide-skipped-tests",
    },
  },
  lint: lintConfig,
  fmt: {
    sortImports: true,
    ignorePatterns: [
      "src/routeTree.gen.ts",
      ".claude/worktrees/**",
      ".agents/**",
      ".claude/skills/**",
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: testConfig,
  // config をメタデータとしてだけ読む経路で plugin の factory を呼ばない (先頭の import は遅れない)。
  // 関数は同期のままにする (docs/guides/vite-configuration.md「plugin を先頭で import する理由」)
  plugins: lazyPlugins(() => {
    // Vitest の中では root の plugin を全部外す (tanstackStart() は TanStack/router#6246 の回避で外す)。
    // React の変換はブラウザで走る project が Compiler の有無ごとに足す。外す plugin ごとの理由と、
    // 判定を process.env.VITEST で書く理由は
    // docs/guides/testing/configuration.md「テストの分岐で plugin を外す理由」「判定を `process.env.VITEST` で書く理由」
    if (process.env.VITEST === "true") return [];
    return [
      // devtools のサーバ (既定の port は 4206) を起こさない。認証の無いメッセージで、dev server の上で
      // パッケージの install をシェル越しに走らせる (TanStack/devtools#464)。画面はこのサーバにつながない
      // (<TanStackDevtools> の eventBusConfig.connectToServerBus は既定で false) ので、止めても失う機能は無い
      devtools({ eventBusConfig: { enabled: false } }),
      tailwindcss(),
      tanstackStart({
        // テストとテスト専用ヘルパーを route から外す。外さないと generator が毎ビルド警告する
        router: { routeFileIgnorePattern: companionFilePattern() },
        importProtection: {
          client: {
            // native binding を持ち、client bundle に入ると壊れる
            specifiers: ["better-sqlite3"],
            // 既定を置換するので *.server.* を落とさない (ADR-0010)
            files: ["**/src/server/db/**", "**/*.server.*"],
          },
          // dev の既定 "mock" では、境界違反が再帰 Proxy へ差し替わって止まらない
          behavior: "error",
        },
      }),
      nitro({
        builder: "rolldown",
        // 全レスポンスへ静的なセキュリティヘッダを付ける。足し方と CSP を置かない理由は
        // docs/guides/security-headers.md「ヘッダを足す・変える」「CSP を置かない理由」
        routeRules: {
          "/**": {
            headers: {
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY",
              "Referrer-Policy": "strict-origin-when-cross-origin",
              "Cross-Origin-Opener-Policy": "same-origin",
              "Cross-Origin-Resource-Policy": "same-origin",
              "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            },
          },
        },
      }),
      // bail out はビルドログへ出す (ADR-0014)
      reactPlugin({ compiler: true, reportDiagnostics: true }),
    ];
  }),
});
