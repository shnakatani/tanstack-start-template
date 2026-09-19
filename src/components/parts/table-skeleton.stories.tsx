import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { TableSkeleton } from "./table-skeleton";

const meta = {
  component: TableSkeleton,
  args: { columns: 4 },
  parameters: {
    a11y: {
      config: {
        // 列見出しに文言が無いため axe が empty-table-header を出すが、この th は
        // role="status" を載せた table の子で columnheader として露出しておらず、
        // sr-only を足すと live region が「読み込み中」を列数ぶん重ねて読む。
        // 本体の扱いは #36 で決める。それまでこの story でだけ止める
        rules: [{ id: "empty-table-header", enabled: false }],
      },
    },
  },
} satisfies Meta<typeof TableSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
