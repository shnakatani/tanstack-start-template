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
 * 2026-09-23 時点で open)。SQLite にも無いので、ここで組む workaround である。
 * `instr()` は大文字小文字を区別する完全一致になり、`lower()` を挟むと行ごとに遅くなるので、
 * SQLite の `LIKE` の既定 (ASCII の英字だけ大文字小文字を無視) を使う。
 * 検証は handlers.test.ts が実 SQLite で行う (`%` / `_` / `\` を含む検索語)。`ESCAPE` 句との対応は、
 * エスケープの純粋関数だけを単体で見ても抜けたまま通るので、SQL まで通して見る。
 * 先頭が `%` の LIKE は index が効かず全行を走査する。件数が問題になったら FTS5 を検討する。
 */
export function likeContains(column: SQLWrapper, text: string): SQL {
  return sql`${column} LIKE ${`%${escapePattern(text)}%`} ESCAPE ${ESCAPE_CHAR}`;
}
