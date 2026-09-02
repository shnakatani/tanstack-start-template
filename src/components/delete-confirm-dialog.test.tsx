import type { MutateOptions, UseMutationResult } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { AlertDialogTrigger, createAlertDialogHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { dispatchNativeClick } from "@/test/native-click";
import { createTestQueryClient } from "@/test/page-helpers";

import {
  DeleteConfirmDialog,
  type DeleteTarget,
  deleteConfirmMutationProps,
} from "./delete-confirm-dialog";

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

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "削除" }).query()).toBeNull();
    });
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

  it("disabled=true のとき削除ボタンが無効になる", async () => {
    const { screen } = await renderWithTrigger({
      entityLabel: "ユーザー",
      onConfirm: vi.fn(),
      disabled: true,
    });

    await openDialog(screen);

    expect(screen.getByRole("button", { name: "削除" }).element().hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("disabled=false のとき削除ボタンが有効になる", async () => {
    const { screen } = await renderWithTrigger({
      entityLabel: "ユーザー",
      onConfirm: vi.fn(),
      disabled: false,
    });

    await openDialog(screen);

    expect(screen.getByRole("button", { name: "削除" }).element().hasAttribute("disabled")).toBe(
      false,
    );
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
});

describe("deleteConfirmMutationProps", () => {
  afterEach(() => vi.restoreAllMocks());

  function createDeleteMutation(
    isPending = false,
    onMutate?: (id: string, options?: MutateOptions<void, Error, string>) => void,
  ): Pick<UseMutationResult<void, Error, string>, "mutate" | "isPending"> {
    return {
      mutate: vi.fn((id: string, options?: MutateOptions<void, Error, string>) => {
        onMutate?.(id, options);
      }),
      isPending,
    };
  }

  /** 実 handle の close を spy する (helper は handle 全体を要求するため部分オブジェクトでは代用できない) */
  function createSpiedHandle() {
    const handle = createAlertDialogHandle<DeleteTarget>();
    const close = vi.spyOn(handle, "close").mockImplementation(() => {});
    return { handle, close };
  }

  it("mutate が成功したときだけ close する", () => {
    const { handle, close } = createSpiedHandle();
    let capturedId: string | undefined;
    let capturedOptions: MutateOptions<void, Error, string> | undefined;
    const mutation = createDeleteMutation(false, (id, options) => {
      capturedId = id;
      capturedOptions = options;
    });

    const props = deleteConfirmMutationProps(handle, mutation);
    props.onConfirm(TARGET);

    expect(props.handle).toBe(handle);
    expect(capturedId).toBe("w1");
    // mutate を呼んだ時点ではまだ閉じない
    expect(close).not.toHaveBeenCalled();
    // 成功コールバックが走って初めて閉じる
    // onSuccess の 4 引数は query-core の実シグネチャ (data, variables, onMutateResult, context)
    capturedOptions?.onSuccess?.(undefined, TARGET.id, undefined, {
      client: createTestQueryClient(),
      meta: undefined,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("失敗しても close を呼ばないのでダイアログを開いたままリトライできる", () => {
    const { handle, close } = createSpiedHandle();
    let calls = 0;
    const mutation = createDeleteMutation(false, (id, options) => {
      calls += 1;
      // 失敗した mutation でも onSettled は呼ばれる。二重発火ガードはここで解ける
      options?.onSettled?.(undefined, new Error("削除に失敗しました"), id, undefined, {
        client: createTestQueryClient(),
        meta: undefined,
      });
    });

    const props = deleteConfirmMutationProps(handle, mutation);
    props.onConfirm(TARGET);
    props.onConfirm(TARGET);

    // onSuccess を呼ばない = 失敗した場合。2 回目の確定も通る
    expect(close).not.toHaveBeenCalled();
    expect(calls).toBe(2);
  });

  // 確認ダイアログの「削除」は連打できる。isPending は次のレンダーまで false のままなので、
  // disabled では同じ tick の 2 回目を止められず、同じ id の削除が 2 回走る
  it("決着前の 2 回目の確定では mutate を呼ばない", () => {
    const { handle } = createSpiedHandle();
    const mutation = createDeleteMutation();

    const props = deleteConfirmMutationProps(handle, mutation);
    props.onConfirm(TARGET);
    props.onConfirm(TARGET);

    expect(mutation.mutate).toHaveBeenCalledExactlyOnceWith(TARGET.id, expect.anything());
  });

  it("isPending を disabled として透過する", () => {
    const { handle } = createSpiedHandle();

    expect(deleteConfirmMutationProps(handle, createDeleteMutation(true)).disabled).toBe(true);
    expect(deleteConfirmMutationProps(handle, createDeleteMutation(false)).disabled).toBe(false);
  });
});
