import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";

import { PendingLabel } from "./pending-label";

/**
 * 状態のカタログは `pending-label.stories.tsx` が持つ (docs/guides/storybook.md「カタログと play の範囲」)。
 * ここに残すのは、pending の前後でボタンの幅が変わらないこと (2 回の観測の比較。registry の size の目盛りは
 * pin しない) と、Spinner が accessibility tree に出ないことで、args だけで状態が決まる部品なので story に
 * play が無く、ここでしか固定できない。
 */
describe("PendingLabel", () => {
  it("pending にしてもボタンの幅は label のまま", async () => {
    const screen = await render(
      <div className="flex gap-2">
        <Button size="sm" aria-label="idle">
          <PendingLabel isPending={false}>編集</PendingLabel>
        </Button>
        <Button size="sm" aria-label="pending">
          <PendingLabel isPending>編集</PendingLabel>
        </Button>
      </div>,
    );
    const idle = screen.getByRole("button", { name: "idle" });
    const pending = screen.getByRole("button", { name: "pending" });
    await expect.element(pending.getBySlot("spinner")).toBeInTheDocument();
    const widthIdle = idle.element().getBoundingClientRect().width;

    // Spinner を label の横に並べると Spinner と gap の分だけ広がり、label を `data-icon` で詰めると padding の分だけ縮む
    await expect
      .poll(() => pending.element().getBoundingClientRect().width)
      .toBeCloseTo(widthIdle, 0);
  });

  it("Spinner は視覚専用で、accessibility tree に出さない (ADR-0026)", async () => {
    const screen = await render(
      <Button aria-label="保存">
        <PendingLabel isPending>保存</PendingLabel>
      </Button>,
    );

    // 名前は aria-label が持つので、Spinner の `role="status"` が露出しても名前には出ない。属性で見る
    await expect
      .element(screen.getByRole("button", { name: "保存" }).getBySlot("spinner"))
      .toHaveAttribute("aria-hidden", "true");
  });
});
