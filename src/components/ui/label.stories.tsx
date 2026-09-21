import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta = {
  component: Label,
  args: { children: "メモのタイトル", htmlFor: "note-title" },
  // 単体の label は結び付く control が無いと意味を持たないので、対になる input と並べて描く。
  // 器は decorator で外側に当てる (`directory-structure.md`「コンポーネント配置」)
  render: (args) => (
    <>
      <Label {...args} />
      <Input id="note-title" placeholder="タイトルを入力" />
    </>
  ),
  decorators: [
    // p-2 は見た目の都合ではない。Label は registry 素の leading-none を持ち、グリフの矩形が
    // 行ボックスより上下 1px はみ出す。vitest 経由の story は canvas の padding
    // (Storybook の既定 layout: "padded") が当たらないまま原点へ描かれるので、余白が無いと
    // その 1px が背景を持つ body の外へ出て、axe が色を測れなくなる
    (Story) => (
      <div className="flex flex-col gap-2 p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。`htmlFor` で input と結ぶ */
export const Default: Story = {};
