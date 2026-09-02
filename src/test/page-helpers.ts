import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { assert, expect, vi } from "vite-plus/test";
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
      assert(textbox instanceof HTMLInputElement, `${label} の textbox が input ではない`);
      expect(textbox.value).toBe("");
    }
  });
}
