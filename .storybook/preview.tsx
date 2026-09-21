import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/tanstack-react";
import axe from "axe-core";

import { collectUnexpectedIncomplete, describeA11yResults } from "../src/test/a11y";

import "./preview.css";

/** story の `parameters.a11y.config.rules` を `axe.run` の `rules` へ移す */
function toRunRules(parameters: unknown): axe.RunOptions["rules"] {
  if (typeof parameters !== "object" || parameters === null || !("a11y" in parameters)) return {};
  const { a11y } = parameters;
  if (typeof a11y !== "object" || a11y === null || !("config" in a11y)) return {};
  const { config } = a11y;
  if (typeof config !== "object" || config === null || !("rules" in config)) return {};
  const { rules } = config;
  if (!Array.isArray(rules)) return {};
  const entries = rules.flatMap((rule: unknown) =>
    typeof rule === "object" && rule !== null && "id" in rule && typeof rule.id === "string"
      ? [[rule.id, { enabled: "enabled" in rule ? rule.enabled !== false : true }] as const]
      : [],
  );
  return Object.fromEntries(entries);
}

const preview: Preview = {
  decorators: [
    // styles.css の @custom-variant dark (&:is(.dark *)) に合わせて html へ class を当てる
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
  ],
  parameters: {
    // 違反を警告で留めない。addon はここで violations を見る (ADR-0022)
    a11y: { test: "error" },
  },
  /**
   * `incomplete` を落とす。`addon-a11y` は `violations` の件数だけで合否を決めるので
   * (`dist/_browser-chunks/chunk-P5J2FJ2Z.js` の `hasViolations`)、これが無いと
   * `color-contrast` が背景を解決できなくなったときに検査が緑のまま何も見なくなる。
   * 何を落として何を外すかは `src/test/a11y.ts` が持ち、ブラウザテストと同じ基準になる (ADR-0026)。
   *
   * addon の結果を読み直す形は採れない。`reporting.reports` へ積むのは addon 自身の
   * `afterEach` で、preview / meta / story のどの層よりも後に走る (2026-09-21 実測)。
   * そのため axe をもう一度回す。所要は実測で変わらない。
   *
   * ここで見るのは `incomplete` だけにする。`violations` は addon が story の抑制込みで
   * 見ており、二重に持つと抑制が効かない側ができる。「適用されたルールがゼロ」も見ない。
   * `Skeleton` のようにどのルールも当たらない story が正当に存在する。
   */
  async afterEach({ canvasElement, parameters }) {
    const result = await axe.run(canvasElement, {
      // region は文書レベルの規則で、単体で描く story は必ず違反になる (src/test/a11y.ts と同じ)
      rules: { region: { enabled: false }, ...toRunRules(parameters) },
    });
    const unexpected = collectUnexpectedIncomplete(result.incomplete);
    if (unexpected.length > 0) {
      throw new Error(`axe が判定できなかった項目\n${describeA11yResults(unexpected).join("\n")}`);
    }
  },
};

export default preview;
