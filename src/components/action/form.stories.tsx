import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";

import { Button } from "@/components/ui/button";
import { createSettlingAction } from "@/test/settling-action";

import { CAUGHT_PREFIX, CaughtHere, silenceConsoleError } from "./catch-boundary.story-helpers";
import { ActionForm, ActionFormSubmit } from "./form";

/**
 * 決着しない Promise を story に置かない。Storybook の vitest 実行は 1 つの React root へ
 * story を描き替えるため、決着しない Transition が残ると後続 story が pending のまま
 * 止まる (ADR-0049)。pending 中の描画は `ActionButtonShell` の story が args だけで持つ。
 *
 * 決着の時点は play が `settling.settle()` で握る。仕組みと理由は
 * `src/test/settling-action.ts` が持つ。play は必ず決着させてから終える。
 */
const settling = createSettlingAction();
const settlingAction = fn(settling.impl);

const saveButton = () => screen.getByRole("button", { name: "保存" });

const meta = {
  component: ActionForm,
  args: {
    submitAction: settlingAction,
    children: <ActionFormSubmit>保存</ActionFormSubmit>,
  },
  // 開始時に持ち越しを捨て、終了時に全決着させる。play が途中で落ちても未決着を残さない
  beforeEach: settling.beforeEach,
} satisfies Meta<typeof ActionForm>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 待機していない状態。サイドバーに出る唯一の story なので、submit しても決着する action に
 * する。`settlingAction` のままだと play が無い分だけ誰も `settle()` を呼ばず、submit した
 * 人の画面で pending のまま戻らない (ADR-0049)
 */
export const Default: Story = { args: { submitAction: fn() } };

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

    settling.settle();
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
    settling.settle();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/**
 * `ActionFormSubmit` 以外の submit ボタンでも決着前の再 submit を呼ばない。
 * 素の submit ボタンは aria-disabled にならないので、form 側の isPending が塞ぐ
 */
export const PlainSubmitNotCalledTwice: Story = {
  tags: ["!dev"],
  args: {
    children: (
      <>
        <Button type="submit">保存</Button>
        {/* 素の submit ボタンは pending を DOM に出さない。`settle()` は Promise を解くだけで
            `handleSubmit` が読む isPending は再描画まで true のままなので、決着が描画へ
            届いたことを観測する口が要る。`ActionFormSubmit` を併置して aria-busy を借りる
            (カタログには出さない story なので、見た目への影響はない) */}
        <ActionFormSubmit>状態</ActionFormSubmit>
      </>
    ),
  },
  play: async ({ args }) => {
    const button = saveButton();
    const status = screen.getByRole("button", { name: "状態" });
    await userEvent.click(button);
    await expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await expect(args.submitAction).toHaveBeenCalledTimes(1);

    settling.settle();
    await waitFor(() => expect(status).not.toHaveAttribute("aria-busy", "true"));
    await userEvent.keyboard("{Enter}");
    await expect(args.submitAction).toHaveBeenCalledTimes(2);
    settling.settle();
  },
};

/** submitAction の reject は部品が握らず、最寄りの Error Boundary へ届く */
export const RejectReachesErrorBoundary: Story = {
  tags: ["!dev"],
  args: { submitAction: fn(() => Promise.reject(new Error("失敗"))) },
  render: (args) => (
    <CaughtHere>
      <ActionForm {...args} />
    </CaughtHere>
  ),
  play: async () => {
    // 失敗は click で起きるので、描画より前から黙らせる必要はない
    spyOn(console, "error").mockImplementation(() => {});
    await userEvent.click(saveButton());

    await expect(await screen.findByText(`${CAUGHT_PREFIX}失敗`)).toBeInTheDocument();
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
      await screen.findByText(`${CAUGHT_PREFIX}[ActionFormSubmit] ActionForm の中で使う`),
    ).toBeInTheDocument();
  },
};
