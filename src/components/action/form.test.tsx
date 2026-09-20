import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { Button } from "@/components/ui/button";

import { ActionForm, ActionFormSubmit } from "./form";

/**
 * 振る舞いのカタログは `form.stories.tsx` の play が持つ (ADR-0022)。ここに残すのは
 * 決着前の二重発火を CDP 経由の実イベントで塞ぐ 2 case だけである。
 *
 * ADR-0022 は「ADR-0015 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま持ち、
 * play へは移さない」と決めている。play は Storybook の UI 上でも走るため CDP を使えず、
 * `storybook/test` の合成イベントで操作する。`ActionButton` の同じ規律は
 * `src/routes/notes/index.test.tsx` が `AlertDialogActionButton` 経由で持つが、
 * `ActionForm` と `ActionFormSubmit` にはその代わりが無い。
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
    expect(document.activeElement).toBe(button.element());
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
    expect(document.activeElement).toBe(button.element());
    await userEvent.keyboard("{Enter}");

    expect(submitAction).toHaveBeenCalledOnce();
    pending.resolve(undefined);
  });
});
