import { describe, expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/context";
import { render } from "vitest-browser-react";

import { Button } from "./button";
import { Input } from "./input";
import { Select, SelectTrigger, SelectValue } from "./select";
import { Toggle } from "./toggle";

// Chromium の native spinner の実効域。4〜12px 内側は無反応、20px 超はキャレット移動 (2026-08-06 実測)
const SPINNER_INSET_X = 16;

function expectElementReceivesPoint(element: Element, x: number, y: number) {
  const hit = document.elementFromPoint(x, y);
  expect(hit === element || (hit !== null && element.contains(hit))).toBe(true);
}

describe("touch target の AA 基準一本化 (ADR-0007)", () => {
  it("Button は疑似要素の拡大域を持たない", async () => {
    const screen = await render(<Button>保存</Button>);
    const button = screen.getByRole("button", { name: "保存" }).element();

    expect(getComputedStyle(button, "::before").content).toBe("none");
  });

  it("SelectTrigger は疑似要素の拡大域を持たない", async () => {
    const screen = await render(
      <Select items={{ apple: "りんご" }} defaultValue="apple">
        <SelectTrigger aria-label="果物">
          <SelectValue />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "果物" }).element();

    expect(getComputedStyle(trigger, "::before").content).toBe("none");
  });

  it("Toggle は消費側 className で size variant を上書きできる", async () => {
    const screen = await render(<Toggle className="h-7" aria-label="太字" />);

    expect(
      screen.getByRole("button", { name: "太字" }).element().getBoundingClientRect().height,
    ).toBe(28);
  });

  it("Input は視覚領域の中央で input 本体が pointer を受ける", async () => {
    const screen = await render(
      <div className="w-40 p-8">
        <Input aria-label="氏名" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "氏名" }).element();
    const rect = input.getBoundingClientRect();

    expectElementReceivesPoint(input, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  it("number Input は spinner 位置で input 本体が pointer を受ける", async () => {
    const screen = await render(
      <div className="w-40 p-8">
        <Input type="number" aria-label="件数" defaultValue="0" step={1} />
      </div>,
    );
    const input = screen.getByRole("spinbutton", { name: "件数" }).element();
    const rect = input.getBoundingClientRect();

    expectElementReceivesPoint(input, rect.right - SPINNER_INSET_X, rect.top + rect.height * 0.25);
  });

  it("number Input の上 spinner をクリックすると値が 1 増える", async () => {
    const screen = await render(
      <div className="w-40 p-8">
        <Input type="number" aria-label="件数" defaultValue="0" step={1} />
      </div>,
    );
    const element = screen.getByRole("spinbutton", { name: "件数" }).element();
    const rect = element.getBoundingClientRect();
    expect.assert(element instanceof HTMLInputElement, "spinbutton が input ではない");

    await userEvent.click(element, {
      position: { x: rect.width - SPINNER_INSET_X, y: rect.height * 0.25 },
    });

    expect(element.value).toBe("1");
  });

  // touch-manipulation は置かない (ADR-0007)。tap 遅延の除去は __root.tsx の viewport meta
  // (width=device-width) が担うため、registry 素のまま touch-action を上書きしない
  it("Input は touch-action の上書きを持たない", async () => {
    const screen = await render(<Input aria-label="氏名" />);
    const input = screen.getByRole("textbox", { name: "氏名" }).element();

    expect(getComputedStyle(input).touchAction).toBe("auto");
  });

  // InputGroup 内では InputGroupInput の flex-1 が幅を肩代わりするため、Combobox 側の
  // テストでは w-full 単独の喪失を検出できない。素の Input はここでしか守れない
  it("Input はコンテナ幅いっぱいに広がる", async () => {
    const screen = await render(
      <div style={{ width: 400 }}>
        <Input aria-label="氏名" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "氏名" }).element();

    expect(input.getBoundingClientRect().width).toBe(400);
  });
});
