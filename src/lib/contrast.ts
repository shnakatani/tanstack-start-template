/** `rgb(r, g, b)` の 3 値を取り出す。alpha 付きや名前付きの色は扱わない */
function parseRgb(color: string): [number, number, number] | null {
  const match = /^rgb\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)\s*\)$/.exec(color.trim());
  if (!match) {
    console.warn("[contrast] rgb() として解析できない色", { color });
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** WCAG 2.1 の相対輝度 (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * 2 色のコントラスト比を返す。判定の基準は `implementation.md`「色とコントラスト」が持つ。
 * どちらかが解析できないときは null を返す (0 や 1 を返すと合格側へ倒れて気付けない)
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseRgb(foreground);
  const bg = parseRgb(background);
  if (!fg || !bg) return null;

  const lighter = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const darker = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}
