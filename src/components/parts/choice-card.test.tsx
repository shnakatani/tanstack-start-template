import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Badge } from "@/components/ui/badge";

import { ChoiceCard, ChoiceCardList } from "./choice-card";

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const rows = [
    { id: "a", label: "チームA" },
    { id: "b", label: "チームB" },
  ];
  return (
    <ChoiceCardList>
      {rows.map((row) => (
        <ChoiceCard
          key={row.id}
          id={row.id}
          label={row.label}
          checked={checked.has(row.id)}
          disabled={disabled}
          trailing={row.id === "a" ? <Badge variant="secondary">管理者</Badge> : undefined}
          onCheckedChange={(next) => {
            const draft = new Set(checked);
            if (next) draft.add(row.id);
            else draft.delete(row.id);
            setChecked(draft);
          }}
        />
      ))}
    </ChoiceCardList>
  );
}

/**
 * 行のトグルと id の紐づきは `choice-card.stories.tsx` の play が持ち、trailing の位置・
 * 行間・disabled の見え方 (cursor / data-disabled) は同 story の状態カタログで見る (ADR-0046)。
 * ここに残すのは、Playwright の actionability を force で飛ばす実イベントが要る 2 件だけ
 * (有効な行で click が届く対照と、disabled の行)。
 *
 * 寸法は測らない。行間の `gap-2` は Tailwind の定義そのもので、測っても Tailwind の定義を言い直すだけになる。
 */
describe("ChoiceCard", () => {
  // 同じ force click が有効な行では届いてトグルすることを先に固定する (肯定の対照)。これが無いと
  // 下の disabled のテストは click が届かなくても緑になる (ADR-0043)
  it("有効な行は label の force click でトグルする", async () => {
    const screen = await render(<Harness />);

    await screen.getByText("チームA").click({ force: true });

    await expect
      .element(screen.getByRole("checkbox", { name: /チームA/ }))
      .toHaveAttribute("data-checked");
  });

  it("disabled の行はクリックしてもトグルせず、押せると主張しない", async () => {
    const screen = await render(<Harness disabled />);
    const checkbox = screen.getByRole("checkbox", { name: /チームA/ });

    // disabled な checkbox と対の label なので actionability の enabled 判定に落ちる。
    // 対象に pointer-events: none が無く click は実際に届くため force で検査だけ飛ばす (ADR-0039)
    await screen.getByText("チームA").click({ force: true });

    await expect.element(checkbox).not.toHaveAttribute("data-checked");
    // Base UI の Checkbox は native disabled を隠し input に持ち、露出する span には
    // aria-disabled が付く。「押せると主張しない」は ARIA で見る。支援技術に届くのは span の
    // aria-disabled で、隠し input の disabled は accessibility tree に出ない
    await expect.element(checkbox).toHaveAttribute("aria-disabled", "true");
  });
});
