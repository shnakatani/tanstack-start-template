import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { FullScreenNotice } from "@/components/parts/centered-card";
import { expectText } from "@/test/page-helpers";

/**
 * 状態のカタログは `centered-card.stories.tsx` が持つ (ADR-0049)。狭幅での余白も `Narrow`
 * story で見る。ここに残すのは、見出しが h1 であることだけで、story に play が無い
 * (args だけで状態が決まる部品) 以上ここでしか固定できない。
 *
 * 寸法 (`max-w-sm` / `min-h-[50vh]` / `p-6`) は測らない。値は Tailwind の定義そのもので、
 * どの variant が何を当てるかは cva と story が持つ。測っても Tailwind の定義を言い直すだけになる。
 * `data-slot="card-title"` の祖先確認も消した。その slot を選ぶ CSS は無く、JSX の入れ子を
 * DOM で言い直すだけだった。
 */
describe("FullScreenNotice", () => {
  // 見出しは CardTitle 内の h1 として組む (card.tsx は無改変。詳細は centered-card.tsx)
  it("見出しを h1 として描画し、説明と操作を伴う", async () => {
    const screen = await render(
      <FullScreenNotice title="通知の見出し" description="通知の説明文">
        <button type="button">操作</button>
      </FullScreenNotice>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "通知の見出し", level: 1 }))
      .toBeInTheDocument();
    await expectText(screen, "通知の説明文");
    await expect.element(screen.getByRole("button", { name: "操作" })).toBeInTheDocument();
  });
});
