import { describe, expect, it, vi } from "vite-plus/test";

import { closeAfterInvalidate } from "./close-after-invalidate";

describe("closeAfterInvalidate", () => {
  it("invalidateQueries の決着前は close を呼ばず、決着後に呼ぶ", async () => {
    const refetch = Promise.withResolvers<undefined>();
    const invalidateQueries = vi.fn(() => refetch.promise);
    const close = vi.fn();

    const running = closeAfterInvalidate({ invalidateQueries }, ["notes"], { close })();

    expect(invalidateQueries).toHaveBeenCalledExactlyOnceWith({ queryKey: ["notes"] });
    expect(close).not.toHaveBeenCalled();

    refetch.resolve(undefined);
    await running;
    expect(close).toHaveBeenCalledOnce();
  });

  it("invalidateQueries が reject したら close を呼ばずに reject を伝える", async () => {
    const error = new Error("refetch failed");
    const invalidateQueries = vi.fn(() => Promise.reject(error));
    const close = vi.fn();

    await expect(closeAfterInvalidate({ invalidateQueries }, ["notes"], { close })()).rejects.toBe(
      error,
    );
    expect(close).not.toHaveBeenCalled();
  });
});
