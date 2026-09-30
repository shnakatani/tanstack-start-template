# データベース

SQLite のファイルへ drizzle で接続し、migration を適用する手順と、パスと migration の扱いをその形にしている理由を持つ。

| 決定                                                                                     | ADR      |
| ---------------------------------------------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                        | ADR-0004 |
| フロントで使うスキーマはテーブル定義から作らず、テーブル定義の型と型テストで突き合わせる | ADR-0034 |

## how-to

### 接続先を決める

- 接続先は環境変数 `DB_FILE_NAME` で決まる。既定は `.mise.toml` の `[env]` が `config_root` から組む絶対パスで、どのディレクトリから起動しても同じ DB を指す (ADR-0004)
- アプリは `src/server/db/index.ts` の `createDb()` で開く。`DB_FILE_NAME` が未設定なら throw する
- `createDb()` は DB のファイルを作らない。無ければ開こうとした絶対パスを示して throw する。作るのは `mise run db:migrate` (「DB のファイルをアプリで作らない理由」)
- mise の `[env]` が読まれない環境 (本番の起動など) では、`DB_FILE_NAME` を絶対パスで渡す。相対パスは起動した cwd を基準に解決される (「パスを cwd 基準にする理由」)
- 相対パスをコードでルートを探して補わない。drizzle-kit は cwd 基準のままなので、アプリだけが別の場所を指す

### スキーマを変える

- `src/server/db/schema.ts` を変えたら、`mise run db:generate` の後に `mise run db:migrate` を打つ。各タスクのコマンドは `.mise.toml` にある
- アプリは起動時に migration を適用せず、`migrateDb()` もアプリの経路から呼ばない。デプロイの手順に `mise run db:migrate` を入れる (「migration を起動時に適用しない理由」)
- `mise run db:migrate` は drizzle-kit (devDependencies)、`drizzle.config.ts`、`drizzle/` を使う。ビルド成果物の `.output/` はどれも持たないので、DB のファイルがあるホストにリポジトリと依存を置いて打つ
- migration のフォルダは `src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` を `drizzle.config.ts` の `out` と `migrateDb()` の両方が読む。片方だけ変えると、テストが古い migration を当てたまま通る
- テーブルを足したら、テーブル定義とフロントのスキーマの型を突き合わせる型テストを書く (ADR-0034)

### 起動時に migration を適用する形に変える

[drizzle docs「Migrations」][] の Option 4 に当たる (「migration を起動時に適用しない理由」)。次の表のものを揃える。

| 変えるもの                                                                                                    | 理由                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 起動の経路で `migrateDb()` を呼ぶ                                                                             | 今はテストだけが呼ぶ                                                                                                                                          |
| `createDb()` の `fileMustExist` と、無いときの throw を外す                                                   | 初回の起動では DB のファイルがまだ無い。作らないと起動の時点で落ちる                                                                                          |
| `drizzle/` をサーバーに置き、`src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` をその絶対パスにする | `.output/` は `drizzle/` を持たない。相対パスのままだと起動した cwd を基準に探す                                                                              |
| 開く前に DB のディレクトリを作る (`mkdirSync(dirname(<DB のパス>), { recursive: true })`)                     | better-sqlite3 はディレクトリを作らず、無いと `Cannot open database because the directory does not exist` で落ちる (better-sqlite3 13.0.3、2026-09-29 に実測) |
| デプロイの手順から `mise run db:migrate` を外す                                                               | 適用の経路が 2 か所に分かれる                                                                                                                                 |

### テストで使う

- テストでは `createDb(":memory:")` で開き、`migrateDb()` で `drizzle/` の migration を当てる。ファイルを作らず、テストの間で状態が残らない
- `migrateDb()` が読む `MIGRATIONS_FOLDER` は `./drizzle` で、cwd を基準に解決される。`vp test run` はリポジトリのルートで走るので、テストからはこのまま読める

## explanation

### DB のファイルをアプリで作らない理由

アプリは migration を当てない。アプリが無い DB を作ると、テーブルの無い空の DB を開くことになる。

| 案                                                     | 評価                                                                                                                                                                                                                                                             | 採否     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 無ければ作らずに、開こうとしたパスをログに残して落とす | 開こうとした絶対パスを `createDb()` が server のログに残し、作り方を例外の文言に出す (2026-09-29 に `.output/server/index.mjs` を起動して実測)。作らないことは better-sqlite3 の `fileMustExist` が保証する ([better-sqlite3 docs「API」][] の `new Database()`) | **採用** |
| 無ければ作る (better-sqlite3 の既定)                   | テーブルの無い空の DB ができ、最初のクエリが `no such table` で落ちる。ログには出るが、どの DB を開いたかも作り方も出ない                                                                                                                                        | 却下     |

`fileMustExist` の失敗の文言は `unable to open database file` で、開こうとしたパスを含まない (better-sqlite3 13.0.3、2026-09-29 に実測)。ディレクトリを指していても `existsSync` は真を返す。そのため `createDb()` は開く前にファイルかを確かめ、絶対パスを server のログに残す。パスを例外の文言に入れないのは、文言が client に返るためである (`docs/guides/server-functions.md`「例外を global の function middleware で残す理由」)

