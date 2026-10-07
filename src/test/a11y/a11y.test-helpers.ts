import type axe from "axe-core";

// axe の結果を組み立てるフィクスチャ。`a11y*.test.ts` が共有する。

function a11yCheck(): axe.CheckResult {
  return {
    id: "color-contrast",
    impact: "serious",
    message: "",
    data: null,
    relatedNodes: [],
  };
}

/** `target` は frame を跨ぐと要素が増えるので (`axe.d.ts` の `NodeResult`)、配列のまま受ける */
export function a11yNode(
  options: {
    target?: axe.UnlabelledFrameSelector;
    summary?: string;
  } = {},
): axe.NodeResult {
  return {
    html: "<p></p>",
    target: options.target ?? ["p"],
    any: [a11yCheck()],
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
