import type axe from "axe-core";

import { describeA11yNodes } from "./a11y-message";

// story の a11y 合否判定。消費者は `.storybook/a11y-incomplete/preview.ts` だけで、
// ブラウザテストからは呼ばない。
//
// 層を分ける軸は ADR-0026 の節 1。story は描画を統制できるので `incomplete` を落とし、
// 組み上げて操作するブラウザテストでは落とさない。

/**
 * 合否から外す `incomplete`。単一部品でも統制の外へ出る状態だけを、
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
 * `addon-a11y` が `reporting` へ積んだ結果から、合否へ入れる `incomplete` を選ぶ。
 * 落ちる理由は文言で返し、throw は annotation 側が持つ。
 *
 * axe を回し直さない。回し直すと、addon の走査範囲 (`document.body` から Storybook 自身の要素を
 * 除いたもの) と `parameters.a11y` の解釈を写すことになり、2 つが静かにずれる。addon は走査の
 * 直前に `axe.reset()` を呼ぶので、回し直す側は前の story の設定を引き継いだまま走る。
 *
 * レポートが無い形と読めない形は文言を返す。どちらも「検査が動いていない」を意味し、
 * 素通りさせると CI は無音のまま緑を出す。
 */
export function checkA11yIncomplete(context: {
  readonly reporting: {
    readonly reports: readonly { readonly type: string; readonly result: unknown }[];
  };
  readonly parameters: unknown;
  readonly viewMode: string;
}): string | null {
  // addon は story 表示のときしか走らない。docs 表示でレポートを探すと必ず空になる
  if (context.viewMode !== "story") return null;
  if (isA11yTurnedOff(context.parameters)) return null;

  const report = context.reporting.reports.find((item) => item.type === "a11y");
  if (report === undefined) {
    return "addon-a11y のレポートが無い。afterEach の実行順が変わったか、a11y の検査自体が動いていない (ADR-0026 の節 1)";
  }
  // addon が走査に失敗した形。addon 自身がそのまま throw するので、ここで重ねない
  if (isErrorResult(report.result)) return null;
  if (!hasIncompleteResults(report.result)) {
    return "addon-a11y のレポートを読めない。addon の結果の形が変わった (ADR-0026 の節 1)";
  }

  const unexpected = collectUnexpectedIncomplete(report.result.incomplete);
  if (unexpected.length === 0) return null;
  return `axe が判定できなかった項目\n${describeA11yResults(unexpected).join("\n")}`;
}

/** story が a11y の検査を切っているか (`disable` / `test: "off"` は addon の公開パラメータ) */
function isA11yTurnedOff(parameters: unknown): boolean {
  if (typeof parameters !== "object" || parameters === null || !("a11y" in parameters))
    return false;
  const { a11y } = parameters;
  if (typeof a11y !== "object" || a11y === null) return false;
  return ("disable" in a11y && a11y.disable === true) || ("test" in a11y && a11y.test === "off");
}

/** addon が走査に失敗したときの形 (`{ error }`) */
function isErrorResult(result: unknown): boolean {
  return typeof result === "object" && result !== null && "error" in result;
}

function hasIncompleteResults(result: unknown): result is { incomplete: axe.Result[] } {
  return (
    typeof result === "object" &&
    result !== null &&
    "incomplete" in result &&
    Array.isArray(result.incomplete)
  );
}

/**
 * 合否へ入れる `incomplete` だけを残す。`IGNORED_INCOMPLETE` に当たる node を落とし、
 * node が残らなくなった結果ごと落とす。
 */
export function collectUnexpectedIncomplete(incomplete: readonly axe.Result[]): axe.Result[] {
  return incomplete
    .map((item) => ({ ...item, nodes: item.nodes.filter((node) => !isIgnoredNode(item.id, node)) }))
    .filter((item) => item.nodes.length > 0);
}

/** 判定できなかった項目の失敗メッセージ */
export function describeA11yResults(results: readonly axe.Result[]): string[] {
  return results.map((item) => `${item.id}: ${item.help}\n${describeA11yNodes(item.nodes)}`);
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
