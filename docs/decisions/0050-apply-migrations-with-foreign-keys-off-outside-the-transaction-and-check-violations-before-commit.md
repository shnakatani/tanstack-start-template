# ADR-0050: migration は外部キーの検査をトランザクションの外で切ってから当て、確定の前に違反を検査する

- Status: Accepted
- Date: 2026-11-23
- 関連: ADR-0004 (`db:*` のタスクは `vite.config.ts` に置き、`DB_FILE_NAME` は mise が渡す)

## Context

SQLite の `ALTER TABLE` が直接扱えるのは、テーブルの改名、列の改名、列の追加、列の削除だけである。2026-11-23 に drizzle-kit 0.31.11 で確かめると、`generate` は列の制約や既定値を変えたときに、テーブルを作り直す SQL を出力した (新しいテーブルを作る、行を写す、元を `DROP TABLE` する、新しいテーブルを改名する)。この SQL は `PRAGMA foreign_keys=OFF;` で始まり、`PRAGMA foreign_keys=ON;` で終わっていた。

同じ日に読んだ drizzle-orm 0.45.4 の migrator (`drizzle-kit migrate` もこれを呼んでいた) は、未適用の migration をすべて 1 つの `BEGIN` の中で流していた。SQLite はトランザクションの中の `PRAGMA foreign_keys` を無視し、エラーも返さない (SQLite「SQLite Foreign Key Support」の「Enabling Foreign Key Support」: "It is not possible to enable or disable foreign key constraints in the middle of a multi-statement transaction ... Attempting to do so does not return an error; it simply has no effect.")。外部キーの検査が効いたままの `DROP TABLE` は、行を消す暗黙の `DELETE` として外部キーの検査と `ON DELETE` の動作を受ける (同じ文書の「CREATE, ALTER and DROP TABLE commands」: "the DROP TABLE command performs an implicit DELETE ... may invoke foreign key actions or constraint violations")。

2026-11-23 に、親 (`authors`) と親を参照する子 (`books`) を drizzle のスキーマに足し、`vp run db:generate` と `drizzle-kit migrate` で当てて行を入れた。そのあと親の列を NOT NULL に変える作り直しを生成し、`drizzle-kit migrate` で当てた (drizzle-kit 0.31.11、drizzle-orm 0.45.4、better-sqlite3 13.2.0 の SQLite 3.54.1)。

| 作り直す表 | 子の `onDelete`     | 結果                                                                                                                                                                   |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 親         | 無し (`no action`)  | `DROP TABLE` が `FOREIGN KEY constraint failed` で落ち、ロールバックされた。`drizzle-kit migrate` は exit 1 を返したが、端末に繋がずに打つとエラーの中身を出さなかった |
| 親         | `cascade`           | 成功として記録され、子の 3 行がすべて消えた                                                                                                                            |
| 親         | `set null`          | 成功として記録され、子の 3 行の参照がすべて NULL になった                                                                                                              |
| 親         | 無し、子の行が 0 件 | 落ちずに当たった                                                                                                                                                       |
| 子         | 無し、`cascade`     | 子の行は残った                                                                                                                                                         |

既定値だけを変えた作り直しでも、`cascade` で子の行が消えた。列の追加と削除は `ALTER TABLE` で済み、作り直しにならなかった。同じ SQL を、外部キーの検査を有効にした接続からトランザクションの外で 1 文ずつ流すと、`PRAGMA foreign_keys=OFF` が効き、`onDelete` が無し・`cascade`・`set null` のどれでも子の 3 行と参照が残った (better-sqlite3 13.2.0 の SQLite 3.54.1)。

テストは空の DB に migration を当てるので、子の行が 0 件の場合に当たり、この問題を見つけられない。

上流では次が open である (2026-11-23 時点)。

