import { afterEach, describe, expect, it } from "vite-plus/test";

import { expectWithinViewport } from "@/test/viewport";

const created: Element[] = [];

function appendFixedBox(style: Partial<CSSStyleDeclaration>): Element {
  const box = document.createElement("div");
  Object.assign(box.style, { position: "fixed", width: "50px", height: "50px" }, style);
  document.body.append(box);
  created.push(box);
  return box;
}

afterEach(() => {
  for (const element of created.splice(0)) element.remove();
});

describe("expectWithinViewport", () => {
  it("viewport 内に収まる要素は通過する", () => {
    const box = appendFixedBox({ top: "10px", left: "10px" });

    expect(() => expectWithinViewport(box)).not.toThrow();
  });

  it("下にはみ出す要素で失敗する", () => {
    const box = appendFixedBox({ top: `${window.innerHeight - 10}px`, left: "10px" });

    expect(() => expectWithinViewport(box)).toThrow("rect.bottom");
  });

  it("上にはみ出す要素で失敗する", () => {
    const box = appendFixedBox({ top: "-10px", left: "10px" });

    expect(() => expectWithinViewport(box)).toThrow("rect.top");
  });

  it("右にはみ出す要素で失敗する", () => {
    const box = appendFixedBox({ top: "10px", left: `${window.innerWidth - 10}px` });

    expect(() => expectWithinViewport(box)).toThrow("rect.right");
  });

  it("左にはみ出す要素で失敗する", () => {
    const box = appendFixedBox({ top: "10px", left: "-10px" });

    expect(() => expectWithinViewport(box)).toThrow("rect.left");
  });

  it("高さ 0 に潰れた要素は「収まっている」と見なさない", () => {
    const box = appendFixedBox({ top: "10px", left: "10px", height: "0px" });

    expect(() => expectWithinViewport(box)).toThrow("rect.height");
  });

  it("幅 0 に潰れた要素は「収まっている」と見なさない", () => {
    const box = appendFixedBox({ top: "10px", left: "10px", width: "0px" });

    expect(() => expectWithinViewport(box)).toThrow("rect.width");
  });
});
