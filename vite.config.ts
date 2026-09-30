import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

import { companionFilePattern } from "./scripts/lib/companion-files";
import { lintConfig } from "./tooling/lint/config";
import { testConfig } from "./tooling/test/config";

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
  // config をメタデータとしてだけ読む経路で plugin を評価しない。関数は同期のままにし、plugin は先頭で import する
  // (docs/guides/vite-configuration.md「plugin を先頭で import する理由」)
  plugins: lazyPlugins(() => {
    // Vitest の中では React の変換だけにする (tanstackStart() は TanStack/router#6246 の回避で外す)。
    // 外す plugin ごとの理由と、判定を process.env.VITEST で書く理由は
    // docs/guides/testing/configuration.md「テストの分岐で plugin を外す理由」「判定を `process.env.VITEST` で書く理由」
    if (process.env.VITEST === "true") return [viteReact()];
    return [
      devtools(),
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
      // Compiler の bail out をビルドログへ出す (ADR-0014)
      viteReact({ compiler: { logDiagnostics: true } }),
    ];
  }),
});
