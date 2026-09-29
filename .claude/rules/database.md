---
paths:
  - "src/server/db/**"
  - "drizzle.config.ts"
  - ".mise.toml"
---

# DB の接続と migration

## パスとファイル

- `DB_FILE_NAME` の相対パスを、コードでルートを探して補わない。drizzle-kit は cwd 基準のままなので、アプリだけが別の場所を指す。cwd に依らせたいなら絶対パスで渡す (`docs/guides/database.md`「パスを cwd 基準にする理由」)
- `createDb()` で無い DB のファイルを作らない。作った空の DB は最初のクエリで落ち、ページは 500 の汎用のエラー画面になるだけで、ログにも出ない (`docs/guides/database.md`「DB のファイルをアプリで作らない理由」)
- migration のフォルダは `src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` から読み、`./drizzle` を書き写さない。drizzle-kit の `out` と `migrateDb()` の片方だけが変わると、テストが古い migration を当てたまま通る

## migration の適用

- `migrateDb()` をアプリの経路から呼ばない。適用の経路が drizzle-kit とアプリの 2 か所に分かれる。起動時の適用に変えるときは、起動の経路での `migrateDb()`、`createDb()` の `fileMustExist` を外すこと、`MIGRATIONS_FOLDER` の絶対パス化の 3 つを揃える (`docs/guides/database.md`「migration を起動時に適用しない理由」)
