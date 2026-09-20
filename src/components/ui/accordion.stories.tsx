import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, userEvent, within } from "storybook/test";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  { value: "shipping", title: "配送について", body: "注文の翌営業日に発送します" },
  { value: "return", title: "返品について", body: "到着から 7 日以内に連絡してください" },
];

const meta = {
  component: Accordion,
  render: (args) => (
    <Accordion {...args}>
      {ITEMS.map((item) => (
        <AccordionItem key={item.value} value={item.value}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent>{item.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  ),
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。見出しだけが並ぶ */
export const Collapsed: Story = {};

/**
 * 開いた状態。portal を使わないので `canvas` で取れる。
 * 開く操作までを play が持ち、開いた先の操作は書かない (ADR-0022)
 */
export const Expanded: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "配送について" }));
    await expect(await canvas.findByText("注文の翌営業日に発送します")).toBeInTheDocument();
  },
};

/** 既定値で開いた状態から始める */
export const DefaultOpen: Story = {
  args: { defaultValue: ["return"] },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText("到着から 7 日以内に連絡してください"),
    ).toBeInTheDocument();
  },
};
