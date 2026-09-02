import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { createTestRouter } from "@/test/create-test-router";
import {
  expectWithinViewport,
  restoreDefaultViewport,
  setViewport,
  SHORT_VIEWPORT,
} from "@/test/viewport";
import { waitForAnimations } from "@/test/wait-for-animations";

import {
  FullScreenRouteError,
  ROUTE_ERROR_FALLBACK_MESSAGE,
  RouteErrorContent,
} from "./route-error";

async function renderError(error: Error, reset: () => void) {
  const router = createTestRouter("/", () => <RouteErrorContent error={error} reset={reset} />);
  const invalidateSpy = vi.spyOn(router, "invalidate");
  const screen = await render(<RouterProvider router={router} />);
  return { screen, invalidateSpy };
}

describe("RouteErrorContent", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("エラーメッセージが表示される", async () => {
    const { screen } = await renderError(new Error("取得に失敗しました"), vi.fn());

    await vi.waitFor(() => {
      expect(screen.getByText("エラーが発生しました").query()).not.toBeNull();
      expect(screen.getByText("取得に失敗しました", { exact: true }).query()).not.toBeNull();
      expect(
        screen.getByText("エラーが発生しました").element().closest('[data-slot="card"]'),
      ).not.toBeNull();
    });
  });

  // error.message は server function の throw 文言 (id や検証失敗の項目パスを含む) をそのまま
  // 運ぶ。開発者向けの内部事情なので production では画面へ出さない
  it("production では raw な error.message とスタックトレースを出さず固定文言だけを出す", async () => {
    vi.stubEnv("DEV", false);
    const error = new Error("削除対象のノートが見つかりません: id=42");
    error.stack = "Error: 削除対象のノートが見つかりません: id=42\n    at loader";

    const { screen } = await renderError(error, vi.fn());

    await vi.waitFor(() => {
      expect(screen.getByText(ROUTE_ERROR_FALLBACK_MESSAGE).query()).not.toBeNull();
    });
    expect(screen.getByText("削除対象のノートが見つかりません: id=42").query()).toBeNull();
    expect(screen.getByRole("button", { name: "スタックトレース" }).query()).toBeNull();
  });

  it("再試行で reset と router.invalidate の両方が呼ばれる", async () => {
    const reset = vi.fn();
    const { screen, invalidateSpy } = await renderError(new Error("取得に失敗しました"), reset);

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "再試行" }).query()).not.toBeNull();
    });
    await screen.getByRole("button", { name: "再試行" }).click();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  // CardContent は registry の flex flex-col を持つ。幅指定のない子は align-items: stretch で
  // 全幅化するため、内容幅で収まるべきボタンには self-start が要る
  it("再試行ボタンはカード幅いっぱいに伸びない", async () => {
    const { screen } = await renderError(new Error("取得に失敗しました"), vi.fn());

    const button = screen.getByRole("button", { name: "再試行" }).element();
    // 同じ CardContent 内の幅指定なしの兄弟。stretch により常に content box 幅まで伸びるため、
    // ボタンが stretch されると両者が同幅になる (エラーメッセージの長さには依存しない)
    const paragraph = screen.getByText("取得に失敗しました", { exact: true }).element();

    expect(button.getBoundingClientRect().width).toBeLessThan(
      paragraph.getBoundingClientRect().width,
    );
  });

  it("スタックトレースは h3 見出しとして既定で閉じる", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at loader";
    const { screen } = await renderError(error, vi.fn());

    const trigger = screen.getByRole("button", { name: "スタックトレース" });
    expect(trigger.element().getAttribute("aria-expanded")).toBe("false");
    expect(trigger.element().getAttribute("aria-controls")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "スタックトレース", level: 3 }).query(),
    ).not.toBeNull();
    expect(screen.getByText(/at loader/).query()).toBeNull();
  });

  it("スタックトレースを Enter と Space で開閉する", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at loader";
    const { screen } = await renderError(error, vi.fn());
    const trigger = screen.getByRole("button", { name: "スタックトレース" });

    trigger.element().focus();
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => {
      expect(trigger.element().getAttribute("aria-expanded")).toBe("true");
      const panelId = trigger.element().getAttribute("aria-controls");
      expect(panelId).not.toBeNull();
      expect(document.getElementById(panelId ?? "")).not.toBeNull();
      expect(
        screen
          .getByText(/at loader/)
          .element()
          .checkVisibility(),
      ).toBe(true);
    });

    await userEvent.keyboard(" ");
    await vi.waitFor(() => {
      expect(trigger.element().getAttribute("aria-expanded")).toBe("false");
      expect(trigger.element().getAttribute("aria-controls")).toBeNull();
      expect(screen.getByText(/at loader/).query()).toBeNull();
    });
  });
  it("長いスタックトレースはパネル内でスクロールし、カードを画面外へ押し出さない", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = [
      "Error: 取得に失敗しました",
      ...Array.from({ length: 60 }, (_, i) => `    at frame${i} (src/routes/example.tsx:${i}:3)`),
    ].join("\n");
    const { screen } = await renderError(error, vi.fn());

    await screen.getByRole("button", { name: "スタックトレース" }).click();
    await vi.waitFor(() => {
      expect(
        screen
          .getByText(/at frame0 /)
          .element()
          .checkVisibility(),
      ).toBe(true);
    });
    await waitForAnimations();

    const stack = screen.getByText(/at frame0 /).element();
    const scroller = stack.closest('[data-slot="scroll-area-viewport"]');
    if (scroller === null) throw new Error("ScrollArea の viewport が見つかりません");
    // パネル内で縦スクロールし、カード自体は伸びない
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    expectWithinViewport(stack.closest('[data-slot="card"]') ?? stack);
    // 長い行は横スクロールでき、スクロールバーが手がかりとして出る
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(
      document.querySelector('[data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]'),
    ).not.toBeNull();
    // 素の overflow に戻すとキーボードだけではスクロールできなくなる (base-ui は
    // スクロール可能な viewport に tabindex を付ける)
    expect(scroller.getAttribute("tabindex")).toBe("0");
  });
});

describe("FullScreenRouteError", () => {
  afterEach(restoreDefaultViewport);

  /**
   * `h-screen` は枠の高さを viewport に固定する。内容がそれより高いと `items-center` が
   * カードを上へはみ出させ、スクロールしても見出しに届かなくなる。
   * `min-h-svh` なら枠が内容の高さまで伸びるので、上端は画面内に残る。
   */
  it("内容が画面より高くてもカードの上端が画面外へ出ない", async () => {
    await setViewport(SHORT_VIEWPORT);
    const error = new Error("エラーの詳細な説明。".repeat(200));

    const screen = await render(<FullScreenRouteError error={error} reset={vi.fn()} />);

    const card = screen.getByText("エラーが発生しました").element().closest('[data-slot="card"]');
    if (card === null) throw new Error("Card が見つかりません");
    expect(card.getBoundingClientRect().height).toBeGreaterThan(SHORT_VIEWPORT.height);
    expect(card.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  });
});
