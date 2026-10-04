import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";

/** story が `.storybook/preview.tsx` の decorator で StrictMode の下に描かれていることを確かめる (ADR-0039) */
function RenderCounter({ onRender }: { onRender: () => void }) {
  onRender();
  return <p>描画を数える</p>;
}

const meta = {
  component: RenderCounter,
  tags: ["!dev"],
  args: { onRender: fn() },
} satisfies Meta<typeof RenderCounter>;

export default meta;

export const RendersTwiceOnMount: StoryObj<typeof meta> = {
  play: async ({ args, canvas }) => {
    await canvas.findByText("描画を数える");
    await expect(args.onRender).toHaveBeenCalledTimes(2);
  },
};
