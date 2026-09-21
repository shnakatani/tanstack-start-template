import type axe from "axe-core";

/**
 * axe の結果を組み立てるフィクスチャ。`a11y*.test.ts` が共有する。
 *
 * `target` は `UnlabelledFrameSelector` で、frame を跨ぐときに要素が増える
 * (`node_modules/axe-core/axe.d.ts` の `NodeResult`)。配列のまま受ける。
 */
export function a11yCheck(messageKey?: string): axe.CheckResult {
  return {
    id: "color-contrast",
    impact: "serious",
    message: "",
    data: messageKey === undefined ? null : { messageKey },
    relatedNodes: [],
  };
}

export function a11yNode(
  options: { messageKeys?: readonly string[]; target?: string[]; summary?: string } = {},
): axe.NodeResult {
  const keys = options.messageKeys ?? [];
  return {
    html: "<p></p>",
    target: options.target ?? ["p"],
    // axe は 1 つの node へ複数の check を載せる。messageKey も node 単位で複数つく
    any: keys.length === 0 ? [a11yCheck()] : keys.map((key) => a11yCheck(key)),
    all: [],
    none: [],
    failureSummary: options.summary,
  };
}

export function a11yRule(
  id: string,
  nodes: axe.NodeResult[],
  impact?: axe.ImpactValue,
): axe.Result {
  return { description: "", help: `${id} の説明`, helpUrl: "", id, tags: [], nodes, impact };
}
