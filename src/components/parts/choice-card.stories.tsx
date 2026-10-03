import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, screen, userEvent } from "storybook/test";

import { Badge } from "@/components/ui/badge";
import { FieldLegend, FieldSet } from "@/components/ui/field";

import { ChoiceCard, ChoiceCardList } from "./choice-card";

/** チームA の行にだけ trailing を置く。タイトルと checkbox の間に入る位置が見える */
const ROWS = [
  { id: "a", label: "チームA", description: "開発と運用を担当する" },
  { id: "b", label: "チームB", description: "問い合わせに対応する" },
] as const;

interface StoryArgs {
  /** 初期の選択 */
  checkedIds: readonly string[];
  disabled: boolean;
  /** false なら id を渡さず `ChoiceCard` の内部採番に任せる */
  withId: boolean;
  /** true なら行ごとに説明文を添える */
  withDescription: boolean;
}

function Harness({ checkedIds, disabled, withId, withDescription }: StoryArgs) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(checkedIds));

  return (
    <FieldSet>
      <FieldLegend variant="label">担当するチーム</FieldLegend>
      <ChoiceCardList>
        {ROWS.map((row) => (
          <ChoiceCard
            key={row.id}
            id={withId ? row.id : undefined}
            label={row.label}
            description={withDescription ? row.description : undefined}
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
    </FieldSet>
  );
}

const meta = {
  // checkedIds は useState の初期値にしか効かないため、control で変えたら remount して反映する
  render: (args) => <Harness key={args.checkedIds.join(",")} {...args} />,
  args: { checkedIds: [], disabled: false, withId: true, withDescription: false },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 未選択の 2 行 */
export const Default: Story = {};

/** 選択済みの行 */
export const Checked: Story = { args: { checkedIds: ["a"] } };

/** disabled の行。押せると主張しない (cursor は既定のまま) */
export const Disabled: Story = { args: { disabled: true, checkedIds: ["a"] } };

/**
 * 説明文を添えた行。名前はタイトルだけにし、説明文と trailing は checkbox の説明として読ませる。
 * label の中の説明文は、結ばないと名前にも入る (docs/guides/forms-and-inputs.md「Choice Card の名前と説明を分ける理由」)
 */
export const WithDescription: Story = {
  args: { withDescription: true },
  play: async ({ canvas }) => {
    const teamA = canvas.getByRole("checkbox", { name: "チームA" });
    await expect(teamA).toHaveAccessibleName("チームA");
    await expect(teamA).toHaveAccessibleDescription("開発と運用を担当する 管理者");

    const teamB = canvas.getByRole("checkbox", { name: "チームB" });
    await expect(teamB).toHaveAccessibleName("チームB");
    await expect(teamB).toHaveAccessibleDescription("問い合わせに対応する");
  },
};

/** 説明文が無く trailing だけの行でも、trailing は名前に入れず説明として読ませる */
export const TrailingWithoutDescription: Story = {
  tags: ["!dev"],
  play: async ({ canvas }) => {
    const teamA = canvas.getByRole("checkbox", { name: "チームA" });
    await expect(teamA).toHaveAccessibleName("チームA");
    await expect(teamA).toHaveAccessibleDescription("管理者");
  },
};

/** 行のクリックで checkbox がトグルする (ラベルと id で紐づく) */
export const TogglesOnRowClick: Story = {
  tags: ["!dev"],
  play: async () => {
    const checkbox = screen.getByRole("checkbox", { name: "チームB" });
    await expect(checkbox).not.toBeChecked();

    await userEvent.click(screen.getByText("チームB"));

    await expect(checkbox).toBeChecked();
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

    // チームB のラベルを押してもチームA は連動しない
    await userEvent.click(screen.getByText("チームB"));

    await expect(screen.getByRole("checkbox", { name: "チームB" })).toBeChecked();
    await expect(screen.getByRole("checkbox", { name: "チームA" })).not.toBeChecked();
  },
};
