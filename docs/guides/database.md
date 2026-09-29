# データベース

SQLite のファイルへ drizzle で接続し、migration を適用する手順と、パスと migration の扱いをその形にしている理由を持つ。

| 決定                                                                                         | ADR      |
| -------------------------------------------------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                            | ADR-0004 |
| ドメインに属するコードは `src/features/<domain>/` へ集め、環境はファイル名の接尾辞で宣言する | ADR-0010 |
| フロントで使うスキーマはテーブル定義から作らず、テーブル定義の型と型テストで突き合わせる     | ADR-0034 |

## how-to

### 接続先を決める

- 接続先は環境変数 `DB_FILE_NAME` で決まる。値は `.mise.toml` の `[env]` が持つ。アプリは `src/server/db/index.ts` の `createDb()` で開き、未設定なら throw する
- 相対パスは cwd を基準に解決する。アプリも drizzle-kit も、起動したディレクトリから `DB_FILE_NAME` と `drizzle/` を引く (「パスを cwd 基準にする理由」)
- 起動はリポジトリのルートから行う。`mise run` のタスクと `vp run` の script はルートで走るので、どこから打ってもよい
- 本番で `.output/server/index.mjs` を `node` で直接起動するときは、cwd を `DB_FILE_NAME` の基準にしたいディレクトリにする。違う場所で起動すると空の DB ができ、最初のクエリが `no such table` で落ちる
- cwd に依らない場所に置きたいときは、`DB_FILE_NAME` を絶対パスで渡す。コードでルートを探して補わない

### スキーマを変える

- `src/server/db/schema.ts` を変えたら `mise run db:generate` で `drizzle/` に migration を作り、`mise run db:migrate` で DB へ適用する
- アプリは起動時に migration を適用しない。デプロイの手順に `mise run db:migrate` を入れる (「migration を起動時に適用しない理由」)
- テーブルを足したら、テーブル定義とフロントのスキーマの型を突き合わせる型テストを書く (ADR-0034)

### テストで使う

- テストでは `createDb(":memory:")` で開き、`migrateDb()` で `drizzle/` の migration を当てる。ファイルを作らず、テストの間で状態が残らない
- `migrateDb()` を呼ぶのはテストだけにする。アプリの経路で呼ぶと、migration の適用が drizzle-kit とアプリの 2 か所に分かれる

## explanation

### パスを cwd 基準にする理由

drizzle の docs は、migration のフォルダを相対パスのまま渡す (`migrate(db, { migrationsFolder: "./migrations" })`、[drizzle docs「Node.js + Railway」][])。drizzle-orm 0.45.2 の migrator も、受け取ったパスを解決せずに `fs` へ渡す。drizzle-kit も `drizzle.config.ts` を cwd から探し、`out` と `dbCredentials.url` を cwd 基準で使う。

| 案                                                   | 評価                                                                                                                                                                   | 採否     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 相対パスを cwd 基準で解決する                        | drizzle と drizzle-kit と同じ基準になる。入口はどれもルートで走る                                                                                                      | **採用** |
| cwd から上へ `package.json` を探し、そこを基準にする | アプリだけが別の基準になり、サブディレクトリから起動すると drizzle-kit とずれる。ビルド成果物の `.output/server/` にも `package.json` があり、本番ではルートを指さない | 却下     |

入口がルートで走ることの根拠は次のとおり。

| 入口                            | 根拠                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run <タスク>`             | タスクの `dir` の既定は `{{ config_root }}` ([mise docs「Task Configuration」][] の `dir`)                                                                                    |
| `vp run <script>`               | サブディレクトリから打ってもパッケージのルートで走る (2026-09-29 に vp 1.0.0 で実測)                                                                                          |
| `vp test run`                   | Vitest 5 は親のディレクトリの設定を探さない ([Vite+ docs「Vitest v5」][])。`--config` で渡しても project の設定のパスが解決できず、起動しない (2026-09-29 に vp 1.0.0 で実測) |
| `node .output/server/index.mjs` | 起動した cwd がそのまま基準になる。[TanStack Start docs「Hosting」][] は `start` script から起動する形を示す                                                                  |

本番で cwd を基準にするのは Nitro の SQLite の既定とも同じである。[Nitro docs「Database」][] は "In Node.js production, it uses the default SQLite path." と書き、その既定のパスは [db0 の `better-sqlite3.ts`][] が `resolve(opts.cwd || ".", ...)` で cwd から組む。

### migration を起動時に適用しない理由

[drizzle docs「Migrations」][] は migration の扱いを 6 つの選択肢に分ける。このテンプレートは Option 3 (`drizzle-kit generate` で SQL を作り、`drizzle-kit migrate` で適用する) を採る。

| 案                                                | 評価                                                                                                             | 採否     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- |
| Option 3: `drizzle-kit migrate` で適用する        | 適用する経路が drizzle-kit の 1 か所になる。スキーマを変える手順も `db:generate` と `db:migrate` で閉じる        | **採用** |
| Option 4: アプリの起動時に `migrate()` で適用する | 適用する経路が drizzle-kit とアプリの 2 か所になる。docs は "widely used for **monolithic** applications" と書く | 却下     |

1 つのプロセスでしか起動しない利用者が起動時の適用に変えるなら、`migrateDb()` を起動の経路から呼び、デプロイの手順から `mise run db:migrate` を外す。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[drizzle docs「Migrations」]: https://orm.drizzle.team/docs/migrations
[drizzle docs「Node.js + Railway」]: https://orm.drizzle.team/docs/tutorials/node-railway-pg
[mise docs「Task Configuration」]: https://mise.jdx.dev/tasks/task-configuration.html
[Vite+ docs「Vitest v5」]: https://viteplus.dev/guide/vitest-v5
[TanStack Start docs「Hosting」]: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
[Nitro docs「Database」]: https://nitro.build/docs/database
[db0 の `better-sqlite3.ts`]: https://github.com/unjs/db0/blob/main/src/connectors/better-sqlite3.ts
