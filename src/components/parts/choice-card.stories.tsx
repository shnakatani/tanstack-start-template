import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, screen, userEvent } from "storybook/test";

import { Badge } from "@/components/ui/badge";

import { ChoiceCard, ChoiceCardList } from "./choice-card";

/** 1 行目にだけ trailing を置く。タイトルと checkbox の間に入る位置が見える */
const ROWS = [
  { id: "a", label: "チームA" },
  { id: "b", label: "チームB" },
] as const;

interface StoryArgs {
  /** 初期の選択 */
  checkedIds: readonly string[];
  disabled: boolean;
  /** false なら id を渡さず `ChoiceCard` の内部採番に任せる */
  withId: boolean;
}

function Harness({ checkedIds, disabled, withId }: StoryArgs) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(checkedIds));

  return (
    <ChoiceCardList>
      {ROWS.map((row) => (
        <ChoiceCard
          key={row.id}
          id={withId ? row.id : undefined}
          label={row.label}
          checked={checked.has(row.id)}
          disabled={disabled}
          trailing={row.id === "a" ? <Badge variant="secondary">管理者</Badge> : undefined}
          onCheckedChange={(next) => {
            setChecked((current) => {
              const draft = new Set(current);
              if (next) {
                draft.add(row.id);
              } else {
                draft.delete(row.id);
              }
              return draft;
            });
          }}
        />
      ))}
    </ChoiceCardList>
  );
}

const meta = {
  title: "parts/ChoiceCard",
  // checkedIds は useState の初期値にしか効かないため、control で変えたら remount して反映する
  render: (args) => <Harness key={args.checkedIds.join(",")} {...args} />,
  args: { checkedIds: [], disabled: false, withId: true },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 未選択の 2 行 */
export const Default: Story = {};

/** 選択済みの行 */
export const Checked: Story = { args: { checkedIds: ["a"] } };

/** disabled の行。押せると主張しない (cursor は既定のまま) */
export const Disabled: Story = { args: { disabled: true, checkedIds: ["a"] } };

/** 行のクリックで checkbox がトグルする (ラベルと id で紐づく) */
export const TogglesOnRowClick: Story = {
  tags: ["!dev"],
  play: async () => {
    const checkbox = screen.getByRole("checkbox", { name: "チームB" });
    await expect(checkbox).not.toHaveAttribute("data-checked");

    await userEvent.click(screen.getByText("チームB"));

    await expect(checkbox).toHaveAttribute("data-checked");
  },
};

/**
 * id を渡さなくても htmlFor で紐づき、行どうしで衝突しない。
 * base-ui は id を隠しの input へ載せ、role="checkbox" の要素には別 ID を振るので、
 * htmlFor の相手は input 側になる (`getByLabelText` が解決できることがその証明)
 */
export const GeneratedId: Story = {
  tags: ["!dev"],
  args: { withId: false },
  play: async ({ canvasElement }) => {
    // FieldTitle も data-slot="field-label" を持つため、カードは label 要素で掴む
    const labels = [...canvasElement.querySelectorAll<HTMLLabelElement>("label[for]")];
    await expect(labels).toHaveLength(2);
    await expect(labels.map((label) => label.control?.tagName)).toEqual(["INPUT", "INPUT"]);
    await expect(new Set(labels.map((label) => label.htmlFor)).size).toBe(2);

    // 2 行目のラベルを押しても 1 行目は連動しない
    await userEvent.click(screen.getByText("チームB"));

    await expect(screen.getByRole("checkbox", { name: "チームB" })).toHaveAttribute("data-checked");
    await expect(screen.getByRole("checkbox", { name: /チームA/ })).not.toHaveAttribute(
      "data-checked",
    );
  },
};
