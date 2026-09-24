import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";

import { ActionForm, ActionFormSubmit } from "./form";

/**
 * 振る舞いのカタログは `form.stories.tsx` の play が持つ (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは
 * 決着前の二重発火を CDP 経由の実イベントで塞ぐ 2 case だけである。
 *
 * 実イベントでの発火の規律 (docs/guides/testing/user-interactions.md「クリックを発火する」) はブラウザテスト側が持ち、play へは移さない
 * (docs/guides/storybook.md「story とブラウザテストの分担」)。play は Storybook の UI 上でも走るため CDP を使えず、
 * `storybook/test` の合成イベントで操作する。`ActionButton` の同じ規律は
 * `src/components/action/button.test.tsx` が持つ。画面側のテストは Action 層の guard を
 * 代替しない (理由は docs/guides/storybook.md「story とブラウザテストの分担」)。
 */
describe("ActionForm", () => {
  it("決着前の再 submit では submitAction を呼ばない", async () => {
    const pending = Promise.withResolvers<undefined>();
    const submitAction = vi.fn(() => pending.promise);
    const screen = await render(
      <ActionForm submitAction={submitAction}>
        <ActionFormSubmit>保存</ActionFormSubmit>
      </ActionForm>,
    );
    const button = screen.getByRole("button", { name: "保存", exact: true });

    // 実イベント (CDP 経由) で 2 回発火する
    await button.click();
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(submitAction).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });

  it("ActionFormSubmit 以外の submit ボタンでも決着前の再 submit では submitAction を呼ばない", async () => {
    const pending = Promise.withResolvers<undefined>();
    const submitAction = vi.fn(() => pending.promise);
    const screen = await render(
      <ActionForm submitAction={submitAction}>
        <Button type="submit">保存</Button>
      </ActionForm>,
    );
    const button = screen.getByRole("button", { name: "保存", exact: true });

    // 素の submit ボタンは aria-disabled にならないので、form 側の isPending が塞ぐ
    await button.click();
    await expect.element(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(submitAction).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });
});
