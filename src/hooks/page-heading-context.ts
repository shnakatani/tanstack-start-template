import { createContext, use } from "react";

/**
 * ページの見出しの行 (`RoutePageHeader` か、読み込んだ名前を渡した `PageHeader` の h1) が、この位置より上に
 * 描かれているか。`PageOutlet` が true を渡し、失敗の画面 (`RouteFailureScreen`) と既定の pending 表示
 * (`PendingContent`) が読む (ADR-0035)。
 * 値は boolean そのもの。オブジェクトにすると描画のたびに新しい参照になり、`react/jsx-no-constructed-context-values`
 * に当たる。provider の外は false (ページの h1 の下ではない)
 */
export const PageHeadingAboveContext = createContext(false);

export function usePageHeadingAbove(): boolean {
  return use(PageHeadingAboveContext);
}
