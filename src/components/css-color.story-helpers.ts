/**
 * Canvas 2D の fillStyle を使い、CSS の色として解決できるか判定する共通処理。fillStyle は
 * 無効な値を代入すると値を無視して直前の値を保つ (仕様どおりの挙動) ため、判定用の sentinel
 * を挟んで検出する。呼び出し側 (振り分け用の静かな判定か、変換後の値が要る場面か) で warn の
 * 要否が変わるため、ここでは warn を出さない
 */
function resolveColor(cssColor: string): [number, number, number] | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const sentinel = "#010203";
  ctx.fillStyle = sentinel;
  ctx.fillStyle = cssColor;
  if (ctx.fillStyle === sentinel) return null;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  const [r, g, b] = [data[0], data[1], data[2]];
  // 1x1 の ImageData は必ず RGBA の 4 要素を持つ (Canvas 2D 仕様)。noUncheckedIndexedAccess
  // が number | undefined にするための型ガードで、実際にここへ来ることは想定していない
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error("[css-color] ImageData の pixel data が想定外の長さ");
  }
  return [r, g, b];
}

/**
 * cssColor が CSS の色として解決できるかどうかを判定する。warn は出さない静かな述語で、
 * 非色トークン (spacing / font / animation 等) を選り分ける用途を想定する。ここで鳴らすと
 * 非色トークンの数だけ warn が出て、toRgb() が本来鳴らすべき warn が埋もれる
 */
export function isColor(cssColor: string): boolean {
  return resolveColor(cssColor) !== null;
}

/**
 * 任意の CSS 色文字列を `rgb(r, g, b)` へ正規化する。styles.css の色は oklch() で書かれており、
 * contrastRatio (contrast.story-helpers.ts) は rgb() しか解析できないため必要になる (getComputedStyle
 * でカスタムプロパティを読んでも colorspace は変換されず oklch() のままなことを実測で確認した)。
 * 呼び出し側は isColor() で事前に選り分けた値を渡す前提のため、それでも解析できないのは
 * 前提が崩れている状態であり warn する
 */
export function toRgb(cssColor: string): string | null {
  const rgb = resolveColor(cssColor);
  if (rgb === null) {
    console.warn("[css-color] 色として解析できない値", { cssColor });
    return null;
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
