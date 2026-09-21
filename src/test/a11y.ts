import axe from "axe-core";
import { expect } from "vite-plus/test";

/**
 * story 側で合否から外す `incomplete`。単一部品でも統制の外へ出る状態だけを、
 * (ルール, `messageKey`) の粒度で挙げる (ADR-0026 の節 1)。
 *
 * 落とすほうを名指しにしない。axe のメタデータには「この incomplete は判定不能を意味する」を
 * 表すフラグが無いので、落とすほうを列挙すると新しい原因が出たときに無言で緑になる。
 */
const IGNORED_INCOMPLETE: readonly { readonly rule: string; readonly messageKey?: string }[] = [
  // popup は開いている間だけ統制の外へ出る。axe はダイアログが可視なら、その配下の tabbable
  // 要素をまとめて判定不能にする (focusable-modal-open)。閉じかけの窓も同じ。story 側で
  // 描き方を変えても消せない。補強として mui/base-ui#5528 が open
  { rule: "aria-hidden-focus" },
  // 同じく popup の状態。aria-haspopup と aria-controls を併せ持つ trigger で必ず出る。
  // 補強として axe-core#4418 の設計と、参照先が実在しても出る #4861 (open)。
  // 同じルールの noId は部品側の信号なので外さない
  { rule: "aria-valid-attr-value", messageKey: "controlsWithinPopup" },
];

/**
 * 合否へ入れる `incomplete` だけを残す。使うのは story 側 (`.storybook/preview.tsx`) だけで、
 * この関数はブラウザテストからは呼ばない (ADR-0026 の節 1)。
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

  // incomplete はここでは見ない。組み上げて操作した結果に出るものは、部品の問題ではなく
  // 合成とタイミングの産物で、実行環境の速さで結果が変わる (ADR-0018 の事故)。統制できる
  // 単一部品の側 (story) で落とし、ここは出たときに人が読む (ADR-0026 の節 1)

  // 1 つもルールが走らなかった (container が空だった) 場合を通さない
  expect(result.passes.length, "適用されたルールがゼロ").toBeGreaterThan(0);
}
