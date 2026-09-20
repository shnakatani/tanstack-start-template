import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CatchBoundary } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";

import { Button } from "@/components/ui/button";

import { ActionForm, ActionFormSubmit } from "./form";

/**
 * 決着しない Promise を story に置かない。Storybook の vitest 実行は 1 つの React root へ
 * story を描き替えるため、決着しない Transition が残ると後続 story が pending のまま
 * 止まる (ADR-0022)。pending 中の描画は `ActionButtonShell` の story が args だけで持つ。
 */
const SETTLING = 50;
const settles = () => new Promise<void>((resolve) => setTimeout(resolve, SETTLING));

const saveButton = () => screen.getByRole("button", { name: "保存" });

/** React が境界へ渡す前に出す console.error を、描画より前から黙らせる */
function silenceConsoleError() {
  const spy = spyOn(console, "error").mockImplementation(() => {});
  return () => {
    spy.mockRestore();
  };
}

function CaughtHere({ children }: { children: ReactNode }) {
  return (
    <CatchBoundary
      getResetKey={() => "story"}
      errorComponent={({ error }) => <p>境界で受けた: {error.message}</p>}
    >
      {children}
    </CatchBoundary>
  );
}

const meta = {
  component: ActionForm,
  args: {
    submitAction: fn(settles),
    children: <ActionFormSubmit>保存</ActionFormSubmit>,
  },
} satisfies Meta<typeof ActionForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 待機していない状態 */
export const Default: Story = {};

/** submit で submitAction を呼び、決着まで submit ボタンが pending になる */
export const Settles: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);

    await expect(args.submitAction).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    // native disabled にはしない (フォーカスを保つ)
    await expect(button).toHaveFocus();

    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy", "true"));
  },
};

/** 決着前の再 submit では submitAction を呼ばない */
export const NotCalledTwice: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");

    await expect(args.submitAction).toHaveBeenCalledTimes(1);
  },
};

/**
 * `ActionFormSubmit` 以外の submit ボタンでも決着前の再 submit を呼ばない。
 * 素の submit ボタンは aria-disabled にならないので、form 側の isPending が塞ぐ
 */
export const PlainSubmitNotCalledTwice: Story = {
  tags: ["!dev"],
  args: { children: <Button type="submit">保存</Button> },
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(args.submitAction).toHaveBeenCalledTimes(1);
  },
};

/** submitAction の reject は部品が握らず、最寄りの Error Boundary へ届く */
export const RejectReachesErrorBoundary: Story = {
  tags: ["!dev"],
  args: { submitAction: fn(() => Promise.reject(new Error("失敗"))) },
  beforeEach: silenceConsoleError,
  render: (args) => (
    <CaughtHere>
      <ActionForm {...args} />
    </CaughtHere>
  ),
  play: async () => {
    await userEvent.click(saveButton());

    await expect(await screen.findByText("境界で受けた: 失敗")).toBeInTheDocument();
  },
};

/** `ActionFormSubmit` を `ActionForm` の外で使うと throw する (レンダー中の throw) */
export const SubmitOutsideForm: Story = {
  tags: ["!dev"],
  beforeEach: silenceConsoleError,
  render: () => (
    <CaughtHere>
      <ActionFormSubmit>保存</ActionFormSubmit>
    </CaughtHere>
  ),
  play: async () => {
    await expect(
      await screen.findByText("境界で受けた: [ActionFormSubmit] ActionForm の中で使う"),
    ).toBeInTheDocument();
  },
};
