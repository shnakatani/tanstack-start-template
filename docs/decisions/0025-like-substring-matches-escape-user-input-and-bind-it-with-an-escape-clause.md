# ADR-0025: LIKE の部分一致は利用者の入力をエスケープし、`ESCAPE` 句と対で bind する

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0023 (絞り込み条件は URL が持つ)、ADR-0013 (`src/server/db/` の置き場)

## Context

利用者の入力から `LIKE` の部分一致を組む場面がある。実例は `/notes` の title の絞り込み (ADR-0023) で、サーバ側で行う。SQLite の `LIKE` は `%` と `_` をワイルドカードとして扱い、既定では ASCII の英字だけ大文字小文字を区別しない (sqlite.org「SQLite only understands upper/lower case for ASCII characters by default」)。利用者の入力をそのまま渡すと `100%` が `100` で始まる全てに一致する。

drizzle-orm 0.45 の `like` / `ilike` はパターンをそのまま受けるだけで、エスケープの helper は無い (drizzle-team/drizzle-orm#444、2023-04-13 起票、2026-09-23 時点で open)。SQLite にもエスケープ関数は無い。

## Decision

**`src/server/db/like-pattern.ts` の `likeContains(column, text)` が `column LIKE ? ESCAPE ?` を組み、`%` `_` `\` をエスケープしたパターンを bind する。空の検索語は `where(undefined)` で条件を付けない。**

| 規範                                                                                                                                      | 守らないと何が壊れるか                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 呼び出し側はパターンと `ESCAPE` を手で組まず `likeContains` を使う                                                                        | エスケープと `ESCAPE` 句を対で渡す規約を忘れた検索が黙って壊れる (`%` が効く、`\` が消える) |
| 大文字小文字は SQLite の `LIKE` の既定 (ASCII のみ無視) に従い、handler のテストで固定する                                                | `instr()` に替えると完全一致になり、`react` で `React` が当たらなくなる                     |
| 検証は `src/features/notes/handlers.test.ts` が実 SQLite (`:memory:`) で行う (`%` / `_` / `\` を含む検索語、ASCII の大文字小文字、日本語) | エスケープの純粋関数だけを単体で見ると、`ESCAPE` 句との対応が抜けても通る                   |

## Consequences

- 先頭 `%` の `LIKE` は index が効かず全行走査になる。`created_at` の index を足しても絞り込み時は速くならない (20,000 行で 1.64ms → 2.72ms。2026-09-23 に better-sqlite3 で実測)。件数が問題になったら FTS5 を検討する (schema の変更を伴う)

### 再評価の条件

- drizzle-orm が `like` のエスケープ helper を出荷したら (drizzle-team/drizzle-orm#444)、`likeContains` を置き換える

## 検討した選択肢

20,000 行の `:memory:` で 20 回平均 (2026-09-23)。

| 案                                        | 評価                                                                             | 採否     |
| ----------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| `LIKE ? ESCAPE ?` (1.12 ms)               | エスケープが要るが、ASCII の大文字小文字を無視する既定が検索欄に合う             | **採用** |
| `instr(title, ?)` (1.05 ms)               | エスケープ不要で速いが完全一致 (大文字小文字を区別)。挙動が変わる                | 却下     |
| `instr(lower(title), lower(?))` (2.00 ms) | `LIKE` と同じ意味になる (8 通りの検索語で結果一致) が、行ごとの `lower()` で遅い | 却下     |
| FTS5                                      | 語単位の検索と index が効くが、schema の変更と部分一致の意味の変更を伴う         | 見送り   |

## 出典

- SQLite の `LIKE` (ASCII のみ case-insensitive、`ESCAPE`): <https://sqlite.org/lang_expr.html#like>
- SQLite の `instr` / `lower`: <https://sqlite.org/lang_corefunc.html>
- drizzle-team/drizzle-orm#444 (`like` へのエスケープ helper の要望。open): <https://github.com/drizzle-team/drizzle-orm/issues/444>
