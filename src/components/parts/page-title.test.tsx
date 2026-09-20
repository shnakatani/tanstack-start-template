import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { CardPageTitle } from "@/components/parts/page-title";
import { CardTitle } from "@/components/ui/card";

/**
 * 状態のカタログは `page-title.stories.tsx` が持つ (ADR-0022)。ここに残すのは 2 種類ある。
 *
 * tone による色の差と registry 既定の `CardTitle` との大小関係は `getComputedStyle` の
 * 実測なので play へ移せない (節 5)。`data-slot=card-title` の維持は、story に play が
 * 無い以上ここでしか固定できない (節 7 の役割分担)。
 */
describe("CardPageTitle", () => {
  it("tone=destructive は既定と違う色で描く", async () => {
    const screen = await render(
      <>
        <CardPageTitle>
          <h1>既定の見出し</h1>
        </CardPageTitle>
        <CardPageTitle tone="destructive">
          <h2>破壊的な見出し</h2>
        </CardPageTitle>
      </>,
    );

    const plain = screen.getByRole("heading", { name: "既定の見出し" }).element();
    const destructive = screen.getByRole("heading", { name: "破壊的な見出し" }).element();

    expect(getComputedStyle(plain).color).not.toBe(getComputedStyle(destructive).color);
  });

  it("registry のスタイル経路を保つため data-slot=card-title を残す", async () => {
    const screen = await render(
      <CardPageTitle>
        <h1>見出し</h1>
      </CardPageTitle>,
    );

    const heading = screen.getByRole("heading", { name: "見出し", level: 1 }).element();
    expect(heading.closest('[data-slot="card-title"]')).not.toBeNull();
  });

  // 寸法は Tailwind のスケール値 (18px / 600 等) を直接固定せず、styling.md の typography 階層が
  // 定める「ページ見出し > セクション見出し (registry 既定の CardTitle)」の大小関係で固定する
  it("registry 既定の CardTitle より大きく太い", async () => {
    const screen = await render(
      <>
        <CardTitle>
          <h2>registry の既定</h2>
        </CardTitle>
        <CardPageTitle>
          <h2>ページの見出し</h2>
        </CardPageTitle>
      </>,
    );

    const base = getComputedStyle(
      screen.getByRole("heading", { name: "registry の既定" }).element(),
    );
    const page = getComputedStyle(
      screen.getByRole("heading", { name: "ページの見出し" }).element(),
    );

    expect(parseFloat(page.fontSize)).toBeGreaterThan(parseFloat(base.fontSize));
    expect(Number(page.fontWeight)).toBeGreaterThan(Number(base.fontWeight));
  });
});