### パスを cwd 基準にする理由

drizzle まわりはどれも相対パスを cwd 基準で扱う (2026-09-29 に確認)。

| 対象                    | 相対パスの扱い                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| drizzle の docs         | migration のフォルダを相対パスのまま渡す (`migrate(db, { migrationsFolder: "./migrations" })`、[drizzle docs「Node.js + Railway」][]) |
| drizzle-orm の migrator | 受け取ったパスを解決せずに `fs` へ渡す (0.45.2 の [drizzle-orm の `migrator.ts`][])                                                   |
| drizzle-kit             | `drizzle.config.ts` を cwd から探し、`out` と `dbCredentials.url` を cwd 基準で使う (0.31.10)                                         |

| 案                                                   | 評価                                                                                                                                                                                 | 採否     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 相対パスを cwd 基準で解決する                        | drizzle と drizzle-kit と同じ基準になる。相対パスが残る入口はどれもルートで走る                                                                                                      | **採用** |
| cwd から上へ `package.json` を探し、そこを基準にする | アプリだけが別の基準になり、サブディレクトリから起動すると drizzle-kit とずれる。ビルド成果物の `.output/server/` にも `package.json` があり、その中で起動するとそこをルートとみなす | 却下     |

`DB_FILE_NAME` の既定は相対パスにせず、`.mise.toml` で `config_root` から組む。[mise docs「Templates」][] は "`config_root` stays at the project root when you run mise from a subdirectory" と書き、プロジェクトからの相対パスにはこちらを使うよう勧める。worktree はそれぞれ `.mise.toml` を持つので、worktree ごとに別の DB になる。

相対パスが残るのは `MIGRATIONS_FOLDER` と、drizzle-kit の設定の探索と設定の中の `schema` である。これらを使う入口がルートで走ることの根拠は次のとおり。

| 入口                            | 根拠                                                                                                                                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run <タスク>`             | タスクの `dir` の既定は `{{ config_root }}` ([mise docs「Task Configuration」][] の `dir`)                                                                                                                                                           |
| `vp run <script>`               | サブディレクトリから打ってもパッケージのルートで走る (2026-09-29 に vp 1.0.0 で実測)                                                                                                                                                                 |
| `vp test run`                   | Vitest 5 は親のディレクトリの設定を探さない ([Vite+ docs「Vitest v5」][])。サブディレクトリで打つと設定が読まれず、`@/` の import が解決できない。`--config` で渡しても project の設定のパスが解決できず、起動しない (2026-09-29 に vp 1.0.0 で実測) |
| `node .output/server/index.mjs` | 起動した cwd がそのまま基準になる。[TanStack Start docs「Hosting」][] は `start` script から起動する形を示す                                                                                                                                         |
| (参考) Nitro の SQLite の既定   | 本番は cwd を基準に `.data/db.sqlite` を組む。[Nitro の `database.ts`][] は開発時だけ `cwd: rootDir` を渡し、[db0 の `node-sqlite.ts`][] は `resolve(opts.cwd \|\| ".", ...)` で組む ([Nitro docs「Database」][])                                    |

### migration を起動時に適用しない理由

[drizzle docs「Migrations」][] は migration の扱いを 6 つの選択肢に分ける (2026-09-29 に確認)。このテンプレートは Option 3 (`drizzle-kit generate` で SQL を作り、`drizzle-kit migrate` で適用する) を採る。

| 案                                                | 評価                                                                                                      | 採否     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Option 3: `drizzle-kit migrate` で適用する        | 適用する経路が drizzle-kit の 1 か所になる。スキーマを変える手順も `db:generate` と `db:migrate` で閉じる | **採用** |
| Option 4: アプリの起動時に `migrate()` で適用する | 適用する経路が drizzle-kit とアプリの 2 か所になる                                                        | 却下     |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[drizzle docs「Migrations」]: https://orm.drizzle.team/docs/migrations
[better-sqlite3 docs「API」]: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
[drizzle docs「Node.js + Railway」]: https://orm.drizzle.team/docs/tutorials/node-railway-pg
[drizzle-orm の `migrator.ts`]: https://github.com/drizzle-team/drizzle-orm/blob/0.45.2/drizzle-orm/src/migrator.ts
[mise docs「Templates」]: https://mise.jdx.dev/templates.html
[mise docs「Task Configuration」]: https://mise.jdx.dev/tasks/task-configuration.html
[Vite+ docs「Vitest v5」]: https://viteplus.dev/guide/vitest-v5
[TanStack Start docs「Hosting」]: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
[Nitro docs「Database」]: https://nitro.build/docs/database
[Nitro の `database.ts`]: https://github.com/nitrojs/nitro/blob/main/src/config/resolvers/database.ts
[db0 の `node-sqlite.ts`]: https://github.com/unjs/db0/blob/main/src/connectors/node-sqlite.ts
