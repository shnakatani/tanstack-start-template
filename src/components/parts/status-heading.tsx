import { statusHeadingProps } from "@/lib/focus-page-heading";

/**
 * 画面の状態 (失敗、見つからない) を伝える見出し。遷移の後の focus は、これがあれば文書順で先の h1 より先に
 * ここへ移る (`focusPageHeading`、ADR-0035)。
 * level は見出しの階層で呼ぶ側が決める。名前の付いたページの見出し (h1) の下なら 2、無ければ 1。
 * 寸法と色は持たない。カードの中では `CardPageTitle` で包む
 */
export function StatusHeading({ title, level }: { title: string; level: 1 | 2 }) {
  const Heading = level === 1 ? "h1" : "h2";
  return <Heading {...statusHeadingProps}>{title}</Heading>;
}
