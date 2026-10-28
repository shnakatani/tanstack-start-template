import { statusHeadingProps } from "@/lib/focus-page-heading";

/**
 * ページ名の見出し (`<h1>`) の下で、画面の状態 (失敗) を伝える見出し。`<h2>` で描き、遷移の後の focus は
 * 文書順で先の `<h1>` より先にここへ移る (`focusPageHeading`、ADR-0035)。
 * 寸法と色は持たない。カードの中では `CardPageTitle` で包む
 */
export function StatusHeading({ title }: { title: string }) {
  return <h2 {...statusHeadingProps}>{title}</h2>;
}
