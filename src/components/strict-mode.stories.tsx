import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, fn } from "storybook/test";

/**
 * story が `.storybook/preview.tsx` の decorator で StrictMode の下に描かれていることを確かめる (ADR-0039)。
 * StrictMode は state の初期化関数を mount 時に 2 回呼ぶ。描き直しでは呼ばないので、回数が描き直しで揺れない
 */
function StrictModeProbe({ onInitState }: { onInitState: () => void }) {
  useState(onInitState);
  return <p>StrictMode を確かめる</p>;
}

const meta = {
  component: StrictModeProbe,
  tags: ["!dev"],
  args: { onInitState: fn() },
} satisfies Meta<typeof StrictModeProbe>;

export default meta;

export const CallsStateInitializerTwice: StoryObj<typeof meta> = {
  play: async ({ args, canvas }) => {
    await canvas.findByText("StrictMode を確かめる");
    await expect(args.onInitState).toHaveBeenCalledTimes(2);
  },
};