- drizzle-team/drizzle-orm#4640、drizzle-team/drizzle-orm#5782: 作り直しの `ON DELETE CASCADE` で子の行が黙って消える
- drizzle-team/drizzle-orm#3065: migration で `PRAGMA defer_foreign_keys` を使いたい要望
- drizzle-team/drizzle-orm#5784 (PR): migrator が `PRAGMA foreign_keys=OFF` を `BEGIN` の前に移す。`PRAGMA foreign_key_check` は足さない
- drizzle-orm の docs (「Migrations」「drizzle-kit migrate」「Custom migrations」) に、外部キーと作り直しの扱いの記述は無い。GitHub Discussions を `foreign_keys`、`defer_foreign_keys`、`table recreation` などで検索した範囲でも、この問題へのメンテナの回答は無い

## Decision

migration は、テンプレートの `migrateDb()` (`src/server/db/index.ts`) で当てる。`vp run db:migrate` (`scripts/db/migrate.ts`) とテストの両方がこの関数を通し、`drizzle-kit migrate` は使わない。テーブルを作る SQL は引き続き `drizzle-kit generate` が出力する。drizzle docs「Migrations」の Option 5 (生成した SQL を自分で当てる) に当たる。

`migrateDb()` は、SQLite「ALTER TABLE」の「Making Other Kinds Of Table Schema Changes」の手順のうち、トランザクションと外部キーの扱いを受け持つ。

| SQLite の手順                                                                           | `migrateDb()` の動き                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 外部キーの検査が有効なら `PRAGMA foreign_keys=OFF` で切る                            | トランザクションの外で切り、読み出して 0 になったことを確かめる。0 でなければ何も当てずに落ちる                                                                                                                                                                                                                                                                                                    |
| 2. トランザクションを始める                                                             | 書き込みのロックを取るトランザクション (`BEGIN IMMEDIATE`) を始め、その中で記録の表を作り、最後の記録を読んで未適用を決める。未適用をまとめて 1 つのトランザクションで流す                                                                                                                                                                                                                         |
| 3-9. 新しいテーブルを作り、写し、元を消し、改名し、索引・トリガー・ビューを作り直す     | drizzle-kit が出力した SQL をそのまま流し、migration ごとに記録を書く                                                                                                                                                                                                                                                                                                                              |
| 10. `PRAGMA foreign_key_check` で、スキーマの変更が外部キーを壊していないことを確かめる | 当てたあと確定の前に DB 全体を検査し、違反が 1 件でもあれば、その表と rowid を文言に入れてロールバックし、落ちる。記録も残らない。当てる前の違反は数えるだけで止める理由に使わず、当てる前から違反があったときに、当てる前と当てたあとの件数と、違反を直す custom migration を足すよう文言に入れる。当てたあとの件数が多ければ、migration も違反を作ったと読める。未適用が無ければ検査を走らせない |
| 11. 確定する                                                                            | 確定する                                                                                                                                                                                                                                                                                                                                                                                           |
| 12. 検査を有効に戻す                                                                    | 成功しても失敗しても `foreign_keys = ON` に戻し、1 になったことを確かめる                                                                                                                                                                                                                                                                                                                          |

適用済みの記録は、drizzle-orm の migrator と同じ形で書き、同じ条件で判定する。

- 記録の表は `__drizzle_migrations` (`id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric`)
- 最後の記録の `created_at` より `folderMillis` が大きい migration を未適用とみなす
- migration ごとに `hash` と `folderMillis` を記録する
- migration は drizzle-orm が export する `readMigrationFiles` (`drizzle-orm/migrator`) で読む。drizzle-orm の migrator 自身が使う関数で、`hash` と `folderMillis` もこの関数が組む

`drizzle-kit migrate` で当てた既存の DB はそのまま引き継げ、`migrateDb()` が書いた記録も drizzle-orm の migrator が適用済みとみなす (`src/server/db/migrate-db.test.ts`)。

