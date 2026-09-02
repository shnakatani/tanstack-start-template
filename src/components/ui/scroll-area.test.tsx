import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * registry は `{children}` を `ScrollArea.Viewport` へ直接置き、base-ui の
 * `ScrollArea.Content` を使っていない (shadcn-ui/ui#10534)。Content は ResizeObserver で
 * 内容の寸法変化を拾い thumb と overflow 判定を再計算するパートで、上流 base-ui は
 * 「期待される構造は Root > Viewport > Content」と回答している (mui/base-ui#4696、CLOSED)。
 *
 * viewport の高さが内容に追随する `max-h-*` では viewport 自身の resize が再計算を誘発する
 * ため差が出ない。高さが固定される使い方 (`h-*` や flex で伸びた領域) で顕在化する。
 */
function Harness() {
  const [many, setMany] = useState(true);
  const rows = Array.from({ length: many ? 30 : 2 }, (_, i) => `行 ${i + 1}`);
  return (
    <div data-testid="scroll-area-harness">
      <button type="button" onClick={() => setMany(false)}>
        減らす
      </button>
      {/* 内容が縮んでも viewport は縮まない = 再計算のきっかけが Content しかない */}
      <ScrollArea viewportClassName="h-24">
        {rows.map((row) => (
          <p key={row}>{row}</p>
        ))}
      </ScrollArea>
    </div>
  );
}

describe("ScrollArea", () => {
  it("高さ固定の領域で内容が縮んだとき overflow 判定が更新される", async () => {
    const screen = await render(<Harness />);
    // 溢れが解消するとスクロールバーごと unmount されるため、都度引き直す
    const wrap = screen.getByTestId("scroll-area-harness").element();
    const hasOverflow = () =>
      wrap
        .querySelector('[data-slot="scroll-area-viewport"]')
        ?.hasAttribute("data-has-overflow-y") ?? null;

    expect(hasOverflow()).toBe(true);

    await screen.getByRole("button", { name: "減らす" }).click();

    // ユーザーがスクロールしなくても再計算される (Content の ResizeObserver 経由)
    await expect.poll(hasOverflow, { timeout: 2000 }).toBe(false);
  });
});
