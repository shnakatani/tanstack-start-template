import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { THROWN_VALUE_UNPRINTABLE } from "@/lib/thrown-value-message";
import { createTestRouter } from "@/test/app/create-test-router";
import { expectAbsent } from "@/test/assert/absent";
import { expectText } from "@/test/assert/screen-assertions";

import { ROUTE_ERROR_FALLBACK_MESSAGE, RouteErrorContent } from "./route-error";

async function renderError(error: unknown, reset: () => void) {
  const router = createTestRouter("/", () => <RouteErrorContent error={error} reset={reset} />);
  const invalidateSpy = vi.spyOn(router, "invalidate");
  const screen = await render(<RouterProvider router={router} />);
  return { screen, invalidateSpy };
}

/**
 * screens/ は story のカタログの対象外で、見え方は実画面で見る (docs/guides/storybook.md「カタログと play の範囲」)。ここに残すのは
 * 表示の内容、production での秘匿、再試行の配線で、いずれも寸法や色を測らない。寸法と色は並べた部品が持ち、
 * その部品のテストと story が見る。内容が高くてもカードの上端が画面に残ることは `CenteredCard` が持つ挙動で、
 * ここでは組み合わせているだけ
 */
describe("RouteErrorContent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("エラーメッセージが表示される", async () => {
    const { screen } = await renderError(new Error("取得に失敗しました"), vi.fn());

    const notice = screen.getByText("エラーが発生しました");
    await expect.element(notice).toBeInTheDocument();
    await expect.element(screen.getByText("取得に失敗しました")).toBeInTheDocument();
  });

  // route は Error 以外も throw でき、Router はエラー境界の error を unknown で渡す
  it("Error でない値が投げられたら、その値を文字列にして出す", async () => {
    const { screen } = await renderError("取得の途中で中断されました", vi.fn());

    await expectText(screen, "取得の途中で中断されました");
  });

  // instanceof の判定が throw する値でも、エラーの画面ごと壊れずに固定の文言を出す
  it("instanceof の判定が throw する値でも、画面を保って固定の文言を出す", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("参照できない");
        },
      },
    );

    const { screen } = await renderError(error, vi.fn());

    await expectText(screen, THROWN_VALUE_UNPRINTABLE);
  });

  // server で描くときの error と DEV の client の error は、server function の throw 文言 (id や
  // 検証失敗の項目パスを含む) をそのまま持つ。開発者向けの内部事情なので production では画面へ出さない
  it("production では raw な error.message を出さず固定文言だけを出す", async () => {
    vi.stubEnv("DEV", false);
    const error = new Error("削除対象のノートが見つかりません: id=42");

    const { screen } = await renderError(error, vi.fn());

    // 肯定 anchor。固定文言が出たことを待ってから、raw な情報の不在を見る (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
    await expectText(screen, ROUTE_ERROR_FALLBACK_MESSAGE);
    await expectAbsent(
      screen.getByText("削除対象のノートが見つかりません: id=42", { exact: false }),
    );
  });

  it("再試行で reset と router.invalidate の両方が呼ばれる", async () => {
    const reset = vi.fn();
    const { screen, invalidateSpy } = await renderError(new Error("取得に失敗しました"), reset);

    await expect.element(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
    await screen.getByRole("button", { name: "再試行" }).click();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  // client で起きた例外の stack は React がブラウザの console に出し、server 由来の例外の stack は
  // 発生元を指さない (ADR-0038)。画面には出さない
  it("DEV でも stack を出さない", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at loader";

    const { screen } = await renderError(error, vi.fn());

    await expectText(screen, "取得に失敗しました");
    // 既定で閉じた開閉の UI は、ラベルによらず aria-expanded="false" のボタンとして残る
    await expectAbsent(screen.getByRole("button", { expanded: false }));
    await expectAbsent(screen.getByText(/at loader/));
  });
});
