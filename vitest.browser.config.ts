import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "vite-plus/test/browser-playwright";
import { defineProject } from "vite-plus/test/config";

export default defineProject({
  // vite.config.ts と同じく .env を読まない。vitest.config.ts は vite.config.ts を
  // 継承せず上書きする (Vitest 公式「all options in your vite.config will be ignored」)。
  // mergeConfig で引き継ぐ手はあるが、この config は tanstackStart() を外すために
  // 分けているので、全体を継承すると plugin ごと戻ってしまう。1 行だけ写す (ADR-0002)
  envDir: false,
  // Tailwind をブラウザテストでも実 CSS に解決する。setupFiles の
  // src/test/browser-setup.ts が src/styles.css を import し、この plugin が
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
    include: ["@tanstack/react-query", "@tanstack/react-form", "axe-core"],
    // Start plugin 不在の test 環境では #tanstack-*-entry 仮想 import が解決不能
    exclude: [
      "@tanstack/react-start",
      "@tanstack/react-start-server",
      "@tanstack/start-server-core",
    ],
  },
  test: {
    name: "browser",
    setupFiles: ["src/test/browser-setup.ts"],
    include: ["src/**/*.test.tsx"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.claude/worktrees/**",
      "**/.claude/skills/**",
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // 既定 viewport の SSOT (src/test/viewport.ts の DEFAULT_VIEWPORT と対にする)。
      // Playwright の browser context 既定と同値だが、暗黙依存にすると
      // DEFAULT_VIEWPORT との対応が読めなくなるため明示する
      viewport: { width: 1280, height: 720 },
      instances: [{ browser: "chromium" }],
    },
  },
});
