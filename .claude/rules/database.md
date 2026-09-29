---
paths:
  - "src/server/db/**"
  - "drizzle.config.ts"
  - ".mise.toml"
---

# DB の接続と migration

## パスとファイル

- `DB_FILE_NAME` の相対パスを、コードでルートを探して補わない。drizzle-kit は cwd 基準のままなので、アプリだけが別の場所を指す。cwd に依らせたいなら絶対パスで渡す (`docs/guides/database.md`「パスを cwd 基準にする理由」)
- `createDb()` で無い DB のファイルを作らず、開こうとした絶対パスを server のログに残し、作り方を示して throw する。アプリは migration を当てないので、作った空の DB はテーブルを持たない (`docs/guides/database.md`「DB のファイルをアプリで作らない理由」)
- migration のフォルダは `src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` から読み、`./drizzle` を書き写さない。片方だけ変わると、テストが古い migration を当てたまま通る (`docs/guides/database.md`「スキーマを変える」)

## migration の適用

- `migrateDb()` をアプリの経路から呼ばない。適用の経路が drizzle-kit とアプリの 2 か所に分かれる (`docs/guides/database.md`「migration を起動時に適用しない理由」)
- 起動時の適用に変えるときは、`migrateDb()` の呼び出しだけを足さず、DB を作らない前提・migration のフォルダの置き場所・DB のディレクトリの作成・デプロイの手順を一緒に変える。揃えないと、初回の起動で落ちるか、適用の経路が 2 か所に分かれる (`docs/guides/database.md`「起動時に migration を適用する形に変える」)
