import type axe from "axe-core";

/**
 * a11y の失敗メッセージ。ブラウザテスト側 (`a11y.ts`) と story 側 (`a11y-story.ts`) が
 * 同じ形で出すために共有する。
 *
 * 要素セレクタだけだと、どの色が何対何で落ちたのかが読めないので `failureSummary` まで出す。
 * `impact` は付いているときだけ出す。`incomplete` には無いことがある。
 */
export function describeA11yResults(results: readonly axe.Result[]): string[] {
  return results.map(
    (item) =>
      `${item.id}${item.impact === undefined ? "" : ` (${item.impact})`}: ${item.help}\n` +
      describeA11yNodes(item.nodes),
  );
}

/** 失敗メッセージのうち、node を並べる部分 */
export function describeA11yNodes(nodes: readonly axe.NodeResult[]): string {
  return nodes
    .map((node) => `    ${describeTarget(node.target)}\n      ${node.failureSummary ?? ""}`)
    .join("\n");
}

/**
 * axe の `target` を 1 行にする。
 *
 * frame を跨ぐと要素が増え、shadow root を跨ぐと 1 段だけ入れ子になる (`axe.d.ts` の
 * `UnlabelledFrameSelector` は `CrossTreeSelector[]`、`ShadowDomSelector` は
 * `[string, string, ...string[]]`)。axe 自身は文字列化の形を持たないので、ここで決める。
 *
 * shadow の境界を空白でつなぐと、**見た目は妥当なのに解決できない**セレクタになる。
 * 境界は `>>` で見せて、貼れば動くものと区別が付くようにする。
 */
function describeTarget(target: axe.UnlabelledFrameSelector): string {
  return target
    .map((selector) => (typeof selector === "string" ? selector : selector.join(" >> ")))
    .join(" ");
}
