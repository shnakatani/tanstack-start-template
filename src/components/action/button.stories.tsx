import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";

import { createSettlingAction } from "@/test/settling-action";

import { ActionButton } from "./button";
import { CAUGHT_PREFIX, CaughtHere, silenceConsoleError } from "./catch-boundary.story-helpers";

/**
 * 決着しない Promise を story に置かない。Storybook の vitest 実行は 1 つの React root へ
 * story を描き替えるため、決着しない Transition が残ると後続 story が pending のまま
 * 止まる (docs/guides/storybook.md「story を書く」)。pending の外見は ActionButtonShell の story が args だけで持つ。
 *
 * 決着の時点は play が `settling.settle()` で握る。仕組みと理由は
 * `src/test/settling-action.ts` が持つ。play は必ず決着させてから終える。
 */
const settling = createSettlingAction();
const settlingAction = fn(settling.impl);

const saveButton = () => screen.getByRole("button", { name: "保存" });

const meta = {
  component: ActionButton,
  args: { children: "保存", action: settlingAction },
  // 開始時に持ち越しを捨て、終了時に全決着させる。play が途中で落ちても未決着を残さない
  beforeEach: settling.beforeEach,
} satisfies Meta<typeof ActionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * 待機していない状態。サイドバーに出る唯一の story なので、押しても決着する action にする。
 * `settlingAction` のままだと play が無い分だけ誰も `settle()` を呼ばず、押した人の画面で
 * pending のまま戻らない (docs/guides/storybook.md「story を書く」)
 */
export const Default: Story = { args: { action: fn() } };

/** 押すと決着まで pending になり、決着すると戻る */
export const Settles: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);

    await expect(args.action).toHaveBeenCalledTimes(1);
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    // 名前は pending でも変わらない
    await expect(button).toHaveAccessibleName("保存");
    // Spinner は視覚専用で accessibility API に出さない (ADR-0026)。ここだけ要素を直に
    // 掴むのは、aria-labelledby が名前を固定しているため aria-hidden を外しても
    // accessibility tree に差が出ないからである (2026-09-20 に mutant で実測)
    await expect(button.querySelector('[data-slot="spinner"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    // native disabled にはしない (フォーカスを保つ)。toBeEnabled は aria-disabled を見ないので、
    // aria-disabled が立っていても native disabled でなければ通る
    await expect(button).toBeEnabled();
    await expect(button).toHaveFocus();

    settling.settle();
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
    // storybook/test の操作は各手順を await するので、ここに来た時点で pending は描画済み
    // (docs/guides/storybook.md「story とブラウザテストの分担」)。この story が固定するのは、描画された guard が再操作を塞ぐことだけ。
    // 描画が間に合わない速さの連打は play では起こせず、実イベントでの検証は
    // src/components/action/button.test.tsx が持つ
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");

    await expect(args.action).toHaveBeenCalledTimes(1);
    await expect(button).toHaveFocus();
    settling.settle();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/** 決着後は再び押せる */
export const CallableAgain: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);
    settling.settle();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(button);

    await expect(args.action).toHaveBeenCalledTimes(2);
    settling.settle();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/** form の中でも既定では submit しない (type=button) */
const formSubmit = fn();

export const InForm: Story = {
  tags: ["!dev"],
  // pending を見ない story なので即時決着にする。settlingAction のままだと、決着しない
  // Transition を残したまま次の story へ移る
  args: { children: "実行", action: fn() },
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
    <CaughtHere>
      <ActionButton {...args} />
    </CaughtHere>
  ),
  play: async () => {
    silenceConsoleError();
    await userEvent.click(screen.getByRole("button", { name: "実行" }));

    await expect(await screen.findByText(`${CAUGHT_PREFIX}失敗`)).toBeInTheDocument();
  },
};
