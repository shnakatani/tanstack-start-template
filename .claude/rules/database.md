---
paths:
  - "src/server/db/**"
  - "scripts/db/**"
  - "drizzle.config.ts"
  - "drizzle/**"
  - ".mise.toml"
---

# DB の接続と migration

## パスとファイル

- `DB_FILE_NAME` の相対パスを、コードでルートを探して補わない。drizzle-kit は cwd 基準のままなので、アプリだけが別の場所を指す。cwd に依らせたいなら絶対パスで渡す (`docs/guides/database.md`「パスを cwd 基準にする理由」)
- `createDb()` で無い DB のファイルを作らず、開こうとした絶対パスと作り方を例外の文言に入れて throw する。アプリは migration を当てないので、作った空の DB はテーブルを持たない (`docs/guides/database.md`「DB のファイルをアプリで作らない理由」)
- `createDb()` の `sqlite.pragma("foreign_keys = ON")` と、その値を確かめる throw を外さない。同梱の SQLite は既定でも検査するのでテストは落ちず、外しても気付けない (`docs/guides/database.md`「外部キーの検査を接続で有効にする理由」)
- migration のフォルダは `src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` から読み、`./drizzle` を書き写さない。片方だけ変わると、テストが古い migration を当てたまま通る (`docs/guides/database.md`「スキーマを変える」)

## migration の適用

- migration は `vp run db:migrate` (`migrateDb()`) で当て、`drizzle-kit migrate` で当てない。外部キーの検査が効いたまま当たり、親を作り直す migration が落ちるか子の行を消す (ADR-0050)
- migration の SQL に `BEGIN` / `COMMIT` を書かず、`PRAGMA foreign_keys` で検査を切り替えようとしない。トランザクションと検査は `migrateDb()` が外側で持つ (`docs/guides/database.md`「スキーマを変える」)
- `migrateDb()` を開いたトランザクションの中で呼ばない。外部キーの検査を切れず、何も当てずに落ちる (`docs/guides/database.md`「スキーマを変える」)
- 確定の前の外部キーの違反で落ちたら、文言の表と rowid を見て、違反を残した migration の SQL を直す (`docs/guides/database.md`「スキーマを変える」)
- 文言が当てる前の違反の件数を示したら、違反を直す custom migration (`vp run db:generate --custom --name=<名前>`) を足して `vp run db:migrate` で当てる。本番の DB に手で SQL を打たない (`docs/guides/database.md`「スキーマを変える」)
- 違反の行は、rowid のある表は `PRAGMA foreign_key_check` の rowid で、WITHOUT ROWID の表 (rowid が NULL) は `PRAGMA foreign_key_list(<子>)` の `from` / `table` / `to` から組んだ `NOT EXISTS` で引く (`docs/guides/database.md`「スキーマを変える」)
- custom migration の文と文の間には `--> statement-breakpoint` を書く。区切りの無い 2 つの文は落ちる (`docs/guides/database.md`「スキーマを変える」)
- custom migration で親の行を消すとき (更新するとき) は、子の行も SQL で明示的に消す (更新する)。migration の中では `ON DELETE` / `ON UPDATE` の動作が走らない。消し忘れは確定の前の検査で落ちる (ADR-0050)
- 子から参照される親を作り直す migration は、行のある DB に `vp run db:migrate` で当てて確かめる。テストは空の DB に当てるので、違反を残す migration でも通る (`docs/guides/database.md`「スキーマを変える」)
- `migrateDb()` をアプリの経路から呼ばない (`docs/guides/database.md`「migration を起動時に適用しない理由」)
- 起動時の適用に変えるときは、`migrateDb()` の呼び出しだけを足さず、DB を作らない前提・migration のフォルダの置き場所・DB のディレクトリの作成・デプロイの手順を一緒に変える。揃えないと、初回の起動で落ちるか、適用の経路が 2 か所に分かれる (`docs/guides/database.md`「起動時に migration を適用する形に変える」)

## 見本のデータ

- 見本の配列と入れ方は `scripts/db/lib/<domain>-seed.ts` に置き、`scripts/db/lib/seed-all.ts` の `seedAll()` から呼ぶ。`src/` に置かず、アプリのコードから import しない。import すると見本が出荷する bundle に入る (`docs/guides/database.md`「見本のデータを `scripts/db/` に置く理由」)
- ドメインの見本の入れ方は、`seedAll()` が渡すトランザクションの中で、テーブルの行の削除、`sqlite_sequence` のそのテーブルの行の削除、id と日時を明示した insert を打ち、自分でトランザクションを開かない (`docs/guides/database.md`「見本のデータを入れる」)
