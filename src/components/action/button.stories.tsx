import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CatchBoundary } from "@tanstack/react-router";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";

import { ActionButton } from "./button";

/**
 * 決着しない Promise を story に置かない。Storybook の vitest 実行は 1 つの React root へ
 * story を描き替えるため、決着しない Transition が残ると後続 story が pending のまま
 * 止まる (ADR-0022)。pending の外見は ActionButtonShell の story が args だけで持つ。
 *
 * 決着の時点は play が `settle()` で握る。実時間へ預けると、決着が 2 発目の操作より先に
 * 届いた回で偽 red になる (testing.md「optimistic update テストは遅延 rejection で中間状態を
 * 観測」)。play は必ず `settle()` を呼んでから終える。
 */
let pendingResolvers: Array<() => void> = [];
const settlingAction = fn(() => {
  // void を型引数に置くと no-invalid-void-type が落ちる。Promise<undefined> は
  // action の戻り値 Promise<void> へそのまま渡せる
  const { promise, resolve } = Promise.withResolvers<undefined>();
  pendingResolvers.push(() => {
    resolve(undefined);
  });
  return promise;
});

/** 未決着の Promise を全て決着させる。play の途中と、story の後始末の両方から呼ぶ */
function settle(): void {
  const resolvers = pendingResolvers;
  pendingResolvers = [];
  for (const resolve of resolvers) resolve();
}

const saveButton = () => screen.getByRole("button", { name: "保存" });

const meta = {
  component: ActionButton,
  args: { children: "保存", action: settlingAction },
  beforeEach: () => {
    settlingAction.mockClear();
    pendingResolvers = [];
    // play が途中で落ちても未決着の Promise を残さない。残すと後続 story の Transition と
    // 干渉し、退行 1 件が無関係な story まで赤にする (ADR-0022)
    return settle;
  },
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
    // 名前は pending でも変わらない
    await expect(button).toHaveAccessibleName("保存");
    // Spinner は視覚専用で accessibility API に出さない (ADR-0017)。ここだけ要素を直に
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

    settle();
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
    // aria-disabled が立つのを確かめる前にも 1 発送る。pending の描画を待ってからしか
    // 塞げないなら、実際の連打の速さでは通ってしまう
    await userEvent.keyboard("{Enter}");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{Enter}");

    await expect(args.action).toHaveBeenCalledTimes(1);
    await expect(button).toHaveFocus();
    settle();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
  },
};

/** 決着後は再び押せる */
export const CallableAgain: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    const button = saveButton();
    await userEvent.click(button);
    settle();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(button);

    await expect(args.action).toHaveBeenCalledTimes(2);
    settle();
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
