/**
 * 文字列を code point 数で切り詰める。valibot の `maxCodePoints` と、SQLite の `length()` / `substr` と同じ
 * 数え方 (ADR-0036)。code point の境界で切るので、サロゲートペアの片割れは残らない。ZWJ で結んだ絵文字の
 * ような複数の code point からなる見た目の 1 文字は、途中で切れうる。
 */
export function truncateCodePoints(text: string, maxCodePoints: number): string {
  return Array.from(text).slice(0, maxCodePoints).join("");
}
