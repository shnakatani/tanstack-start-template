import { describe, expect, it } from "vite-plus/test";

import { viewportOverflows } from "./viewport-overflows";

const VIEWPORT = { width: 800, height: 600 };

function rect(edges: { top: number; left: number; width: number; height: number }) {
  return {
    ...edges,
    bottom: edges.top + edges.height,
    right: edges.left + edges.width,
  };
}

describe("viewportOverflows", () => {
  it("収まっていれば空", () => {
    expect(viewportOverflows(rect({ top: 10, left: 10, width: 50, height: 50 }), VIEWPORT)).toEqual(
      [],
    );
  });

  // 境界は含む。bottom = height ちょうどは収まっている
  it("辺が viewport の端に一致していれば収まっている", () => {
    expect(viewportOverflows(rect({ top: 0, left: 0, width: 800, height: 600 }), VIEWPORT)).toEqual(
      [],
    );
  });

  it.each([
    ["top", { top: -10, left: 10, width: 50, height: 50 }, "top -10px"],
    ["left", { top: 10, left: -10, width: 50, height: 50 }, "left -10px"],
    ["bottom", { top: 590, left: 10, width: 50, height: 50 }, "bottom +40px"],
    ["right", { top: 10, left: 790, width: 50, height: 50 }, "right +40px"],
  ])("%s にはみ出した辺と量を返す", (_edge, edges, expected) => {
    expect(viewportOverflows(rect(edges), VIEWPORT)).toEqual([expected]);
  });

  it("高さ 0 と幅 0 は「収まっている」と見なさない", () => {
    expect(viewportOverflows(rect({ top: 10, left: 10, width: 0, height: 0 }), VIEWPORT)).toEqual([
      "height 0",
      "width 0",
    ]);
  });

  it("複数の辺を同時に列挙する", () => {
    expect(
      viewportOverflows(rect({ top: -5, left: 10, width: 850, height: 50 }), VIEWPORT),
    ).toEqual(["top -5px", "right +60px"]);
  });
});
