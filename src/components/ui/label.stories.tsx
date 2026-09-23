import type { Meta, StoryObj } from "@storybook/tanstack-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta = {
  component: Label,
  args: { children: "メモのタイトル", htmlFor: "note-title" },
  // 単体の label は結び付く control が無いと意味を持たないので、対になる input と並べて描く。
  // 器は decorator で外側に当てる (ADR-0047)
  render: (args) => (
    <>
      <Label {...args} />
      <Input id="note-title" placeholder="タイトルを入力" />
    </>
  ),
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。`htmlFor` で input と結ぶ */
export const Default: Story = {};
