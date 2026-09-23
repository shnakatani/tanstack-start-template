import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ActionButton } from "./button";

/**
 * 振る舞いのカタログは `button.stories.tsx` の play が持つ (ADR-0044)。ここに残すのは
 * 決着前の二重発火を CDP 経由の実イベントで塞ぐ 1 case だけである。
 *
 * ADR-0050 は「ADR-0037 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま
 * 持ち、play へは移さない」と決めている。play は Storybook の UI 上でも走るため CDP を
 * 使えず、`storybook/test` の合成イベントで操作する。
 *
 * 画面側のテスト (削除確認の Enter 2 連射) はこの guard を代替しない。画面の `confirmDelete` は
 * `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の
 * 時点で `isPending` は false になる。画面側のテストが固定しているのは
 * `queryClient.isMutating` による dedupe で、`disabled={isPending}` を外しても落ちない
 * (2026-09-20 に mutant で実測)。
 */
describe("ActionButton", () => {
  it("決着前の再クリックでは action を呼ばない", async () => {
    const pending = Promise.withResolvers<undefined>();
    const action = vi.fn(() => pending.promise);
    const screen = await render(<ActionButton action={action}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存", exact: true });

    // 実イベント (CDP 経由) で 3 回発火する。2 回目は次のユーザーイベント、
    // 3 回目は aria-disabled を確認した後
    await button.click();
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect.element(button).toHaveAttribute("aria-disabled", "true");
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(action).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });
});
