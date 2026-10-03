import type { ReactNode } from "react";

/**
 * React が何も描かない値 (undefined・null・真偽値・空文字と、それだけを持つ配列) なら true。
 * 値の有無で包みの要素や aria の参照を足す部品が、`cond && <Badge />` の偽や空の一覧で空の要素を描かないために使う。
 *
 * react.dev が "Using Children is uncommon and can lead to fragile code." とする `Children.toArray` には頼らない。
 * 配列でない iterable と Promise は中身を見ずに false (描くかもしれない側) に倒す。
 */
export function rendersNothing(node: ReactNode): boolean {
  if (node === undefined || node === null || typeof node === "boolean" || node === "") return true;
  if (Array.isArray(node)) return node.every((child: ReactNode) => rendersNothing(child));
  return false;
}
