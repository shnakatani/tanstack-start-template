import type { SQL, SQLWrapper } from "drizzle-orm";
import { sql } from "drizzle-orm";

const ESCAPE_CHAR = "\\";

/** `%` / `_` / エスケープ文字をリテラルにする。`ESCAPE` 句と対で使う。 */
function escapePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `${ESCAPE_CHAR}${char}`);
}

/**
 * `column LIKE '%text%'` の部分一致。ユーザー入力のワイルドカードは文字として扱う。
 * drizzle-orm の `like` にエスケープの helper は無い (drizzle-team/drizzle-orm#444、2023-04-13 起票、
 * 2026-09-23 時点で open)。SQLite にも無い。入ったらこの関数を置き換える (ADR-0037)。
 * 検証は handlers.test.ts が実 SQLite で行う (`%` / `_` / `\` を含む検索語)。
 */
export function likeContains(column: SQLWrapper, text: string): SQL {
  return sql`${column} LIKE ${`%${escapePattern(text)}%`} ESCAPE ${ESCAPE_CHAR}`;
}
