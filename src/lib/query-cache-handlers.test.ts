import { QueryCache, QueryObserver } from "@tanstack/react-query";
import type { QueryClient, QueryObserverOptions } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vite-plus/test";

import { createTestQueryClient } from "@/test/app/query-client";

import {
  BACKGROUND_REFETCH_ERROR_MESSAGE,
  createBackgroundRefetchErrorHandler,
} from "./query-cache-handlers";

/**
 * mutation 成功後の一覧 refetch が失敗しても通知されない silent failure の回帰テスト。
 *
 * - 初回ロード失敗 (data === undefined) は error boundary (RouteErrorContent) が扱うため通知しない
 * - data はあるが observer が無い query の失敗 (閉じたダイアログの 1 件を loader が取り直すなど) は、
 *   取得を await した側が扱うため通知しない
 * - 部品が表示している (data があり observer がある) データの background refetch 失敗のみ通知する
 *
 * 実機の発火経路を再現するため、ハンドラ単体ではなく QueryCache.onError 経由で検証する。
 */
function createClient(notify: (message: string) => void) {
  return createTestQueryClient({
    queryCache: new QueryCache({
      onError: createBackgroundRefetchErrorHandler(notify),
    }),
  });
}

/**
 * query を購読する (mount した useSuspenseQuery に相当)。キャッシュの値をそのまま表示する状態を作るので、
 * 購読の時点では取り直さない (staleTime: Infinity)。テストの終わりに購読を外す
 */
function observe(client: QueryClient, options: Pick<QueryObserverOptions, "queryKey" | "queryFn">) {
  const observer = new QueryObserver(client, { ...options, staleTime: Infinity });
  onTestFinished(observer.subscribe(() => {}));
  return observer;
}

describe("createBackgroundRefetchErrorHandler", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // raw error は observability 用に console.warn へ流すため、テスト出力を汚さないよう抑制する
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("初回ロード失敗 (data なし) では通知しない (error boundary が扱う)", async () => {
    const notify = vi.fn();
    const client = createClient(notify);

    await expect(
      client.query({
        queryKey: ["initial-load"],
        queryFn: () => Promise.reject(new Error("初回失敗")),
      }),
    ).rejects.toThrow("初回失敗");

    expect(notify).not.toHaveBeenCalled();
  });

  it("data はあるが observer が無い query の取得の失敗では通知しない (await した側が扱う)", async () => {
    const notify = vi.fn();
    const client = createClient(notify);

    // 1 回目: 成功してキャッシュにデータを載せる (= 開いて閉じたダイアログの 1 件)
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, name: "既存" })
      .mockRejectedValueOnce(new Error("Failed to fetch"));
    await client.query({ queryKey: ["note", 1], queryFn, staleTime: 0 });
    expect(notify).not.toHaveBeenCalled();

    // 2 回目: 開き直す loader の取り直しが失敗する。読む部品は無く、失敗は loader を await した側に届く
    await expect(client.query({ queryKey: ["note", 1], queryFn, staleTime: 0 })).rejects.toThrow(
      "Failed to fetch",
    );

    expect(notify).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("表示中データがある background refetch 失敗では通知する", async () => {
    const notify = vi.fn();
    const client = createClient(notify);

    // 1 回目: 成功してキャッシュにデータを載せ、部品が購読する (= 一覧表示中の状態)
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "既存" }])
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    await client.query({ queryKey: ["list"], queryFn, staleTime: 0 });
    observe(client, { queryKey: ["list"], queryFn });
    expect(notify).not.toHaveBeenCalled();

    // 2 回目: mutation 後の invalidate 相当の refetch が失敗する
    await client.refetchQueries({ queryKey: ["list"] });

    // raw error ("Failed to fetch") ではなく固定の日本語文言を流す
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(BACKGROUND_REFETCH_ERROR_MESSAGE);
  });

  it("data が null (正常な空結果) の状態の refetch 失敗でも通知する", async () => {
    const notify = vi.fn();
    const client = createClient(notify);

    // 「該当なし」を null で返す queryFn がある。null は loaded 扱い (!== undefined) なので、
    // 空配列と同じく「表示中のデータがある」状態として通知対象に入る
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    await client.query({ queryKey: ["nullable"], queryFn, staleTime: 0 });
    observe(client, { queryKey: ["nullable"], queryFn });
    expect(notify).not.toHaveBeenCalled();

    await client.refetchQueries({ queryKey: ["nullable"] });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(BACKGROUND_REFETCH_ERROR_MESSAGE);
  });

  it("複数回の background refetch 失敗はその都度通知する", async () => {
    const notify = vi.fn();
    const client = createClient(notify);

    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "既存" }])
      .mockRejectedValue(new Error("失敗"));

    await client.query({ queryKey: ["list"], queryFn, staleTime: 0 });
    observe(client, { queryKey: ["list"], queryFn });
    await client.refetchQueries({ queryKey: ["list"] });
    await client.refetchQueries({ queryKey: ["list"] });

    expect(notify).toHaveBeenCalledTimes(2);
  });
});
