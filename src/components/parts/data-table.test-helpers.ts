import type { Locator } from "vite-plus/test/browser/context";

import type { Screen } from "@/test/assert/screen-assertions";

/**
 * 行 `row` の中で、列見出しが `header` の列の cell (`DataTable`)。cell は見出しを accessible name に
 * 持たないので、見出しの並びの位置で取る。行の中の文字列だけを見ると、同じ種類の値を持つ別の列
 * (作成日時と更新日時など) と取り違えても通る。
 *
 * - 見出しは同期に読む。見出しは data に依らず `render()` の時点で描かれている (`render()` が act で
 *   flush する。docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」)
 * - 見出しは `columnheader` で取る。`scope="col"` が無いと解決されない (ADR-0018)
 * - 画面に `DataTable` が 1 つで、見出しの文言が重ならない前提。見つからない・重なるときは throw する。
 *   空の locator を返すと、不在の assert が素通りする
 */
export function cellInColumn(screen: Screen, row: Locator, header: string): Locator {
  const headers = screen
    .getByRole("columnheader")
    .elements()
    .map((element) => element.textContent);
  const indexes = headers.flatMap((text, index) => (text === header ? [index] : []));
  const [index, ...rest] = indexes;
  if (index === undefined || rest.length > 0) {
    throw new Error(
      `列見出し「${header}」がちょうど 1 つではありません (見出し: ${JSON.stringify(headers)})`,
    );
  }
  return row.getByRole("cell").nth(index);
}
