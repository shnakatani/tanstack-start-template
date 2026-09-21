import type axe from "axe-core";

/**
 * a11y の失敗メッセージのうち、node を並べる部分。
 *
 * 要素セレクタだけだと、どの色が何対何で落ちたのかが読めないので `failureSummary` まで出す。
 * ブラウザテスト側 (`a11y.ts`) と story 側 (`a11y-story.ts`) が同じ形で出すために共有する。
 */
export function describeA11yNodes(nodes: readonly axe.NodeResult[]): string {
  return nodes
    .map((node) => `    ${node.target.join(" ")}\n      ${node.failureSummary ?? ""}`)
    .join("\n");
}
