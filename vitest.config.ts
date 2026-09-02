import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const sharedExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.claude/worktrees/**",
  "**/.claude/skills/**",
  // fixture は lint の検査対象であってテストではない。現在は .test.* 名の fixture を
  // 置いていないので空振りするが、置いた瞬間に checks-integrity の
  // scripts/checks/integrity/**/*.test.ts へ一致して収集される
  "**/scripts/checks/integrity/fixtures/**",
];

export default defineConfig({
  // vite.config.ts と同じく .env を読まない。vitest.config.ts は vite.config.ts を
  // 継承せず上書きする (Vitest 公式「all options in your vite.config will be ignored」)。
  // mergeConfig で引き継ぐ手はあるが、この config は tanstackStart() を外すために
  // 分けているので、全体を継承すると plugin ごと戻ってしまう。1 行だけ写す (ADR-0002)
  envDir: false,
  plugins: [viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: sharedExclude,
        },
      },
      {
        extends: true,
        test: {
          name: "scripts-tools",
          include: ["scripts/lib/**/*.test.ts", "scripts/dev-env/**/*.test.ts"],
          exclude: sharedExclude,
          // scripts のテストは bash / git の subprocess 起動を伴い、全体 run の
          // 並列負荷では既定 5s を超えることがある
          testTimeout: 20_000,
        },
      },
      {
        extends: true,
        test: {
          name: "checks-integrity",
          include: ["scripts/checks/integrity/**/*.test.ts"],
          exclude: sharedExclude,
          testTimeout: 20_000,
        },
      },
      "vitest.browser.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**"],
      exclude: [
        "src/routeTree.gen.ts",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test/**",
        "src/**/*.d.ts",
      ],
    },
  },
});
