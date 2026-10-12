import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { ActionButton } from "./button";

/**
 * 振る舞いのカタログは `button.stories.tsx` の play が持つ (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは
 * 決着前の二重発火を CDP 経由の実イベントで塞ぐ 1 case と、pending の前後で幅と名前が変わらない 1 case である。
 *
 * 実イベントでの発火の規律 (docs/guides/testing/user-interactions.md「クリックを発火する」) はブラウザテスト側が持ち、play へは移さない
 * (docs/guides/storybook.md「story とブラウザテストの分担」)。play は Storybook の UI 上でも走るため CDP を
 * 使えず、`storybook/test` の合成イベントで操作する。
 *
 * 画面側のテスト (削除確認の Enter 2 連射) はこの guard を代替しない。画面の `confirmDelete` は
 * `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の
 * 時点で `isPending` は false になる。画面側のテストが固定しているのは
 * `queryClient.isMutating` による dedupe で、`disabled={isPending}` を外しても落ちない
 * (2026-09-20 に mutant で実測)。
 *
 * 幅は pending の前後の 2 回の観測を比べる。registry の size の目盛りは pin しない (`button-link.test.tsx` の
 * 「寸法は測らない」と同じ理由)。story の play は `storybook/test` の合成イベントで操作し、矩形を比べる
 * assert を持たないので、幅の退行はここでしか固定できない。
 */
describe("ActionButton", () => {
  it("pending の間も幅と名前を保つ (ADR-0042)", async () => {
    const pending = Promise.withResolvers<undefined>();
    const screen = await render(<ActionButton action={() => pending.promise}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存" });
    await expect.element(button).toBeInTheDocument();
    const widthBefore = button.element().getBoundingClientRect().width;

    await button.click();

    await expect.element(button).toBeDisabled();
    // label を不可視にして Spinner を重ねるので、名前は aria-labelledby が保つ。外れると空になる
    await expect.element(button).toHaveAccessibleName("保存");
    // Spinner を label の横に並べると、Spinner と gap の分だけ広がる
    await expect
      .poll(() => button.element().getBoundingClientRect().width)
      .toBeCloseTo(widthBefore, 0);
    pending.resolve(undefined);
  });

  it("決着前の再クリックでは action を呼ばない", async () => {
    const pending = Promise.withResolvers<undefined>();
    const action = vi.fn(() => pending.promise);
    const screen = await render(<ActionButton action={action}>保存</ActionButton>);
    const button = screen.getByRole("button", { name: "保存" });

    // 実イベント (CDP 経由) で 3 回発火する。2 回目は次のユーザーイベント、
    // 3 回目は無効を確認した後
    await button.click();
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(action).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });
});
