import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";
import { renderHook } from "vitest-browser-react";

import { createTestQueryClient } from "@/test/page-helpers";

import { useActionMutation } from "./use-action-mutation";

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe("useActionMutation", () => {
  it("runAction は mutationFn を variables で呼び、成功したら resolve する", async () => {
    const mutationFn = vi.fn((id: number) => Promise.resolve(`done:${id}`));
    const { result } = await renderHook(
      () => useActionMutation({ mutationFn, onError: vi.fn<(error: Error) => void>() }),
      { wrapper: Wrapper },
    );

    await result.current.runAction(7);

    expect(mutationFn).toHaveBeenCalledExactlyOnceWith(7, expect.anything());
    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("mutationFn が reject しても runAction は reject せず、onError が呼ばれる", async () => {
    const error = new Error("保存に失敗しました");
    // onError に型を付ける。vi.fn() のままだと TVariables が any に推論され runAction() の 0 引数呼び出しが型エラーになる
    const onError = vi.fn<(error: Error) => void>();
    const { result } = await renderHook(
      () =>
        useActionMutation({
          mutationFn: () => Promise.reject(error),
          onError,
        }),
      { wrapper: Wrapper },
    );

    await expect(result.current.runAction()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0]?.[0]).toBe(error);
  });

  it("onSuccess が返した Promise の決着まで runAction は resolve しない", async () => {
    const afterSuccess = Promise.withResolvers<undefined>();
    const onSuccess = vi.fn(() => afterSuccess.promise);
    let settled = false;
    const { result } = await renderHook(
      () =>
        useActionMutation({
          mutationFn: () => Promise.resolve(undefined),
          onSuccess,
          onError: vi.fn<(error: Error) => void>(),
        }),
      { wrapper: Wrapper },
    );

    const running = result.current.runAction().finally(() => {
      settled = true;
    });
    // mutationFn の決着後に onSuccess が呼ばれた時点で、その Promise が未決着のあいだは戻らない
    // (壁時計の sleep で待つと、遅い環境で誤って通る)
    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
    expect(settled).toBe(false);

    afterSuccess.resolve(undefined);
    await running;
    expect(settled).toBe(true);
  });

  it("onError を省略した options は型で拒否される", () => {
    // 実行はしない。型検査 (vp check) が通ることだけを固定する
    expectTypeOf(useActionMutation).parameter(0).toHaveProperty("onError");
    // @ts-expect-error onError 必須。省略すると runAction が reject を吸収したときに失敗が無通知になる
    const options: Parameters<typeof useActionMutation>[0] = {
      mutationFn: () => Promise.resolve(),
    };
    expect(options).toBeDefined();
  });
});
