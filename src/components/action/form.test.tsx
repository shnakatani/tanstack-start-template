import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { expectNoA11yViolations } from "@/test/a11y";
import { dispatchNativeClick } from "@/test/native-click";
import { CAUGHT_PREFIX, renderInCatchBoundary } from "@/test/render-in-catch-boundary";

import { ActionForm, ActionFormSubmit } from "./form";

describe("ActionForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("submit で submitAction を呼び、決着まで submit ボタンが pending になる", async () => {
    const pending = Promise.withResolvers<undefined>();
    const submitAction = vi.fn(() => pending.promise);
    const screen = await render(
      <ActionForm submitAction={submitAction}>
        <ActionFormSubmit pendingLabel="保存中">保存</ActionFormSubmit>
      </ActionForm>,
    );
    const button = screen.getByRole("button", { name: "保存", exact: true });

    await button.click();

    expect(submitAction).toHaveBeenCalledOnce();
    await expect.element(screen.getByRole("status", { name: "保存中" })).toBeInTheDocument();
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(button.element());

    pending.resolve(undefined);
    await vi.waitFor(() => {
      expect(screen.getByRole("status", { name: "保存中" }).query()).toBeNull();
    });
  });

  it("決着前の再 submit では submitAction を呼ばない", async () => {
    const pending = Promise.withResolvers<undefined>();
    const submitAction = vi.fn(() => pending.promise);
    const screen = await render(
      <ActionForm submitAction={submitAction}>
        <ActionFormSubmit>保存</ActionFormSubmit>
      </ActionForm>,
    );
    const element = screen.getByRole("button", { name: "保存", exact: true }).element();

    dispatchNativeClick(element);
    dispatchNativeClick(element);

    expect(submitAction).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });

  it("submitAction の reject は部品が握らず、最寄りの Error Boundary へ届く", async () => {
    const screen = await renderInCatchBoundary(
      <ActionForm submitAction={() => Promise.reject(new Error("失敗"))}>
        <ActionFormSubmit>保存</ActionFormSubmit>
      </ActionForm>,
    );

    await screen.getByRole("button", { name: "保存", exact: true }).click();

    await expect.element(screen.getByText(`${CAUGHT_PREFIX}失敗`)).toBeInTheDocument();
  });

  it("ActionFormSubmit を ActionForm の外で使うと throw する", async () => {
    // render は act で包まれ、レンダー中の throw は reject として返る
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<ActionFormSubmit>保存</ActionFormSubmit>)).rejects.toThrow(
      "[ActionFormSubmit] ActionForm の中で使う",
    );
  });

  it("pending 中の描画に a11y 違反が無い", async () => {
    const pending = Promise.withResolvers<undefined>();
    const screen = await render(
      <ActionForm submitAction={() => pending.promise}>
        <ActionFormSubmit>保存</ActionFormSubmit>
      </ActionForm>,
    );

    await screen.getByRole("button", { name: "保存", exact: true }).click();
    await expect.element(screen.getByRole("status", { name: "処理中" })).toBeInTheDocument();

    await expectNoA11yViolations(document.body);
    pending.resolve(undefined);
  });
});
