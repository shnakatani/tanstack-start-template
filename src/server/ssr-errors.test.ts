import { notFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { logSsrMatchErrors } from "./ssr-errors";

describe("logSsrMatchErrors", () => {
  it("error になった match の例外を、routeId を付けて server のログに残す", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = new Error("検索語は文字列で指定してください");

    logSsrMatchErrors([
      { routeId: "__root__", status: "success", error: undefined },
      { routeId: "/notes/", status: "error", error: thrown },
    ]);

    expect(error).toHaveBeenCalledExactlyOnceWith("[ssr] /notes/", thrown);
  });

  // notFound は 404 の画面を出すための制御の throw で、異常ではない
  it("notFound と pending の match は残さない", () => {
    using error = vi.spyOn(console, "error").mockImplementation(() => {});

    logSsrMatchErrors([
      { routeId: "/notes/", status: "notFound", error: notFound() },
      { routeId: "/", status: "pending", error: undefined },
    ]);

    expect(error).not.toHaveBeenCalled();
  });
});
