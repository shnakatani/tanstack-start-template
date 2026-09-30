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
  // Vite の .env 読み込みを切る。秘密を暗号化して .env ごとコミットする方式 (dotenvx 等) は、
  // Vite が .env を native に読むと暗号文をそのまま import.meta.env / process.env へ流し込む。
  // vitejs/vite#19373 がその衝突の報告で、`envDir: false` はその解として追加された。
  // このプロジェクトは環境ごとに変わらない値をモジュール定数で持つため (src/lib/app-name.ts)、
  // 読み込む .env がそもそも無い。将来 .env を置いても勝手に読まれない状態を先に固定する
  envDir: false,
  staged: {
    // --no-error-on-unmatched-pattern: staged 対象が ignorePatterns の生成ファイル
    // (routeTree.gen.ts) だけのコミットで、対象ゼロを error にしない
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
  // lazyPlugins: lint / fmt / check / staged / pack / create と run・cache のタスク探索、
  // エディタ連携は config をメタデータとしてしか読まない。素の配列で書くとそれらの経路でも
  // プラグイン factory が毎回評価され、watcher の起動などの副作用まで走る。dev / build /
  // test / preview と vp run / vp exec が spawn するビルドでは従来どおり読み込まれる
  plugins: lazyPlugins(() => {
    // Vitest の中では React の変換だけにする (tanstackStart() は TanStack/router#6246 の回避で外す)。
    // 外す plugin ごとの理由と、判定を process.env.VITEST で書く理由は
    // docs/guides/testing/configuration.md「テストの分岐で plugin を外す理由」「判定を `process.env.VITEST` で書く理由」
    if (process.env.VITEST === "true") return [viteReact()];
    return [
      devtools(),
      tailwindcss(),
      tanstackStart({
        // テストとテスト専用ヘルパーを route ファイル扱いから外す。外さないと generator が
        // 「Route を export していない」と毎ビルド警告する
        router: { routeFileIgnorePattern: companionFilePattern() },
        importProtection: {
          client: {
            // better-sqlite3 は native binding (node-gyp) を持ち、client bundle に含めると
            // ビルドが壊れる。DB アクセスは src/server/db/ と *.server.* に閉じる
            specifiers: ["better-sqlite3"],
            // 永続化層 (src/server/db/) と *.server.* を client から遮断する。schema.ts の
            // ように native を引かないファイルは specifiers だけでは素通りし、UI が直接
            // import しても壊れずに層が漏れるため、パス単位で止める。
            // ドメインの実処理は src/features/<domain>/handlers.server.ts に置き、
            // *.server.* 側が遮断する (ADR-0010)。この配列は既定を merge せず置換するので
            // (plugin.js の pick)、*.server.* を落とすと接尾辞の遮断ごと消える
            files: ["**/src/server/db/**", "**/*.server.*"],
          },
          // 既定は dev が "mock"、build が "error"。dev のままだと境界違反が再帰 Proxy へ
          // 差し替わって止まらず、遮断を機械保証する目的が開発中だけ外れる
          behavior: "error",
        },
      }),
      nitro({
        builder: "rolldown",
        // 全レスポンスへ静的なセキュリティヘッダを付ける。Nitro 層の機能なので preset に
        // 依存しないが、TanStack Start 公式の Cloudflare 手順は nitro() を使わない構成
        // (@cloudflare/vite-plugin + wrangler.jsonc) なので、そこへ移すときは付け直しが要る。
        // CSP はここに置かない。nonce をリクエストごとに変える必要があり、headers は静的な
        // 文字列しか取れないため (配線は router の ssr.nonce と対で設計する)。
        // 実レスポンスに乗ることは scripts/checks/runtime/security-headers.ts が押さえる
        routeRules: {
          "/**": {
            headers: {
              // MIME スニッフィングを止める。Content-Type を偽装した応答を実行させない
              "X-Content-Type-Options": "nosniff",
              // frame への埋め込みを禁じ、clickjacking を塞ぐ
              "X-Frame-Options": "DENY",
              // Referer に path とクエリを載せない。外部サイトへ遷移するときの漏れを防ぐ
              "Referrer-Policy": "strict-origin-when-cross-origin",
              // 別 origin の window と browsing context group を分ける
              "Cross-Origin-Opener-Policy": "same-origin",
              // 別 origin からの読み込みを拒む
              "Cross-Origin-Resource-Policy": "same-origin",
              // HTTPS へ固定する。http で配信する開発サーバは routeRules を通らないので影響しない
              "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            },
          },
        },
      }),
      // logDiagnostics: Compiler が諦めた箇所 (bail out) をビルドログへ出す。既定は false で、
      // 最適化が外れたことがどこにも現れない。fatal は常に transform を失敗させる
      viteReact({ compiler: { logDiagnostics: true } }),
    ];
  }),
});
