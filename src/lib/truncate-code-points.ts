/**
 * 文字列を code point 数で切り詰める。valibot の `maxCodePoints` と、SQLite の `length()` / `substr` と同じ
 * 数え方 (ADR-0036)。code point の境界で切るので、サロゲートペアの片割れは残らない。ZWJ で結んだ絵文字の
 * ような複数の code point からなる見た目の 1 文字は、途中で切れうる。
 * valibot 1.5.0 に切り詰めの action は無い (長さは検証のみ。2026-09-29 に同梱の型定義で確認)。
 */
export function truncateCodePoints(text: string, maxCodePoints: number): string {
  const codePoints = Array.from(text);
  if (codePoints.length <= maxCodePoints) {
    return text;
  }
  return codePoints.slice(0, maxCodePoints).join("");
}
