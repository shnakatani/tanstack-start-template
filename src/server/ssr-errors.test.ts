import { notFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { logSsrMatchErrors } from "./ssr-errors";

describe("logSsrMatchErrors", () => {
  it("error になった match の例外を、routeId を付けて server のログに残す", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = new Error("検索語は文字列で指定してください");

    logSsrMatchErrors([
      { routeId: "__root__", status: "success", error: undefined },
      { routeId: "/notes", status: "error", error: thrown },
    ]);

    expect(error).toHaveBeenCalledExactlyOnceWith("[ssr] /notes", thrown);
  });

  // 1 つ目の error で打ち切ると、後ろの route の例外がどこにも残らない
  it("error になった match が複数あれば、全部を残す", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {});
    const parentError = new Error("親の loader が失敗しました");
    const childError = new Error("子の loader が失敗しました");

    logSsrMatchErrors([
      { routeId: "__root__", status: "error", error: parentError },
      { routeId: "/notes", status: "error", error: childError },
    ]);

    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenNthCalledWith(1, "[ssr] __root__", parentError);
    expect(error).toHaveBeenNthCalledWith(2, "[ssr] /notes", childError);
  });

  // notFound は 404 の画面を出すための制御の throw で、異常ではない
  it("notFound と pending の match は残さない", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {});

    logSsrMatchErrors([
      { routeId: "/notes", status: "notFound", error: notFound() },
      { routeId: "/", status: "pending", error: undefined },
    ]);

    expect(error).not.toHaveBeenCalled();
  });

  // 型にない status は型検査が止めるが、router の版がずれて実行時に来ても、ログの処理で SSR の応答を壊さない
  it("型にない status の match が来ても throw せず、status と例外を残す", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = new Error("取得に失敗しました");
    const match = { routeId: "/notes", status: "success" as const, error: thrown };
    Reflect.set(match, "status", "redirected");

    expect(() => logSsrMatchErrors([match])).not.toThrow();
    expect(error).toHaveBeenCalledExactlyOnceWith("[ssr] /notes の match の status が想定外", {
      status: "redirected",
      error: thrown,
    });
  });
});
