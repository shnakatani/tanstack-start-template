/** SQLite の `LIKE ... ESCAPE` に渡すエスケープ文字。`escapeLikePattern` と対で使う。 */
export const LIKE_ESCAPE_CHAR = "\\";

/**
 * ユーザー入力を LIKE のパターンへ埋め込む前に、ワイルドカード (`%` / `_`) とエスケープ文字を
 * リテラルにする。呼び出し側が `%${escapeLikePattern(q)}%` のように前後へワイルドカードを足す。
 * `ESCAPE` 句を付けないとエスケープが効かないので、`LIKE_ESCAPE_CHAR` を必ず併せて渡す。
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `${LIKE_ESCAPE_CHAR}${char}`);
}
