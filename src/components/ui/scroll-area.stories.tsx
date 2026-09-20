import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { ScrollArea } from "@/components/ui/scroll-area";

const LINES = Array.from({ length: 24 }, (_, index) => `${index + 1} 行目のテキスト`);

/**
 * ScrollArea も高さを持たず、器の寸法をなぞる。story から `className` は渡さず decorator で
 * 与える (`directory-structure.md`「コンポーネント配置」)。
 * スクロールバーと、そのぶんの余白は `ScrollArea` 自身が持つ (`styling.md`「spacing 基準」)
 */
const meta = {
  component: ScrollArea,
  decorators: [
    (Story) => (
      <div className="grid h-40 w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScrollArea>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 縦に溢れた状態。縦バーと右側の余白が出る */
export const Vertical: Story = {
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
