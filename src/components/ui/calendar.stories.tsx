import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Calendar } from "@/components/ui/calendar";

/**
 * カタログを時計で動かさないよう、月と「今日」を固定する。`defaultMonth` だけでは
 * `today` modifier が実時計を読み続け、月が変わると強調の位置が消える
 */
const MONTH = new Date(2026, 8, 1);
const TODAY = new Date(2026, 8, 20);

/**
 * 見出しと、渡したセレクタを axe の対象から外す `parameters`。
 *
 * 見出しを外すのは、registry 素の nav が `absolute inset-x-0 top-0` で見出しへ重なり、axe が
 * 背景を決められないため (bgOverlap)。原因は部品の構造なので meta へ置き、出ない story だけが
 * 例外を書く。nav は透明なので実際の配色は変わらない。ルールごと切らずに要素で外すのは、
 * 日付セルの色の検査を残すため (`docs/guides/accessibility.md`「story で出た違反を抑制する」)。
 *
 * 上流へは未起票 (2026-09-21 に shadcn-ui/ui を検索して該当なし)。投げるなら shadcn-ui/ui。
 * 外せるのは registry baseline の差分で nav の位置指定が変わったとき (ADR-0027)
 */
function excludeFromA11y(...selectors: readonly string[]) {
  return { a11y: { context: { exclude: [".rdp-caption_label", ...selectors] } } };
}

const meta = {
  component: Calendar,
  args: { mode: "single", defaultMonth: MONTH, today: TODAY },
  parameters: excludeFromA11y(),
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。1 日だけ選ぶ */
export const Single: Story = {
  args: { selected: new Date(2026, 8, 18) },
};

/** 期間を選ぶ */
export const Range: Story = {
  args: {
    mode: "range",
    selected: { from: new Date(2026, 8, 14), to: new Date(2026, 8, 20) },
  },
  // 期間の両端も registry 素。`after:w-4 after:bg-muted` の擬似要素で隣のセルへ橋を架けており、
  // axe は一定以上の面積を持つ擬似要素があると背景の判定を打ち切る (pseudoContent)。
  // 両端は `bg-primary` / `text-primary-foreground` で、`range_middle` の
  // `bg-muted` / `text-foreground` とは別の対である。この対は `Single` と `Multiple` の
  // 選択セル (`data-selected-single`) が検査し続ける。上流へは未起票 (shadcn-ui/ui)
  parameters: excludeFromA11y('[data-range-start="true"]', '[data-range-end="true"]'),
};

/** 複数の日を選ぶ */
export const Multiple: Story = {
  args: {
    mode: "multiple",
    selected: [new Date(2026, 8, 3), new Date(2026, 8, 11), new Date(2026, 8, 25)],
  },
};

/**
 * 月と年をドロップダウンで選べる形。年の範囲を明示しないと
 * `today` から前 100 年で組まれ、選択肢が毎年 1 つ増える
 */
export const WithDropdownCaption: Story = {
  // この形では見出しに incomplete が出ないので、meta の除外を打ち消す (2026-09-21 に実測。
  // nav の絶対配置は同じままなので、重なっても解決できる理由までは確かめていない)
  parameters: { a11y: { context: { exclude: [] } } },
  args: {
    captionLayout: "dropdown",
    startMonth: new Date(2020, 0, 1),
    endMonth: new Date(2030, 11, 31),
  },
};

/** 選べない日を持つ形 */
export const WithDisabledDays: Story = {
  args: { disabled: { before: new Date(2026, 8, 10) } },
};
