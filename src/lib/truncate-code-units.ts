/**
 * 文字列を UTF-16 の code unit 数で切り詰める。HTML の `maxlength` と同じ数え方
 * (`String.prototype.length`)。切った位置がサロゲートペアの途中なら、残った前半 (high surrogate)
 * を落とす。落とさないと URL では U+FFFD に化け、`LIKE` の比較にも当たらない。
 * valibot 1.4.2 に切り詰めの action は無い (長さは検証のみ。2026-09-23 に同梱の型定義で確認)。
 */
export function truncateCodeUnits(text: string, maxCodeUnits: number): string {
  if (text.length <= maxCodeUnits) {
    return text;
  }
  return text.slice(0, maxCodeUnits).replace(/[\uD800-\uDBFF]$/u, "");
}
