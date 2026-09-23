import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { ScrollArea } from "@/components/ui/scroll-area";

const LINES = Array.from({ length: 24 }, (_, index) => `${index + 1} 行目のテキスト`);

/**
 * ScrollArea も高さを持たず、器の寸法をなぞる。この story は寸法を `className` で渡さず、
 * decorator の器で与える (layout の class なら渡してもよい。`docs/guides/storybook.md`「story を書く」)。器の寸法に従ってスクロールする
 * ことを見せるため、器を ScrollArea の外に置く。
 * スクロールバーと、そのぶんの余白は `ScrollArea` 自身が持つ (ADR-0027)
 */
const meta = {
  component: ScrollArea,
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 器を固定寸法にする decorator。meta には置かない。Storybook は story の decorator を
 * meta の decorator と合成するので、meta へ置くと器を持たない story
 * (`SizedByViewportClassName`) 側から外せない
 */
const boxed: NonNullable<Story["decorators"]> = [
  (Story) => (
    <div className="grid h-40 w-64">
      <Story />
    </div>
  ),
];

/** 縦に溢れた状態。縦バーと右側の余白が出る */
export const Vertical: Story = {
  decorators: boxed,
  render: () => (
    <ScrollArea>
      <div className="flex flex-col gap-1 p-2 text-sm">
        {LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </ScrollArea>
  ),
};

/** 両方向に溢れた状態。横バーと下側の余白も出る */
export const Both: Story = {
  decorators: boxed,
  render: () => (
    <ScrollArea>
      <div className="flex w-96 flex-col gap-1 p-2 text-sm">
        {LINES.map((line) => (
          <span key={line} className="whitespace-nowrap">
            {line} — 横にも溢れるだけの長さを持たせた行
          </span>
        ))}
      </div>
    </ScrollArea>
  ),
};

/** 溢れていない状態。バーも余白も出ない */
export const Fits: Story = {
  decorators: boxed,
  render: () => (
    <ScrollArea>
      <div className="flex flex-col gap-1 p-2 text-sm">
        {LINES.slice(0, 3).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </ScrollArea>
  ),
};

/**
 * 高さを `viewportClassName` で与える形。消費側 (`parts/code-block.tsx` /
 * `parts/dialog-scroll-body.tsx`) はこちらを使う。`viewportClassName` は Viewport へ
 * layout class を通すためにこのリポジトリが足した prop (ADR-0027 の乖離)
 */
export const SizedByViewportClassName: Story = {
  render: () => (
    <ScrollArea viewportClassName="max-h-40 w-64">
      <div className="flex flex-col gap-1 p-2 text-sm">
        {LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </ScrollArea>
  ),
};
