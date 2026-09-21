import axe from "axe-core";
import { expect } from "vite-plus/test";

/**
 * 合否から外す `incomplete`。部品の構造から恒常的に出るものだけを、
 * (ルール, `messageKey`) の粒度で挙げる (ADR-0026 の節 1)。
 *
 * 落とすほうを名指しにしない。axe のメタデータには「この incomplete は判定不能を意味する」を
 * 表すフラグが無いので、落とすほうを列挙すると新しい原因が出たときに無言で緑になる。
 */
const IGNORED_INCOMPLETE: readonly { readonly rule: string; readonly messageKey?: string }[] = [
  // ダイアログが開いている間は、その配下の tabbable 要素が必ずここへ出る (axe の
  // focusable-modal-open)。閉じかけの popup も同じ。messageKey を持たないので粒度を下げられない
  { rule: "aria-hidden-focus" },
  // aria-haspopup と aria-controls を併せ持つ trigger で必ず出る。axe-core#4418 の設計で、
  // 参照先が実在しても出る (#4861、open)。同じルールの noId は実バグなので外さない
  { rule: "aria-valid-attr-value", messageKey: "controlsWithinPopup" },
];

/**
 * 合否へ入れる `incomplete` だけを残す。story 側とブラウザテスト側で同じ基準を使う。
 *
 * `IGNORED_INCOMPLETE` に当たる node を落とし、node が残らなくなった結果ごと落とす。
 */
export function collectUnexpectedIncomplete(incomplete: readonly axe.Result[]): axe.Result[] {
  return incomplete
    .map((item) => ({ ...item, nodes: item.nodes.filter((node) => !isIgnoredNode(item.id, node)) }))
    .filter((item) => item.nodes.length > 0);
}

/** 失敗メッセージ。要素セレクタだけだと、どの色が何対何で落ちたのかが読めない */
export function describeA11yResults(results: readonly axe.Result[]): string[] {
  return results.map(
    (item) =>
      `${item.id}: ${item.help}\n` +
      item.nodes
        .map((node) => `    ${node.target.join(" ")}\n      ${node.failureSummary ?? ""}`)
        .join("\n"),
  );
}

/** その node が `IGNORED_INCOMPLETE` のどれかに当たるか */
function isIgnoredNode(rule: string, node: axe.NodeResult): boolean {
  const keys = new Set(
    [...node.any, ...node.all, ...node.none].map((check) =>
      typeof check.data === "object" && check.data !== null && "messageKey" in check.data
        ? check.data.messageKey
        : undefined,
    ),
  );
  return IGNORED_INCOMPLETE.some(
    (ignored) =>
      ignored.rule === rule && (ignored.messageKey === undefined || keys.has(ignored.messageKey)),
  );
}

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
 * `expect*` のパターンだから (ADR-0004)。
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

  // incomplete は「axe が判定できなかった」結果。既定で落とし、構造的に出るものだけ外す。
  // color-contrast は背景を解決できないと violations ではなく incomplete へ落ちるため、
  // 無視すると検査が無言で骨抜きになる (ADR-0026)
  expect(
    describeA11yResults(collectUnexpectedIncomplete(result.incomplete)),
    "axe が判定できなかった項目",
  ).toEqual([]);

  // 1 つもルールが走らなかった (container が空だった) 場合を通さない
  expect(result.passes.length, "適用されたルールがゼロ").toBeGreaterThan(0);
}
