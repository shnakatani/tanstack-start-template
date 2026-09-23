import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Input } from "./input";

/**
 * touch target の AA 基準一本化 (ADR-0036)。視覚 = ヒット = registry 素寸法。
 *
 * 寸法・疑似要素の不在・touch-action の既定は規範と ADR が持ち、機械で見ない
 * (ADR-0036「寸法は機械で見ない」。疑似要素の拡大は registry の sidebar 自身が
 * `after:-inset-2` で持つため、部品ごとの不在確認は一貫した保証にならない)。
 * `type="number"` の spinner は NumberField を採る決定 (ADR-0027) により対象外。
 *
 * ここに残すのは pointer が input 本体に届くこと。Playwright の click は hit-target の検査を
 * 通すので、包む要素や疑似要素が pointer を奪えば click 自体が落ちる (ADR-0045)。
 */
describe("touch target の AA 基準一本化 (ADR-0036)", () => {
  it("Input は視覚領域の中央で input 本体が pointer を受ける", async () => {
    const screen = await render(
      <div className="w-40 p-8">
        <Input aria-label="氏名" />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "氏名" });

    await input.click();
    await expect.element(input).toHaveFocus();
  });

  // touch-manipulation は置かない (ADR-0036)。tap 遅延の除去は __root.tsx の viewport meta
  // (width=device-width) が担うため、registry 素のまま touch-action を上書きしない
  it("Input は touch-action の上書きを持たない", async () => {
    const screen = await render(<Input aria-label="氏名" />);
    await expect
      .element(screen.getByRole("textbox", { name: "氏名" }))
      .toHaveStyle("touch-action: auto");
  });
});
