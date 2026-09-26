import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/app/create-test-router";
import { expectAbsent, expectRemoved } from "@/test/assert/absent";
import { expectText } from "@/test/assert/screen-assertions";

import { ROUTE_ERROR_FALLBACK_MESSAGE, RouteErrorContent } from "./route-error";

async function renderError(error: Error, reset: () => void) {
  const router = createTestRouter("/", () => <RouteErrorContent error={error} reset={reset} />);
  const invalidateSpy = vi.spyOn(router, "invalidate");
  const screen = await render(<RouterProvider router={router} />);
  return { screen, invalidateSpy };
}

/**
 * screens/ は story のカタログの対象外で、見え方は実画面で見る (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは
 * 表示の内容、production での秘匿、再試行の配線、スタックトレースのキーボード開閉で、
 * いずれも寸法や色を測らない。寸法と色は並べた部品が持ち、その部品のテストと story が見る。
 *
 * 長いスタックトレースがパネル内でスクロールすることは `CodeBlock` の `Overflowing` story、
 * 内容が高くてもカードの上端が画面に残ることは `CenteredCard` が持つ挙動で、ここでは
 * 組み合わせているだけ。トリガーの色を本文と分けることは `no-restyle` が守る
 * (ADR-0011 が捕まえた実在の欠陥)。
 */
describe("RouteErrorContent", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("エラーメッセージが表示される", async () => {
    const { screen } = await renderError(new Error("取得に失敗しました"), vi.fn());

    const notice = screen.getByText("エラーが発生しました");
    await expect.element(notice).toBeInTheDocument();
    await expect
      .element(screen.getByText("取得に失敗しました", { exact: true }))
      .toBeInTheDocument();
  });

  // error.message は server function の throw 文言 (id や検証失敗の項目パスを含む) をそのまま
  // 運ぶ。開発者向けの内部事情なので production では画面へ出さない
  it("production では raw な error.message とスタックトレースを出さず固定文言だけを出す", async () => {
    vi.stubEnv("DEV", false);
    const error = new Error("削除対象のノートが見つかりません: id=42");
    error.stack = "Error: 削除対象のノートが見つかりません: id=42\n    at loader";

    const { screen } = await renderError(error, vi.fn());

    // 肯定 anchor。固定文言が出たことを待ってから、raw な情報の不在を見る (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, ROUTE_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(screen.getByText("削除対象のノートが見つかりません: id=42"));
    await expectAbsent(screen.getByRole("button", { name: "スタックトレース" }));
  });

  it("再試行で reset と router.invalidate の両方が呼ばれる", async () => {
    const reset = vi.fn();
    const { screen, invalidateSpy } = await renderError(new Error("取得に失敗しました"), reset);

    await expect.element(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "再試行" }).click();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it("スタックトレースは h3 見出しとして既定で閉じる", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at loader";
    const { screen } = await renderError(error, vi.fn());

    const trigger = screen.getByRole("button", { name: "スタックトレース" });
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await expect
      .element(screen.getByRole("heading", { name: "スタックトレース", level: 3 }))
      .toBeInTheDocument();
    // 肯定 anchor は直上の見出し。閉じている間は中身が出ない (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectAbsent(screen.getByText(/at loader/));
  });

  it("スタックトレースを Enter と Space で開閉する", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at loader";
    const { screen } = await renderError(error, vi.fn());
    const trigger = screen.getByRole("button", { name: "スタックトレース" });

    // 最初の tab stop がトリガー (見出しと本文は focusable でない)
    await userEvent.tab();
    await expect.element(trigger).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(screen.getByText(/at loader/)).toBeVisible();

    await userEvent.keyboard(" ");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await expectRemoved(screen.getByText(/at loader/));
  });
});
