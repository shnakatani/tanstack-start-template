import axe from "axe-core";
import { expect } from "vite-plus/test";

/**
 * ブラウザテスト用の a11y アサーション。
 *
 * 静的 lint (jsx-a11y) と役割・名前のアサーションでは届かない領域を埋める。
 * axe-core は描画後の DOM を見るため、算出済みの色・実際の ARIA 属性値・id の重複を検査できる。
 * `color-contrast` は実ブラウザでのみ動くルールで、jsdom では結果が incomplete になる。
 *
 * 対象外: WCAG 1.4.11 (非テキストの 3:1) は axe-core のルールに無い。`--success` のような
 * アイコン色の比率は `src/styles.css` のコメントが根拠を持つ。ここでは代替できない。
 *
 * ヘルパー名を `expect` で始めるのは、`vitest/expect-expect` が assertion と認めるのが
 * `expect*` のパターンだから (ADR-0004)。
 */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  const result = await axe.run(container, {
    rules: {
      // region は「ページ本体が landmark の中にあるか」を見る文書レベルの規則で、
      // コンポーネントや 1 ページを単体 render するテストは __root.tsx を通らないため
      // 必ず違反になる。文書側の landmark (<main>) は root-document.test.tsx が押さえる
      region: { enabled: false },
    },
  });

  // failureSummary まで出す。要素セレクタだけだと、どの色が何対何で落ちたのかが読めない
  const describeNodes = (nodes: readonly { target: unknown[]; failureSummary?: string }[]) =>
    nodes
      .map((node) => `    ${node.target.join(" ")}\n      ${node.failureSummary ?? ""}`)
      .join("\n");

  expect(
    result.violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "impact 不明"}): ${violation.help}\n${describeNodes(violation.nodes)}`,
    ),
    "a11y 違反",
  ).toEqual([]);

  // incomplete は「axe が判定できなかった」結果。color-contrast は背景を解決できないと
  // violations ではなく incomplete へ落ちるため、無視すると検査が無言で骨抜きになる
  expect(
    result.incomplete.map((item) => `${item.id}: ${item.help}\n${describeNodes(item.nodes)}`),
    "axe が判定できなかった項目",
  ).toEqual([]);

  // 1 つもルールが走らなかった (container が空だった) 場合を通さない
  expect(result.passes.length, "適用されたルールがゼロ").toBeGreaterThan(0);
}
