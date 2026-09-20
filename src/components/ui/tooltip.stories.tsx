import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { InfoIcon } from "lucide-react";
import { expect, screen } from "storybook/test";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function TooltipExample({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="補足" />}>
          <InfoIcon />
        </TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const meta = {
  component: Tooltip,
  render: () => <TooltipExample text="公開すると一覧に並びます" />,
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 閉じた状態。トリガーだけが見える */
export const Closed: Story = {
  play: async () => {
    await expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  },
};

/**
 * 開いた状態。portal へ出るので `screen` から取る。
 * 開くのは hover ではなく focus で行う。pointer の hover は base-ui の開閉ヒューリスティクスに
 * 委ねられ、自動操作では安定して開かない (`src/components/ui/sidebar.test.tsx` と同じ手)。
 * `TooltipProvider` の `delay` は registry 既定で 0 なので待ちを足さない
 */
export const Opened: Story = {
  play: async () => {
    screen.getByRole("button", { name: "補足" }).focus();
    await expect(await screen.findByText("公開すると一覧に並びます")).toBeInTheDocument();
  },
};
