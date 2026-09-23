import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";
import { expect } from "vite-plus/test";
import type { render } from "vitest-browser-react";

/** `render()` の戻り値。locator を取るヘルパーの引数型に使う。 */
export type Screen = Awaited<ReturnType<typeof render>>;

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
 * close は同期的に `data-open` → `data-closed` を切り替えるが、Popup の unmount は次の描画で、
 * animation を戻したテスト (ADR-0043) では animate-out の完了まで残る。要素の存在だけを見ると
 * 「close 済みだがまだ DOM にある」を「開いたまま」と誤判定するので、`data-open` を見る。
 * Popup は `aria-hidden` 配下に入ることがあるため `includeHidden` で取る。
 */
export async function expectDialogOpen(screen: Screen, role: "dialog" | "alertdialog") {
  await expect
    .element(screen.getByRole(role, { includeHidden: true }))
    .toHaveAttribute("data-open");
}

/** 指定テキストが表示されるまで待って検証する。 */
export async function expectText(screen: Screen, text: string) {
  await expect.element(screen.getByText(text)).toBeInTheDocument();
}

/** 指定ラベルの textbox がすべて空であることを検証する。値は locator の matcher で見る (ADR-0044) */
export async function expectEmptyTextboxes(screen: Screen, labels: string[]) {
  await Promise.all(
    labels.map(async (label) => {
      await expect
        .element(screen.getByRole("textbox", { name: label, exact: true }))
        .toHaveValue("");
    }),
  );
}
