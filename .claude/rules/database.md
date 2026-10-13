---
paths:
  - "src/server/db/**"
  - "scripts/db/**"
  - "drizzle.config.ts"
  - ".mise.toml"
---

# DB の接続と migration

## パスとファイル

- `DB_FILE_NAME` の相対パスを、コードでルートを探して補わない。drizzle-kit は cwd 基準のままなので、アプリだけが別の場所を指す。cwd に依らせたいなら絶対パスで渡す (`docs/guides/database.md`「パスを cwd 基準にする理由」)
- `createDb()` で無い DB のファイルを作らず、開こうとした絶対パスと作り方を例外の文言に入れて throw する。アプリは migration を当てないので、作った空の DB はテーブルを持たない (`docs/guides/database.md`「DB のファイルをアプリで作らない理由」)
- migration のフォルダは `src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` から読み、`./drizzle` を書き写さない。片方だけ変わると、テストが古い migration を当てたまま通る (`docs/guides/database.md`「スキーマを変える」)

## migration の適用

- `migrateDb()` をアプリの経路から呼ばない (`docs/guides/database.md`「migration を起動時に適用しない理由」)
- 起動時の適用に変えるときは、`migrateDb()` の呼び出しだけを足さず、DB を作らない前提・migration のフォルダの置き場所・DB のディレクトリの作成・デプロイの手順を一緒に変える。揃えないと、初回の起動で落ちるか、適用の経路が 2 か所に分かれる (`docs/guides/database.md`「起動時に migration を適用する形に変える」)

## 見本のデータ

- 見本の配列と入れ方は `scripts/db/lib/<domain>-seed.ts` に置き、`scripts/db/seed.ts` から呼ぶ。`src/` に置かず、アプリのコードから import しない。import すると見本が出荷する bundle に入る (`docs/guides/database.md`「見本のデータを `scripts/db/` に置く理由」)
- ドメインの見本の入れ方は、テーブルの行の削除、`sqlite_sequence` のそのテーブルの行の削除、id と日時を明示した insert を 1 つのトランザクションで打つ。日時を既定値に任せると打つたびに中身が変わり、`sqlite_sequence` を残すと seed のあとに作る行の id が飛ぶ (`docs/guides/database.md`「見本のデータを入れる」)
