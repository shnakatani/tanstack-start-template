import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { CodeBlock } from "@/components/parts/code-block";

/**
 * 状態のカタログは `code-block.stories.tsx` が持つ (ADR-0022)。ここに残すのは 2 種類ある。
 *
 * 器が伸びず内部でスクロールすることは寸法の実測なので play へ移せない (節 5)。
 * `Overflowing` story は溢れた見た目を並べるだけで、器の高さは見ていない。内容を pre で
 * 描くことは、story に play が無い以上ここでしか固定できない (節 7 の役割分担)。
 */
describe("CodeBlock", () => {
  it("内容を pre として描画する", async () => {
    const screen = await render(<CodeBlock>{"line 1\nline 2"}</CodeBlock>);

    const text = screen.getByText(/line 1/).element();
    expect(text.closest("pre")).not.toBeNull();
  });

  it("内容が高いときは器の中で縦スクロールし、器自体は伸びない", async () => {
    const long = Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n");
    const screen = await render(<CodeBlock>{long}</CodeBlock>);

    const text = screen.getByText(/line 0/).element();
    const viewport = text.closest('[data-slot="scroll-area-viewport"]');
    expect.assert(viewport !== null, "ScrollArea の viewport が見つかりません");
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
  });
});
