import { useState } from "react";
import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { Badge } from "@/components/ui/badge";
import { dispatchNativeClick } from "@/test/native-click";

import { ChoiceCard, ChoiceCardList } from "./choice-card";

function Harness({
  disabled = false,
  withoutId = false,
}: {
  disabled?: boolean;
  withoutId?: boolean;
}) {
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
          id={withoutId ? undefined : row.id}
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

describe("ChoiceCard", () => {
  it("行のクリックで checkbox がトグルする（ラベルと id で紐づく）", async () => {
    const screen = await render(<Harness />);
    const checkbox = screen.getByRole("checkbox", { name: /チームB/ });

    expect(checkbox.element().getAttribute("data-checked")).toBeNull();
    await screen.getByText("チームB").click();
    expect(checkbox.element().getAttribute("data-checked")).not.toBeNull();
  });

  it("trailing はタイトルと checkbox の間に置かれる", async () => {
    const screen = await render(<Harness />);
    const title = screen.getByText("チームA").element();
    const trailing = screen.getByText("管理者").element();
    const checkbox = screen.getByRole("checkbox", { name: /チームA/ }).element();

    expect(trailing.getBoundingClientRect().left).toBeGreaterThan(
      title.getBoundingClientRect().left,
    );
    expect(trailing.getBoundingClientRect().right).toBeLessThanOrEqual(
      checkbox.getBoundingClientRect().left,
    );
  });

  // shadcn の正典が示す checkbox グループの例示値から 1 段詰めた行間 (choice-card.tsx 参照)
  it("行間が 8px になる", async () => {
    const screen = await render(<Harness />);
    // FieldTitle も data-slot="field-label" を持つため、カードは label 要素で掴む
    const first = screen.getByText("チームA").element().closest("label");
    const second = screen.getByText("チームB").element().closest("label");
    if (!first || !second) throw new Error("Choice Card が見つからない");

    expect(
      Math.round(second.getBoundingClientRect().top - first.getBoundingClientRect().bottom),
    ).toBe(8);
  });

  it("disabled の行はクリックしてもトグルせず、押せると主張しない", async () => {
    const screen = await render(<Harness disabled />);
    const checkbox = screen.getByRole("checkbox", { name: /チームA/ }).element();
    const label = screen.getByText("チームA").element().closest("label");
    const field = screen.getByText("チームA").element().closest('[data-slot="field"]');
    if (!label || !field) throw new Error("Choice Card が見つからない");

    // Playwright の actionability が disabled 由来で click をタイムアウトさせるため、
    // label テキストへ直接 click イベントを送る
    dispatchNativeClick(screen.getByText("チームA").element());

    expect(checkbox.getAttribute("data-checked")).toBeNull();
    expect(getComputedStyle(label).cursor).toBe("default");
    expect(field.getAttribute("data-disabled")).not.toBeNull();
  });

  // id は htmlFor と checkbox の紐づけにしか使わないため、消費側は省略できる。
  // base-ui は id を隠しの input へ載せ、role="checkbox" の span には別 ID を振るので、
  // htmlFor の相手は input 側
  it("id を渡さなくても htmlFor で紐づき、行どうしで衝突しない", async () => {
    const screen = await render(<Harness withoutId />);
    const firstLabel = screen.getByText("チームA").element().closest("label");
    const secondLabel = screen.getByText("チームB").element().closest("label");
    if (!firstLabel || !secondLabel) throw new Error("Choice Card が見つからない");
    const firstInput = firstLabel.querySelector("input");
    const secondInput = secondLabel.querySelector("input");
    if (!firstInput || !secondInput) throw new Error("checkbox の input が見つからない");

    expect(firstLabel.getAttribute("for")).toBe(firstInput.id);
    expect(secondLabel.getAttribute("for")).toBe(secondInput.id);
    expect(firstInput.id).not.toBe(secondInput.id);

    // 2 行目のラベルを押しても 1 行目は連動しない
    await screen.getByText("チームB").click();
    expect(
      screen
        .getByRole("checkbox", { name: /チームB/ })
        .element()
        .getAttribute("data-checked"),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("checkbox", { name: /チームA/ })
        .element()
        .getAttribute("data-checked"),
    ).toBeNull();
  });

  it("マウス環境でも 44px 以上の tap target になる", async () => {
    const screen = await render(<Harness />);
    const label = screen.getByText("チームA").element().closest("label");
    if (!label) throw new Error("Choice Card が見つからない");

    expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});
