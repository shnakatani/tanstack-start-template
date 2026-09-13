import { CatchBoundary } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "@/test/a11y";
import { deferred } from "@/test/deferred";
import { dispatchNativeClick } from "@/test/native-click";

import { ActionButton } from "./button";

describe("ActionButton", () => {
  afterEach(() => vi.restoreAllMocks());

  it("クリックで action を呼び、決着まで pending 表示と aria-disabled になる", async () => {
    const pending = deferred<undefined>();
    const action = vi.fn(() => pending.promise);
    const screen = await render(<ActionButton action={action}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存", exact: true });

    await button.click();

    expect(action).toHaveBeenCalledOnce();
    await expect.element(screen.getByRole("status", { name: "処理中" })).toBeInTheDocument();
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    // native disabled にはしない (フォーカスを保つ)
    expect(button.element().hasAttribute("disabled")).toBe(false);

    pending.resolve(undefined);

    await vi.waitFor(() => {
      expect(screen.getByRole("status", { name: "処理中" }).query()).toBeNull();
    });
    // 非 pending で無効化されていないことだけを見る (属性を常に付けるかは Base UI の出力形式)
    await expect.element(button).not.toHaveAttribute("aria-disabled", "true");
  });

  it("pending 中もフォーカスと accessible name がボタンに残る", async () => {
    const pending = deferred<undefined>();
    const screen = await render(<ActionButton action={() => pending.promise}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存", exact: true });

    await button.click();
    await expect.element(button).toHaveAttribute("aria-disabled", "true");

    // exact: true で掴めている = status の文言が名前に混ざっていない
    expect(document.activeElement).toBe(button.element());
    pending.resolve(undefined);
  });

  it("決着前の再クリックでは action を呼ばない (isPending が立つ前を含む)", async () => {
    const pending = deferred<undefined>();
    const action = vi.fn(() => pending.promise);
    const screen = await render(<ActionButton action={action}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存", exact: true });

    // 同期に 2 回発火させ、再レンダー (isPending=true) より前の 2 回目を塞ぐことを固定する
    dispatchNativeClick(button.element());
    dispatchNativeClick(button.element());
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    // 再レンダー後の 3 回目は Base UI が aria-disabled で止める
    dispatchNativeClick(button.element());

    expect(action).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });

  it("決着後は再びクリックできる", async () => {
    const action = vi.fn(() => Promise.resolve());
    const screen = await render(<ActionButton action={action}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存", exact: true });

    await button.click();
    await expect.element(button).not.toHaveAttribute("aria-disabled", "true");
    await button.click();

    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledTimes(2);
    });
  });

  it("action の reject は部品が握らず、最寄りの Error Boundary へ届く", async () => {
    // React が boundary へ渡す前に console.error を出す。出力を汚さない
    vi.spyOn(console, "error").mockImplementation(() => {});
    const screen = await render(
      <CatchBoundary
        getResetKey={() => "test"}
        errorComponent={({ error }) => <p>境界で受けた: {error.message}</p>}
      >
        <ActionButton action={() => Promise.reject(new Error("失敗"))}>実行</ActionButton>
      </CatchBoundary>,
    );

    await screen.getByRole("button", { name: "実行", exact: true }).click();

    await expect.element(screen.getByText("境界で受けた: 失敗")).toBeInTheDocument();
  });

  it("form の中でも既定では submit しない (type=button)", async () => {
    const onSubmit = vi.fn((e: React.SubmitEvent<HTMLFormElement>) => e.preventDefault());
    const screen = await render(
      <form onSubmit={onSubmit}>
        <ActionButton action={() => Promise.resolve()}>実行</ActionButton>
      </form>,
    );

    await screen.getByRole("button", { name: "実行", exact: true }).click();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pendingLabel で status の名前を差し替えられる", async () => {
    const pending = deferred<undefined>();
    const screen = await render(
      <ActionButton action={() => pending.promise} pendingLabel="保存中">
        保存
      </ActionButton>,
    );

    await screen.getByRole("button", { name: "保存", exact: true }).click();

    await expect.element(screen.getByRole("status", { name: "保存中" })).toBeInTheDocument();
    pending.resolve(undefined);
  });

  it("aria-label を渡した部品はその名前になる", async () => {
    const screen = await render(
      <ActionButton action={() => Promise.resolve()} aria-label="メモを削除">
        削除
      </ActionButton>,
    );

    expect(screen.getByRole("button", { name: "メモを削除", exact: true }).query()).not.toBeNull();
  });

  it("pending 中の描画に a11y 違反が無い", async () => {
    const pending = deferred<undefined>();
    const screen = await render(<ActionButton action={() => pending.promise}>保存</ActionButton>);

    await screen.getByRole("button", { name: "保存", exact: true }).click();
    await expect.element(screen.getByRole("status", { name: "処理中" })).toBeInTheDocument();

    await expectNoA11yViolations(document.body);
    pending.resolve(undefined);
  });
});
