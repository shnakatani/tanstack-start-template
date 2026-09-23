import axe from "axe-core";
import { expect } from "vite-plus/test";

import { describeA11yResults } from "./a11y-message";

/**
 * ブラウザテスト用の a11y アサーション。
 *
 * 静的 lint (jsx-a11y) と役割・名前のアサーションでは届かない領域を埋める。
 * axe-core は描画後の DOM を見るため、算出済みの色・実際の ARIA 属性値・id の重複を検査できる。
 * `color-contrast` は実ブラウザでのみ動くルールで、jsdom では結果が incomplete になる。
 *
 * 対象外: WCAG 1.4.11 (非テキストの 3:1) は axe-core のルールに無い。要望は
 * dequelabs/axe-core#3907 が 2023-02-09 から open で、入力欄の境界を対象にした
 * ルール案 #854 は PARKED のまま閉じている。`--border` / `--input` の枠線と、
 * 不透明度を落として描く focus indicator (`ring-ring/50`) の比率はここでは
 * 検出できない。実測値と判断の根拠は ADR-0024 が持つ。
 *
 * ヘルパー名を `expect` で始めるのは、`vitest/expect-expect` が assertion と認めるのが
 * `expect*` のパターンだから (ADR-0007)。
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const result = await axe.run(container, {
    rules: {
      // region は「ページ本体が landmark の中にあるか」を見る文書レベルの規則で、
      // コンポーネントや 1 ページを単体 render するテストは __root.tsx を通らないため
      // 必ず違反になる。文書側の landmark (<main>) は root-document.test.ts が押さえる
      region: { enabled: false },
    },
  });

  expect(describeA11yResults(result.violations), "a11y 違反").toEqual([]);

  // incomplete は合否へ入れない。組み上げて操作した結果に出るものは、部品の問題ではなく
  // 合成とタイミングの産物で、実行環境の速さで結果が変わる (docs/guides/testing.md「animation を無効にして走らせる理由」の事故)。統制できる
  // 単一部品の側 (story) で落とす (ADR-0028)。ただし黙って捨てると、緑のときに
  // 何が測れていないのかを誰も読めない
  if (result.incomplete.length > 0) {
    console.warn("[a11y] axe が判定できなかった項目", describeA11yResults(result.incomplete));
  }

  // 1 つもルールが走らなかった (container が空だった) 場合を通さない
  expect(result.passes.length, "適用されたルールがゼロ").toBeGreaterThan(0);
}
