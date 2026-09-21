/**
 * Tailwind の既定 palette をトークンの表にする。
 *
 * 値は `tailwindcss/colors` から取る。`node_modules/tailwindcss/package.json` の `exports`
 * にある口で、同梱の `theme.css` と同じ oklch 文字列を返す (2026-09-22 実測)。`@theme` の
 * 綴りを自前で読むより短く、Tailwind が at-rule の書き方を変えても壊れない。
 *
 * 名前は Tailwind の変数名 (`--color-orange-800`) をそのまま使う。ADR-0024 が hue の段を
 * この綴りで書いているので、文書に現れる名前とここへ渡す名前が一致する。
 *
 * `src/styles.css` は `--color-*: initial` で既定 palette を消しているため、ここへ入る名前は
 * アプリの CSS に存在しない。混ぜるのは `--palette` を明示したときだけにする。既定で混ぜると、
 * 描画されない色の比が黙って出る
 */

import colors from "tailwindcss/colors";

export function tailwindPalette(): Readonly<Record<string, string>> {
  const table: Record<string, string> = {};
  for (const [name, value] of Object.entries(colors)) {
    if (typeof value === "string") {
      // `inherit` / `current` / `transparent` もここへ入る。色として解決できないので
      // 渡されれば `layerOf` が落ちる。表から外すと「無いトークン」と区別が付かない
      table[`--color-${name}`] = value;
      continue;
    }
    for (const [step, color] of Object.entries(value)) {
      table[`--color-${name}-${step}`] = color;
    }
  }
  return table;
}
