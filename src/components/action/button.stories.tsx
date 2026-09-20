import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CatchBoundary } from "@tanstack/react-router";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";

import { ActionButton } from "./button";

/**
 * 決着しない Promise を story に置かない。Storybook の vitest 実行は 1 つの React root へ
 * story を描き替えるため、決着しない Transition が残ると後続 story が pending のまま
 * 止まる (ADR-0022)。pending の外見は ActionButtonShell の story が args だけで持つ。
 */
const SETTLING = 50;
const settles = () => new Promise<void>((resolve) => setTimeout(resolve, SETTLING));

const saveButton = () => screen.getByRole("button", { name: "保存" });

const meta = {
  component: ActionButton,
  args: { children: "保存", action: fn(settles) },
} satisfies Meta<typeof ActionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 待機していない状態 */
export const Default: Story = {};

/** 押すと決着まで pending になり、決着すると戻る */
export const Settles: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);

    await expect(args.action).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    // Spinner は視覚専用で accessibility API に出さない (ADR-0017)
    await expect(button.querySelector('[data-slot="spinner"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // native disabled にはしない (フォーカスを保つ)
    await expect(button).not.toHaveAttribute("disabled");
    await expect(button).toHaveFocus();

    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy", "true"));
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
  },
};

/** 決着前の再操作では呼ばない */
export const NotCalledTwice: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");

    await expect(args.action).toHaveBeenCalledTimes(1);
  },
};

/** 決着後は再び押せる */
export const CallableAgain: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(button);

    await expect(args.action).toHaveBeenCalledTimes(2);
  },
};

/** form の中でも既定では submit しない (type=button) */
const formSubmit = fn();

export const InForm: Story = {
  tags: ["!dev"],
  args: { children: "実行" },
  beforeEach: () => {
    formSubmit.mockClear();
  },
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        formSubmit();
      }}
    >
      <ActionButton {...args} />
    </form>
  ),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "実行" }));

    await expect(formSubmit).not.toHaveBeenCalled();
  },
};

/** aria-label を渡すとその名前になる */
export const WithAriaLabel: Story = {
  tags: ["!dev"],
  args: { children: "削除", "aria-label": "メモを削除" },
  play: async () => {
    await expect(screen.getByRole("button", { name: "メモを削除" })).toBeInTheDocument();
  },
};

/** action の reject は部品が握らず、最寄りの Error Boundary へ届く */
export const RejectReachesErrorBoundary: Story = {
  tags: ["!dev"],
  args: { children: "実行", action: fn(() => Promise.reject(new Error("失敗"))) },
  render: (args) => (
    <CatchBoundary
      getResetKey={() => "story"}
      errorComponent={({ error }) => <p>境界で受けた: {error.message}</p>}
    >
      <ActionButton {...args} />
    </CatchBoundary>
  ),
  play: async () => {
    // React は境界へ渡す前に console.error を出す。出力を汚さないため黙らせる
    spyOn(console, "error").mockImplementation(() => {});
    await userEvent.click(screen.getByRole("button", { name: "実行" }));

    await expect(await screen.findByText("境界で受けた: 失敗")).toBeInTheDocument();
  },
};
