import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { AlertDialogTrigger, createAlertDialogHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { dispatchNativeClick } from "@/test/native-click";

import { DeleteConfirmDialog, type DeleteTarget } from "./delete-confirm-dialog";

const TARGET: DeleteTarget = { id: "w1", name: "田中太郎" };

type DialogProps = Omit<React.ComponentProps<typeof DeleteConfirmDialog>, "handle">;

/**
 * Trigger と Root を handle で結んだ最小構成。handle はテストごとに作る
 * (共有すると Root が使い回されてテスト間で状態が漏れる)。
 */
async function renderWithTrigger(props: DialogProps, target: DeleteTarget = TARGET) {
  const handle = createAlertDialogHandle<DeleteTarget>();
  const screen = await render(
    <>
      <AlertDialogTrigger handle={handle} payload={target} render={<Button />}>
        開く
      </AlertDialogTrigger>
      <DeleteConfirmDialog handle={handle} {...props} />
    </>,
  );
  return { screen, handle };
}

async function openDialog(screen: Awaited<ReturnType<typeof render>>): Promise<void> {
  await screen.getByRole("button", { name: "開く" }).click();
  await vi.waitFor(() => {
    expect(screen.getByRole("button", { name: "削除" }).query()).not.toBeNull();
  });
}

describe("DeleteConfirmDialog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Trigger で開くとタイトルと payload 由来の説明文が表示される", async () => {
    const { screen } = await renderWithTrigger({ entityLabel: "ユーザー", onConfirm: vi.fn() });

    await openDialog(screen);

    expect(screen.getByText("ユーザーの削除").query()).not.toBeNull();
    expect(
      screen.getByText("「田中太郎」を削除しますか？この操作は取り消せません。").query(),
    ).not.toBeNull();
  });

  it("開く前はダイアログが表示されない", async () => {
    const { screen } = await renderWithTrigger({ entityLabel: "ユーザー", onConfirm: vi.fn() });

    expect(screen.getByText("ユーザーの削除").query()).toBeNull();
  });

  it("削除ボタンをクリックすると payload を伴って onConfirm が呼ばれる", async () => {
    const onConfirm = vi.fn();
    const { screen } = await renderWithTrigger({ entityLabel: "ユーザー", onConfirm });

    await openDialog(screen);
    dispatchNativeClick(screen.getByRole("button", { name: "削除" }).element());

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(TARGET);
  });

  it("キャンセルボタンをクリックするとダイアログが閉じる", async () => {
    const { screen } = await renderWithTrigger({ entityLabel: "ユーザー", onConfirm: vi.fn() });

    await openDialog(screen);
    dispatchNativeClick(screen.getByRole("button", { name: "キャンセル" }).element());

    await expect.element(screen.getByRole("button", { name: "削除" })).not.toBeInTheDocument();
  });

  it("entityLabel と payload の name が表示に反映される", async () => {
    const { screen } = await renderWithTrigger(
      { entityLabel: "タグ", onConfirm: vi.fn() },
      { id: "v1", name: "重要" },
    );

    await openDialog(screen);

    expect(screen.getByText("タグの削除").query()).not.toBeNull();
    expect(
      screen.getByText("「重要」を削除しますか？この操作は取り消せません。").query(),
    ).not.toBeNull();
  });

  it("description を指定すると payload の name を受け取って既定文言を上書きする", async () => {
    const { screen } = await renderWithTrigger({
      entityLabel: "メモ",
      onConfirm: vi.fn(),
      description: (name: string) => `「${name}」と紐づくタグをまとめて削除しますか？`,
    });

    await openDialog(screen);

    expect(
      screen.getByText("「田中太郎」と紐づくタグをまとめて削除しますか？").query(),
    ).not.toBeNull();
    expect(
      screen.getByText("「田中太郎」を削除しますか？この操作は取り消せません。").query(),
    ).toBeNull();
  });

  it("payload なしで開かれた場合は warn して onConfirm を呼ばない", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onConfirm = vi.fn();
    const handle = createAlertDialogHandle<DeleteTarget>();
    const screen = await render(
      <DeleteConfirmDialog handle={handle} entityLabel="ユーザー" onConfirm={onConfirm} />,
    );
    // Trigger を介さない imperative open では payload が入らない
    handle.open(null);
    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "削除" }).query()).not.toBeNull();
    });

    dispatchNativeClick(screen.getByRole("button", { name: "削除" }).element());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[DeleteConfirmDialog] confirm clicked with no payload", {
      entityLabel: "ユーザー",
    });
  });

  it("onConfirm の決着まで削除ボタンが pending になり、決着すると戻る", async () => {
    const pending = Promise.withResolvers<undefined>();
    const onConfirm = vi.fn(() => pending.promise);
    const { screen } = await renderWithTrigger({ entityLabel: "ユーザー", onConfirm });
    await openDialog(screen);

    // バックドロップ越しなのでキーボードで活性化する (testing.md「クリックの発火方法」の順 2)
    const confirmButton = screen.getByRole("button", { name: "削除", exact: true });
    confirmButton.element().focus();
    await userEvent.keyboard("{Enter}");

    // pending は要素自身の aria-busy / aria-disabled で持つ (ADR-0017)
    await expect.element(confirmButton).toHaveAttribute("aria-busy", "true");
    await expect.element(confirmButton).toHaveAttribute("aria-disabled", "true");

    pending.resolve(undefined);
    await expect.element(confirmButton).not.toHaveAttribute("aria-busy", "true");
  });

  // 撤去した deleteConfirmMutationProps の閉包フラグの後継。dedupe は Action 層が持つが、
  // ダイアログ経由 (payload の受け渡しを挟む) でも効くことをここで固定する
  it("決着前の 2 回目の確定では onConfirm を呼ばない", async () => {
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    const { screen } = await renderWithTrigger({ entityLabel: "ユーザー", onConfirm });
    await openDialog(screen);
    const element = screen.getByRole("button", { name: "削除", exact: true }).element();

    // 実イベント (CDP 経由) で 2 回発火する (バックドロップが pointer を遮るためキーボードで)
    element.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(TARGET);
  });
});
