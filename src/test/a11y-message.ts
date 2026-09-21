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

/**
 * 失敗メッセージのうち、node を並べる部分。
 *
 * `target` は frame を跨ぐと要素が増え、shadow DOM だと入れ子の配列になる
 * (`axe.d.ts` の `UnlabelledFrameSelector` と `ShadowDomSelector`)。素で `join` すると
 * 入れ子がカンマで潰れるので平らにしてからつなぐ。
 */
export function describeA11yNodes(nodes: readonly axe.NodeResult[]): string {
  return nodes
    .map((node) => `    ${node.target.flat().join(" ")}\n      ${node.failureSummary ?? ""}`)
    .join("\n");
}
