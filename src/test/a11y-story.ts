import type { A11yTypes } from "@storybook/addon-a11y";
import type axe from "axe-core";

import { describeA11yResults } from "./a11y-message";

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
  readonly parameters: A11yTypes["parameters"];
  readonly globals: A11yTypes["globals"] & { readonly ghostStories?: unknown };
  readonly viewMode: string;
}): string | null {
  if (!isIncompleteGateActive(context)) return null;

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

/**
 * この story で `incomplete` を合否へ入れるか。**addon のゲートと同じ条件を並べる。**
 * 出典は `@storybook/addon-a11y` の `dist/_browser-chunks/chunk-P5J2FJ2Z.js` で、
 * `shouldRunEnvironmentIndependent` の 4 条件と、その直後の `viewMode === "story"` である。
 *
 * ここが addon より緩いと、addon が走らなかった story を「レポートが無い」で落とす。
 * `manual` は addon パネルのトグルで、公式が案内する切り方である
 * (storybook.js.org/docs/writing-tests/accessibility-testing#disable-automated-checks)。
 * addon が条件を足したら、こちらが偽陽性を出して知らせる。
 */
function isIncompleteGateActive(context: {
  readonly parameters: A11yTypes["parameters"];
  readonly globals: A11yTypes["globals"] & { readonly ghostStories?: unknown };
  readonly viewMode: string;
}): boolean {
  return (
    context.viewMode === "story" &&
    !context.globals.ghostStories &&
    context.parameters.a11y?.disable !== true &&
    context.parameters.a11y?.test !== "off" &&
    // "todo" は addon が違反を warning へ降ろす形 (同 chunk の `getMode`)。合否へ入れない側で
    // 揃える。ここだけ落とすと、既知の問題を寝かせる逃がし弁が半分しか効かない
    context.parameters.a11y?.test !== "todo" &&
    context.globals.a11y?.manual !== true
  );
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

/**
 * その node を合否から外すか。
 *
 * `messageKey` で外すものは、その node が挙げた `messageKey` が**すべて**外す対象のときだけ
 * 落とす。axe は node 単位でしか報告しないので、外さないキー (`aria-valid-attr-value` の
 * `noId` など) が 1 つでも混ざっていたら、その node は部品側の信号を含んでいる (ADR-0026 の節 1)。
 */
function isIgnoredNode(rule: string, node: axe.NodeResult): boolean {
  const ignored = IGNORED_INCOMPLETE.filter((item) => item.rule === rule);
  if (ignored.length === 0) return false;
  if (ignored.some((item) => item.messageKey === undefined)) return true;

  const keys = messageKeys(node);
  return keys.length > 0 && keys.every((key) => ignored.some((item) => item.messageKey === key));
}

/** その node の check が挙げた `messageKey` */
function messageKeys(node: axe.NodeResult): string[] {
  return [...node.any, ...node.all, ...node.none].flatMap((check) =>
    typeof check.data === "object" &&
    check.data !== null &&
    "messageKey" in check.data &&
    typeof check.data.messageKey === "string"
      ? [check.data.messageKey]
      : [],
  );
}
