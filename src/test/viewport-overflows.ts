/** `getBoundingClientRect()` の戻り値のうち判定に使う辺と寸法 */
export type RectEdges = Pick<DOMRect, "top" | "left" | "bottom" | "right" | "width" | "height">;

/**
 * 矩形が viewport からはみ出している辺と、潰れている寸法を列挙する。空配列なら収まっている。
 * 高さ・幅が 0 の要素は「はみ出していない」を自明に満たすので、潰れも列挙に含める。
 * 文字列にするのは、`toEqual([])` の失敗文にどの辺が何 px 出たかを残すため。
 */
export function viewportOverflows(
  rect: RectEdges,
  viewport: { width: number; height: number },
): string[] {
  const overflows: string[] = [];
  if (rect.height <= 0) overflows.push("height 0");
  if (rect.width <= 0) overflows.push("width 0");
  if (rect.top < 0) overflows.push(`top ${rect.top}px`);
  if (rect.left < 0) overflows.push(`left ${rect.left}px`);
  if (rect.bottom > viewport.height) overflows.push(`bottom +${rect.bottom - viewport.height}px`);
  if (rect.right > viewport.width) overflows.push(`right +${rect.right - viewport.width}px`);
  return overflows;
}
