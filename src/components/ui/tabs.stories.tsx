import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, userEvent } from "storybook/test";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const meta = {
  component: Tabs,
  args: { defaultValue: "all" },
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="all">すべて</TabsTrigger>
        <TabsTrigger value="draft">下書き</TabsTrigger>
        <TabsTrigger value="archived">アーカイブ</TabsTrigger>
      </TabsList>
      <TabsContent value="all">すべてのメモ</TabsContent>
      <TabsContent value="draft">下書きのメモ</TabsContent>
      <TabsContent value="archived">アーカイブしたメモ</TabsContent>
    </Tabs>
  ),
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。先頭のタブが開いている */
export const Default: Story = {};

/** 別のタブを選んだ状態から始める */
export const OtherTabSelected: Story = { args: { defaultValue: "archived" } };

/** 縦並び */
export const Vertical: Story = { args: { orientation: "vertical" } };

/**
 * `TabsList` の `line`。下線だけで区切る意匠。既定は Default が持つ
 */
export const LineList: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList variant="line">
        <TabsTrigger value="all">すべて</TabsTrigger>
        <TabsTrigger value="draft">下書き</TabsTrigger>
      </TabsList>
      <TabsContent value="all">すべてのメモ</TabsContent>
      <TabsContent value="draft">下書きのメモ</TabsContent>
    </Tabs>
  ),
};

/**
 * 切り替えたところ。選ぶまでを play が持ち、その先の操作は書かない (ADR-0053)。
 * 終了状態は OtherTabSelected と同じ見た目なのでカタログには出さない
 */
export const Switched: Story = {
  tags: ["!dev"],
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "下書き" }));
    await expect(await canvas.findByText("下書きのメモ")).toBeInTheDocument();
  },
};
