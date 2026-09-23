import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import { companionGlobs } from "./scripts/lib/companion-files";
import { storybookProjects } from "./vitest.storybook.config";

const sharedExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.claude/worktrees/**",
  "**/.claude/skills/**",
];

export default defineConfig({
  // vite.config.ts と同じく .env を読まない。vitest.config.ts は vite.config.ts を
  // 継承せず上書きする (Vitest 公式「all options in your vite.config will be ignored」)。
  // mergeConfig で引き継ぐ手はあるが、この config は tanstackStart() を外すために
  // 分けているので、全体を継承すると plugin ごと戻ってしまう。1 行だけ写す (ADR-0005)
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
          // 許可リストにすると、ツールを足すたびにここへ 1 行足すまでテストが無言で
          // 収集されない。検査だけを除いて残りを拾う形にする。検査は壊れる原因が違うので
          // 別 project が持つ (拒否リストの形は ADR-0039)
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
        extends: true,
        test: {
          name: "checks-integrity",
          include: ["scripts/checks/integrity/**/*.test.ts"],
          exclude: sharedExclude,
          testTimeout: 20_000,
        },
      },
      "vitest.browser.config.ts",
      // テーマごとの project。経路によって数が変わる (storybookProjects の docstring)
      ...storybookProjects(),
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**"],
      exclude: [
        "src/routeTree.gen.ts",
        // 付随ファイルは出荷されないので分母に入れない (directory-structure.md)
        ...companionGlobs("src/**/"),
        "src/test/**",
        "src/**/*.d.ts",
      ],
    },
  },
});
