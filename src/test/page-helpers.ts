import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { expect, vi } from "vite-plus/test";
import type { render } from "vitest-browser-react";

/**
 * テスト用の QueryClient。retry を切るのは、失敗ケースの検証が既定のリトライ回数だけ
 * 待たされてタイムアウトするため。`defaultOptions` は上書きさせず、queryCache のような
 * 差し込みだけを config で受ける (テストごとに retry の既定が変わると失敗の原因が読めない)。
 */
export function createTestQueryClient(config?: Omit<QueryClientConfig, "defaultOptions">) {
  return new QueryClient({
    ...config,
    defaultOptions: { queries: { retry: false } },
  });
}

/**
 * ダイアログがまだ開いていることを検証する。
 *
 * close は同期的に `data-open` → `data-closed` を切り替えるが、animate-out (duration-100) の間も
 * Popup は DOM に残る。要素の存在だけを見ると「close 済みだがアニメーション窓の中」を
 * 「開いたまま」と誤判定するので、`data-open` を見る。
 * Popup は `aria-hidden` 配下に入ることがあるため `includeHidden` で取る。
 */
export function expectDialogOpen(
  screen: Awaited<ReturnType<typeof render>>,
  role: "dialog" | "alertdialog",
) {
  expect(screen.getByRole(role, { includeHidden: true }).element().hasAttribute("data-open")).toBe(
    true,
  );
}

/** 指定テキストが表示されるまで待って検証する。 */
export async function expectText(screen: Awaited<ReturnType<typeof render>>, text: string) {
  await vi.waitFor(() => {
    expect(screen.getByText(text).query()).not.toBeNull();
  });
}

export async function expectEmptyTextboxes(
  screen: Awaited<ReturnType<typeof render>>,
  labels: string[],
) {
  await vi.waitFor(() => {
    for (const label of labels) {
      const textbox = screen.getByRole("textbox", { name: label, exact: true }).element();
      expect.assert(textbox instanceof HTMLInputElement, `${label} の textbox が input ではない`);
      expect(textbox.value).toBe("");
    }
  });
}
