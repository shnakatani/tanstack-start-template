/** SQLite の `LIKE ... ESCAPE` に渡すエスケープ文字。`escapeLikePattern` と対で使う。 */
export const LIKE_ESCAPE_CHAR = "\\";

/**
 * ユーザー入力を LIKE のパターンへ埋め込む前に、ワイルドカード (`%` / `_`) とエスケープ文字を
 * リテラルにする。呼び出し側が `%${escapeLikePattern(q)}%` のように前後へワイルドカードを足す。
 * `ESCAPE` 句を付けないとエスケープが効かないので、`LIKE_ESCAPE_CHAR` を必ず併せて渡す。
 *
 * drizzle-orm の `like` / `ilike` はパターンをそのまま渡すだけで、エスケープの helper は無い
 * (drizzle-team/drizzle-orm#444、2023-04-13 起票、2026-09-23 時点で open)。SQLite にも無い。
 * 入ったらこの関数を消して置き換える (ADR-0033)。
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `${LIKE_ESCAPE_CHAR}${char}`);
}
