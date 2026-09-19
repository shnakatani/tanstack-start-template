import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { CodeBlock } from "./code-block";

const STACK_TRACE = `Error: ページを表示できませんでした
    at loadNotesPageData (src/routes/notes/index.tsx:12)
    at Object.loader (src/routes/notes/index.tsx:24)`;

const meta = {
  component: CodeBlock,
  args: { children: STACK_TRACE },
} satisfies Meta<typeof CodeBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 内容が高さの上限を超えると器の中で縦スクロールし、器自体は伸びない */
export const Overflowing: Story = {
  args: {
    children: Array.from(
      { length: 60 },
      (_, i) => `    at frame${i} (src/lib/example.ts:${i})`,
    ).join("\n"),
  },
};