drizzle-orm の migrator と違うのは、記録の表の作成と最後の記録の読み出しを `BEGIN IMMEDIATE` の中で行う点である。2026-11-23 に読んだ drizzle-orm 0.45.4 の migrator は、読み出しをトランザクションの外で行い、`BEGIN` も書き込みのロックを取らなかった。2 つの接続が同時に当てると、後の側が、先の側が確定する前の記録を読み、同じ migration を当てうる。`BEGIN IMMEDIATE` なら後の側は先の側の確定を待ち (better-sqlite3 の既定の `timeout` は 5000 ms。better-sqlite3 docs「API」の `new Database()`)、その記録を読んでから未適用を決める。記録の形と判定は変えないので、互換は保たれる。

確定の前の検査は DB 全体の違反を見る。SQLite の手順の 10 は "run PRAGMA foreign_key_check to verify that the schema change did not break any foreign key constraints" と書き、引数の無い `PRAGMA foreign_key_check` は DB 全体を検査する (SQLite「Pragma statements supported by SQLite」の `foreign_key_check`: "checks the database, or the table called \"table-name\", for foreign key constraints that are violated")。下の先行例のうち Django と knex も、確定の前の DB 全体の違反で止める。DB 全体を見るので、当てる前からある違反が残っていても落ちる。当てる前の検査は、そのとき文言を分けるためだけにテンプレートが足した。当てる前から違反があったなら、文言にその件数を入れ、違反を直す custom migration を先に足すよう案内する。

当てる前に違反があれば何も当てずに止める形は採らない。違反を直す migration も当てる前に止まる。テンプレートで本番の DB を変える経路は `vp run db:migrate` だけなので、本番の DB の違反を直す経路が無くなる。DB 全体を確定の前に見る形なら、違反を直す custom migration を足すと、ほかの未適用の migration と一緒に当たる。

当てる前と確定の前の違反を突き合わせ、増えた違反だけで止める形 (Atlas の形) は採らない。`foreign_key_check` の行は表の名前と rowid で違反を指し、rowid は "NULL if the child table is a WITHOUT ROWID table" である (同じ節)。行の同一性が表の名前と rowid に頼る。2026-11-23 に、その形で書いた `migrateDb()` (better-sqlite3 13.2.0 の SQLite 3.54.1) へ次の migration を当てた。

| 当てる前の DB                                                       | migration                                                         | 突き合わせの結果                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 子の表 (主キーが text) に違反が 1 件。行を消して rowid に隙間がある | 子の表を作り直す (違反は増えない)                                 | rowid が詰まって違反の rowid が変わり、増えた違反として誤って落ちた       |
| 子の表に違反が 1 件                                                 | 子の表を改名する (違反は増えない)                                 | 表の名前が変わり、増えた違反として誤って落ちた                            |
| WITHOUT ROWID の子の表に違反が 1 件                                 | 親を 1 行消して、違反を 1 件増やす                                | 違反の rowid はどれも NULL で同じ行に見え、増えた違反を見落として確定した |
| 子の表 (主キーが text) に違反が 1 件                                | 子の表を作り直して違反の行を落とし、親を 1 行消して別の違反を作る | 新しい違反が消えた違反と同じ rowid になり、見落として確定した             |

### 検討した選択肢

