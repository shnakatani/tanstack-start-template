import type axe from "axe-core";

/**
 * a11y の失敗メッセージ。ブラウザテスト側 (`a11y.ts`) と story 側 (`a11y-story.ts`) が
 * 同じ形で出すために共有する。
 *
 * 要素セレクタだけだと、どの色が何対何で落ちたのかが読めないので `failureSummary` まで出す。
 * `impact` は付いているときだけ出す。axe は `Result.impact` へ必ず代入するが、値は
 * `ImpactValue` (`axe.d.ts`) で `null` を含み、`incomplete` では `null` になることがある。
 */
export function describeA11yResults(results: readonly axe.Result[]): string[] {
  return results.map(
    (item) =>
      `${item.id}${item.impact ? ` (${item.impact})` : ""}: ${item.help}\n` +
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
 * どちらの境界も空白でつながない。つなぐと **見た目は妥当なのに解決できない** セレクタに
 * なる (frame の内側も shadow の内側も、外側の document からは辿れない)。`>>` で見せて、
 * 貼れば動くものと区別が付くようにする。
 */
function describeTarget(target: axe.UnlabelledFrameSelector): string {
  return target
    .map((selector) => (typeof selector === "string" ? selector : selector.join(" >> ")))
    .join(" >> ");
}
