import { RouterProvider } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { expectAbsent } from "@/test/absent";
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

    const notice = screen.getByText("エラーが発生しました");
    await expect.element(notice).toBeInTheDocument();
    await expect
      .element(screen.getByText("取得に失敗しました", { exact: true }))
      .toBeInTheDocument();
    // 出現は直前の assert が待ち切っている。closest は同期読みなので retry で包まない
    expect(notice.element().closest('[data-slot="card"]')).not.toBeNull();
  });

  // error.message は server function の throw 文言 (id や検証失敗の項目パスを含む) をそのまま
  // 運ぶ。開発者向けの内部事情なので production では画面へ出さない
  it("production では raw な error.message とスタックトレースを出さず固定文言だけを出す", async () => {
    vi.stubEnv("DEV", false);
    const error = new Error("削除対象のノートが見つかりません: id=42");
    error.stack = "Error: 削除対象のノートが見つかりません: id=42\n    at loader";

    const { screen } = await renderError(error, vi.fn());

    // 肯定 anchor。固定文言が出たことを待ってから、raw な情報の不在を見る (ADR-0029)
    await expect.element(screen.getByText(ROUTE_ERROR_FALLBACK_MESSAGE)).toBeInTheDocument();
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
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.element(trigger).not.toHaveAttribute("aria-controls");
    await expect
      .element(screen.getByRole("heading", { name: "スタックトレース", level: 3 }))
      .toBeInTheDocument();
    // 肯定 anchor は直上の見出し。閉じている間は中身が出ない (ADR-0029)
    await expectAbsent(screen.getByText(/at loader/));
  });

  it("スタックトレースを Enter と Space で開閉する", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at loader";
    const { screen } = await renderError(error, vi.fn());
    const trigger = screen.getByRole("button", { name: "スタックトレース" });

    trigger.element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    // `aria-controls` に対応する matcher は無い。参照先が実在することまで見ないと、
    // 宙に浮いた id を指す状態が属性の存在だけで通る (ADR-0029 の escape hatch)
    await expect
      .poll(() => document.getElementById(trigger.element().getAttribute("aria-controls") ?? ""))
      .not.toBeNull();
    await expect.element(screen.getByText(/at loader/)).toBeVisible();

    await userEvent.keyboard(" ");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await expect.element(trigger).not.toHaveAttribute("aria-controls");
    await expect.element(screen.getByText(/at loader/)).not.toBeInTheDocument();
  });
  it("長いスタックトレースはパネル内でスクロールし、カードを画面外へ押し出さない", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = [
      "Error: 取得に失敗しました",
      ...Array.from({ length: 60 }, (_, i) => `    at frame${i} (src/routes/example.tsx:${i}:3)`),
    ].join("\n");
    const { screen } = await renderError(error, vi.fn());

    await screen.getByRole("button", { name: "スタックトレース" }).click();
    await expect.element(screen.getByText(/at frame0 /)).toBeVisible();
    await waitForAnimations();

    const stack = screen.getByText(/at frame0 /).element();
    const scroller = stack.closest('[data-slot="scroll-area-viewport"]');
    expect.assert(scroller !== null, "ScrollArea の viewport が見つかりません");
    // パネル内で縦スクロールし、カード自体は伸びない
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    expectWithinViewport(stack.closest('[data-slot="card"]') ?? stack);
    // 長い行は横スクロールでき、スクロールバーが手がかりとして出る
    expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
    expect(
      scroller
        .closest('[data-slot="scroll-area"]')
        ?.querySelector('[data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]'),
    ).not.toBeNull();
    // 素の overflow に戻すとキーボードだけではスクロールできなくなる (base-ui は
    // スクロール可能な viewport に tabindex を付ける)
    expect(scroller.getAttribute("tabindex")).toBe("0");
  });

  it("スタックトレースのトリガーは本文と違う色で描く (操作要素の可読性)", async () => {
    const error = new Error("取得に失敗しました");
    error.stack = "Error: 取得に失敗しました\n    at frame0 (src/routes/example.tsx:1:3)";
    const { screen } = await renderError(error, vi.fn());

    const body = screen.getByText("取得に失敗しました", { exact: true }).element();
    const trigger = screen.getByRole("button", { name: "スタックトレース" }).element();

    expect(getComputedStyle(trigger).color).not.toBe(getComputedStyle(body).color);
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
    expect.assert(card !== null, "Card が見つかりません");
    expect(card.getBoundingClientRect().height).toBeGreaterThan(SHORT_VIEWPORT.height);
    expect(card.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
  });
});