| 案                                                                                                                 | 子の行             | 違反を確定の前に止めるか                             | 守る経路          | 評価                                                                                                                                                                                                                                                                                                                                                                   | 採否     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A. 12 の手順の外枠を `migrateDb()` で持ち、`db:migrate` とテストを通す                                             | 残る               | 止める                                               | 両方              | SQLite の手順どおりで、確定の前の検査は Django と knex と同じ。当てる前の検査は文言を分けるためだけにテンプレートが足した。当てる前からある違反が残るかぎり、違反と関係の無い migration も当たらない。migration の読み込みと記録の形を drizzle-orm に合わせて持つことになる                                                                                            | **採用** |
| A". A のうち、当てる前に違反があれば何も当てずに止める                                                             | 残る               | 止める                                               | 両方              | 当てる前の違反を migration の違反と取り違えないが、違反を直す migration も止まり、本番の DB を直す経路が無くなる                                                                                                                                                                                                                                                       | 却下     |
| A'. A のうち、確定の前の検査を当てる前との差にする (Atlas の形)                                                    | 残る               | 取り違える (上の表)                                  | 両方              | 当てる前からある違反があっても、関係の無い migration を当てられる。違反の行を rowid で突き合わせるので、WITHOUT ROWID の表と、表の作り直しと改名で、増えた違反を見落とすか、増えていない違反で落ちる                                                                                                                                                                   | 却下     |
| L. `@libsql/client` を足し、drizzle-kit に libsql の driver を選ばせる                                             | 残る               | 止めない (違反を残す migration が exit 0 で確定した) | `db:migrate` だけ | drizzle-kit の driver の自動選択と、libsql の `client.migrate()` (トランザクションの外で `foreign_keys=off` を打つ) に乗る。選ぶ順は docs に無く (drizzle docs「drizzle.config.ts」の `driver` は "automatically picks an available SQLite driver" とだけ書く)、2026-11-23 に 0.31.11 で確かめると選んだ driver を表示しなかったので、依存が外れると保護が黙って消える | 却下     |
| B. 接続で `foreign_keys = OFF` にしてから drizzle-orm の `migrate()` を呼び、確定の後に `foreign_key_check` を打つ | 残る               | 止めない。確定の後に見つかっても戻せない             | 差し替えた経路    | drizzle-team/drizzle-orm#5782 が挙げる回避策 (OFF にしてから `migrate()` を呼び、ON に戻す) に、確定の後の `foreign_key_check` を足した形。drizzle-team/drizzle-orm#5784 も、検査の無い同じ性質になる                                                                                                                                                                  | 却下     |
| C. 作り直しの SQL を、列の改名・追加・`UPDATE`・削除に手で書き換える                                               | 残る               | 検査は効いたまま                                     | すべて            | migration のたびに手で書く。主キー、UNIQUE、索引、CHECK、外部キーに使われる列は `DROP COLUMN` できず (SQLite「ALTER TABLE」の「ALTER TABLE DROP COLUMN」)、使えない変更が残る                                                                                                                                                                                          | 却下     |
| D. 作り直しの SQL の先頭に `PRAGMA defer_foreign_keys = ON` を足す                                                 | `cascade` で消える | 違反の無い migration も `COMMIT` で落ちる            | —                 | `DROP TABLE` の暗黙の削除が数えた違反は、改名した新しいテーブルでは解消されない。遅延するのは検査だけで、`ON DELETE` の動作は即時に走る                                                                                                                                                                                                                                | 却下     |
| E. `drizzle-kit migrate` のまま上流を待つ                                                                          | 消えるか落ちる     | —                                                    | —                 | 上流の issue と PR に、この問題へのメンテナの回答が無い (2026-11-23。drizzle-team/drizzle-orm#3065 には、メンテナが全 issue へ一括で送った近況報告 (2025-08-30) だけがある)                                                                                                                                                                                            | 却下     |

案ごとの結果は、Context と同じ親子のテーブルと版で 2026-11-23 に測った。違反を止めるかは、親のコピーから 1 行を落として子の参照を切る migration で測った。

### 先行例

2026-11-23 に出典の commit のソースで読むと、`foreign_key_check` まで行う先行例は、どれもトランザクションの外で検査を切り、確定の前に違反を検査して、違反があれば戻すか落とす。違反を数える範囲は分かれ、A の確定の前の検査は Django と knex と同じである。当てる前の検査は、文言を分けるためだけにテンプレートが足した。

| ツール | 形                                                                                                                                                                                 | 違反を数える範囲                     | 出典                                                               |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Django | schema editor が開く前に検査を切り、切れなければ `NotSupportedError` で止める。抜けるときに `check_constraints()` を打ち、違反があれば `IntegrityError` にしてから検査を戻す       | DB 全体の `PRAGMA foreign_key_check` | [Django の `sqlite3/schema.py`][]、[Django の `sqlite3/base.py`][] |
| Atlas  | `OpenTx` がトランザクションの外で検査を切り、始めた直後と確定の前に `foreign_key_check` を読み、増えた違反があればロールバックする                                                 | 当てる前との差 (A' の形。採らない)   | [Atlas の `sqlite/driver.go`][]                                    |
| knex   | テーブルの作り直しを、検査を切る文、トランザクションの中の作り直しと `foreign_key_check`、検査を戻す文に分けて流し、違反が 1 件でもあれば `FOREIGN KEY constraint failed` を投げる | DB 全体の `PRAGMA foreign_key_check` | [knex の `sqlite3/schema/ddl.js`][]、[knex の `runner.js`][]       |

同じ日に出典の commit のソースで読むと、トランザクションの外で検査を切るだけで、`foreign_key_check` を打たないものもあった。

| ツール                       | 形                                                                                                                                                                                                                                                                                                                              | 出典                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TypeORM                      | better-sqlite3 の query runner が migration の前に `foreign_keys = OFF`、後に `ON` を打ち、migration の executor はその間でトランザクションを開閉する                                                                                                                                                                           | [TypeORM の `BetterSqlite3QueryRunner.ts`][]、[TypeORM の `MigrationExecutor.ts`][]                                 |
| Prisma Migrate               | テーブルを作り直す SQL を `PRAGMA defer_foreign_keys=ON` と `PRAGMA foreign_keys=OFF` で始める (`foreign_key_check` の行はコメントで外してある)。SQLite では migration の SQL に `BEGIN` を書かず (`render_begin_transaction` の既定は `None`)、`execute_batch` でトランザクションに包まずに流すので、`foreign_keys=OFF` が効く | [Prisma の `sqlite/renderer.rs`][]、[Prisma の `sql_renderer.rs`][]、[Prisma の `sqlite/connector/native/mod.rs`][] |
| libsql の `client.migrate()` | `PRAGMA foreign_keys=off` を打ってから `BEGIN` し、確定の後に `on` に戻す                                                                                                                                                                                                                                                       | [libsql の `sqlite3.ts`][]                                                                                          |

## Consequences

- 子から参照される親を作り直しても、`onDelete` の指定によらず子の行と参照が残る
- migration が外部キーの違反を残すと、`vp run db:migrate` は何も当てずに落ち、違反の表と rowid を出す
- 当てる前から DB に外部キーの違反があると、違反が残るかぎり、違反と関係の無い migration も当たらない。`vp run db:migrate` は当てる前と当てたあとの件数と、確定の前の違反の表と rowid を出して落ちる。当てたあとの件数が多ければ、migration も違反を作っている。違反の行を消すか直す custom migration (drizzle docs「Custom migrations」) を足すと、ほかの未適用の migration と一緒に当たる
- `migrateDb()` はトランザクションの中で呼ぶと落ちる。検査を切れないので、当てずに止める
- 検査を切った接続で当てるので、migration の中の `DELETE` と `UPDATE` では `ON DELETE` と `ON UPDATE` の動作が走らない。`drizzle-kit migrate` の経路では走っていた。custom migration で親の行を消すとき (更新するとき) は、子の行も SQL で明示的に消す (更新する)。消し忘れは、確定の前の検査で落ちる (2026-11-23 に better-sqlite3 13.2.0 の SQLite 3.54.1 で、検査を切った接続で親を消すと `cascade` の子が残り、`foreign_key_check` に 1 件出ることを確かめた)
- 同時に当てると、後の側は先の側の確定を better-sqlite3 の `timeout` まで待ち、過ぎると `SQLITE_BUSY` で落ちる
- `drizzle-kit migrate` を直接打つと、この保護を通らずに当たる。経路は `vp run db:migrate` と `migrateDb()` に限る
- migration の読み込みと記録の形を、drizzle-orm 0.45 の migrator に合わせてテンプレートが持つ
- テストの DB は空なので、作り直しで違反を残す migration は、行のある DB に当てたときにしか落ちない

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。外部の文書とソースは 2026-11-23 に読んだ。

- SQLite「ALTER TABLE」の「Making Other Kinds Of Table Schema Changes」と「ALTER TABLE DROP COLUMN」: https://www.sqlite.org/lang_altertable.html
- SQLite「SQLite Foreign Key Support」: https://www.sqlite.org/foreignkeys.html
- SQLite「Pragma statements supported by SQLite」の `foreign_keys`、`foreign_key_check`、`defer_foreign_keys`: https://www.sqlite.org/pragma.html
- drizzle docs「Migrations」: https://orm.drizzle.team/docs/migrations
- drizzle docs「drizzle.config.ts」の `driver`: https://orm.drizzle.team/docs/drizzle-config-file
- drizzle docs「Custom migrations」: https://orm.drizzle.team/docs/kit-custom-migrations
- drizzle-orm 0.45.4 の migrator (`SQLiteSyncDialect.migrate`): https://github.com/drizzle-team/drizzle-orm/blob/eab8bedbb65d5429c54e612ddbd88aa23091d398/drizzle-orm/src/sqlite-core/dialect.ts
- drizzle-orm 0.45.4 の `readMigrationFiles`: https://github.com/drizzle-team/drizzle-orm/blob/eab8bedbb65d5429c54e612ddbd88aa23091d398/drizzle-orm/src/migrator.ts
- better-sqlite3 docs「API」の `new Database()` の `timeout` と `.transaction()` の `immediate`: https://github.com/WiseLibs/better-sqlite3/blob/v13.2.0/docs/api.md

[Django の `sqlite3/schema.py`]: https://github.com/django/django/blob/0eae0b2584ed1e13d696ae1a5d8016a5c2dc7149/django/db/backends/sqlite3/schema.py
[Django の `sqlite3/base.py`]: https://github.com/django/django/blob/0eae0b2584ed1e13d696ae1a5d8016a5c2dc7149/django/db/backends/sqlite3/base.py
[Atlas の `sqlite/driver.go`]: https://github.com/ariga/atlas/blob/e933d0b70620e67e8e0972e47f2c03a1dc38d333/sql/sqlite/driver.go
[knex の `sqlite3/schema/ddl.js`]: https://github.com/knex/knex/blob/e25d54bcb707714a17f5a5744eba5c4246bb4d1d/lib/dialects/sqlite3/schema/ddl.js
[knex の `runner.js`]: https://github.com/knex/knex/blob/e25d54bcb707714a17f5a5744eba5c4246bb4d1d/lib/execution/runner.js
[TypeORM の `BetterSqlite3QueryRunner.ts`]: https://github.com/typeorm/typeorm/blob/d5b143dd7ed659e2a1cbac044a2c78d90c0f6f8f/packages/typeorm/src/driver/better-sqlite3/BetterSqlite3QueryRunner.ts#L66-L78
[TypeORM の `MigrationExecutor.ts`]: https://github.com/typeorm/typeorm/blob/d5b143dd7ed659e2a1cbac044a2c78d90c0f6f8f/packages/typeorm/src/migration/MigrationExecutor.ts#L319-L376
[Prisma の `sqlite/renderer.rs`]: https://github.com/prisma/prisma-engines/blob/d1b3f377ca835d73fd50954a5e22128b9ebdd6b8/schema-engine/connectors/sql-schema-connector/src/flavour/sqlite/renderer.rs#L192-L243
[Prisma の `sql_renderer.rs`]: https://github.com/prisma/prisma-engines/blob/d1b3f377ca835d73fd50954a5e22128b9ebdd6b8/schema-engine/connectors/sql-schema-connector/src/sql_renderer.rs#L98-L100
[Prisma の `sqlite/connector/native/mod.rs`]: https://github.com/prisma/prisma-engines/blob/d1b3f377ca835d73fd50954a5e22128b9ebdd6b8/schema-engine/connectors/sql-schema-connector/src/flavour/sqlite/connector/native/mod.rs#L165-L184
[libsql の `sqlite3.ts`]: https://github.com/tursodatabase/libsql-client-ts/blob/9496c782af413f6380235c7f5d0c97b5371f49b7/packages/libsql-client/src/sqlite3.ts#L385-L428
