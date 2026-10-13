# データベース

SQLite のファイルへ drizzle で接続し、migration を適用し、dev 用の見本のデータを入れる手順と、パスと migration と見本のデータの扱いをその形にしている理由を持つ。

| 決定                                                                                     | ADR      |
| ---------------------------------------------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                        | ADR-0004 |
| フロントで使うスキーマはテーブル定義から作らず、テーブル定義の型と型テストで突き合わせる | ADR-0034 |

## how-to

### 接続先を決める

- 接続先は環境変数 `DB_FILE_NAME` で決まる。既定は `.mise.toml` の `[env]` が `config_root` から組む絶対パスで、どのディレクトリから起動しても同じ DB を指す (ADR-0004)
- アプリは `src/server/db/index.ts` の `createDb()` で開く。`DB_FILE_NAME` が未設定なら throw する
- `createDb()` は DB のファイルを作らない。無ければ開こうとした絶対パスを示して throw する。作るのは `vp run db:migrate` (「DB のファイルをアプリで作らない理由」)
- mise の `[env]` が読まれない環境 (本番の起動など) では、`DB_FILE_NAME` を絶対パスで渡す。相対パスは起動した cwd を基準に解決される (「パスを cwd 基準にする理由」)
- 相対パスをコードでルートを探して補わない。drizzle-kit は cwd 基準のままなので、アプリだけが別の場所を指す

### スキーマを変える

- `src/server/db/schema.ts` を変えたら、`vp run db:generate` の後に `vp run db:migrate` を打つ。各タスクのコマンドは `.mise.toml` にある
- アプリは起動時に migration を適用せず、`migrateDb()` もアプリの経路から呼ばない。デプロイの手順に `vp run db:migrate` を入れる (「migration を起動時に適用しない理由」)
- `vp run db:migrate` は drizzle-kit (devDependencies)、`drizzle.config.ts`、`drizzle/` を使う。ビルド成果物の `.output/` はどれも持たないので、DB のファイルがあるホストにリポジトリと依存を置いて打つ
- migration のフォルダは `src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` を `drizzle.config.ts` の `out` と `migrateDb()` の両方が読む。片方だけ変えると、テストが古い migration を当てたまま通る
- テーブルを足したら、テーブル定義とフロントのスキーマの型を突き合わせる型テストを書く (ADR-0034)

### 見本のデータを入れる

- `vp run db:seed` で、`DB_FILE_NAME` の DB に dev server で確かめるための見本を入れる。タスクは `dependsOn` で先に `db:migrate` を走らせる ([Vite+ docs「Run Config」][] の `dependsOn`) ので、DB のファイルが無い状態からも 1 回で入る
- 打つたびに、見本を持つテーブルの行を全部消して入れ直す。dev server の画面から作った行も消える。何度打っても、行と、次に作る行の id は同じになる (「見本のデータを消して入れ直す理由」)
- dev server を開いたまま打ったら、ブラウザを再読み込みする。query のキャッシュが新鮮なうちは、focus でも遷移で戻っても DB から読み直さない ([TanStack Query docs「Important Defaults」][])。再読み込みでは、SSR がリクエストごとに `getRouter()` (`src/router.tsx`) で新しい `QueryClient` を作り、DB から読む
- 実行口は `scripts/db/seed.ts` の 1 つで、`createDb()` で DB を開き、`scripts/db/lib/seed-all.ts` の `seedAll()` を呼ぶ。`seedAll()` はトランザクションを 1 回だけ開き、その中でドメインごとの入れ方を呼ぶ。`createDb()` を通さずに `new Database()` で開かない。直接開くと、無い DB のファイルを作る (「DB のファイルをアプリで作らない理由」)
- ドメインに見本を足すときは、見本の配列と入れ方を `scripts/db/lib/<domain>-seed.ts` に置き、`seedAll()` から呼ぶ。`src/` に置かない (「見本のデータを `scripts/db/` に置く理由」)。置き場の決め方は `docs/guides/placement.md`「`scripts/` に関数と fixture を置く」
- `scripts/db/` から `src/` のテーブル定義・接続・ドメインの型は `@/` で import してよい。アプリのコード (`src/`) から `scripts/db/` は import しない。import すると、見本が出荷する bundle に入る
- 見本の配列には、テーブルの insert の型 (`$inferInsert`) ではなく、ドメインの読み出しの型 (`src/features/<domain>/schema.ts`) を付け、見本が読み出しの形と合うことを `vp check` で確かめる。insert の型は既定値を持つ列を省けるので、`createdAt` を書き忘れても型エラーにならず、打つたびに実行時刻が入る
- ドメインの入れ方は `seedAll()` が渡すトランザクションを受け、その中でテーブルの行の削除、`sqlite_sequence` のそのテーブルの行の削除、insert を打ち、入れたテーブルと行の数を返す。自分でトランザクションを開かない。開くと、ドメインごとに別のトランザクションになり、後のドメインが落ちたときに前のドメインだけが入れ直された状態で残る
- 外部キーで別のテーブルを指すテーブルに見本を足すときは、`seedAll()` の初めに `PRAGMA defer_foreign_keys = ON` を打つか、削除を子のテーブルから、insert を親のテーブルから打つ順に分ける ([SQLite「Pragma statements supported by SQLite」][] の `defer_foreign_keys`)。`createDb()` の接続は better-sqlite3 の同梱の SQLite の既定で外部キーを検査し (`db.$client.pragma("foreign_keys")` が 1、better-sqlite3 13.0.3、2026-10-14 に実測)、トランザクションの中で `PRAGMA foreign_keys = OFF` を打っても効かない ([SQLite「SQLite Foreign Key Support」][] の「Enabling Foreign Key Support」)
- 見本の id と作成日時・更新日時は固定の値で書く。日時を既定値に任せると、打つたびに実行時刻が入る
- 見本の各行がそのドメインの読み出しのスキーマを通ることを、同じディレクトリの `<domain>-seed.test.ts` で確かめる。`scripts-tools` project が集める。スキーマを変えたときに、見本が古くなったことにテストで気付ける
- ドメインを消すときは、`scripts/db/lib/<domain>-seed.ts` とそのテストを消し、`seedAll()` から import と呼び出しを外す。見本を持つドメインが無くなったら、`scripts/db/seed.ts`、`scripts/db/lib/seed-all.ts`、`vite.config.ts` の `db:seed`、`README.md` のコマンド一覧の行も消す。タスクとその行は検査に掛からないので、消し忘れても気付けない

### 起動時に migration を適用する形に変える

[drizzle docs「Migrations」][] の Option 4 に当たる (「migration を起動時に適用しない理由」)。次の表のものを揃える。

| 変えるもの                                                                                                    | 理由                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 起動の経路で `migrateDb()` を呼ぶ                                                                             | 今はテストだけが呼ぶ                                                                                                                                          |
| `createDb()` の `fileMustExist` と、無いときの throw を外す                                                   | 初回の起動では DB のファイルがまだ無い。作らないと起動の時点で落ちる                                                                                          |
| `drizzle/` をサーバーに置き、`src/server/db/migrations-folder.ts` の `MIGRATIONS_FOLDER` をその絶対パスにする | `.output/` は `drizzle/` を持たない。相対パスのままだと起動した cwd を基準に探す                                                                              |
| 開く前に DB のディレクトリを作る (`mkdirSync(dirname(<DB のパス>), { recursive: true })`)                     | better-sqlite3 はディレクトリを作らず、無いと `Cannot open database because the directory does not exist` で落ちる (better-sqlite3 13.0.3、2026-09-29 に実測) |
| デプロイの手順から `vp run db:migrate` を外す                                                                 | 適用の経路が 2 か所に分かれる                                                                                                                                 |

### テストで使う

- テストでは `createDb(":memory:")` で開き、`migrateDb()` で `drizzle/` の migration を当てる。ファイルを作らず、テストの間で状態が残らない
- `migrateDb()` が読む `MIGRATIONS_FOLDER` は `./drizzle` で、cwd を基準に解決される。`vp test run` はリポジトリのルートで走るので、テストからはこのまま読める

## explanation

### DB のファイルをアプリで作らない理由

アプリは migration を当てない。アプリが無い DB を作ると、テーブルの無い空の DB を開くことになる。

| 案                                                     | 評価                                                                                                                                                                                                                                                                                                    | 採否     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 無ければ作らずに、開こうとしたパスを文言に入れて落とす | 開こうとした絶対パスと作り方を `createDb()` が例外の文言に出し、例外は server function の middleware が server のログに残す (2026-10-01 に `.output/server/index.mjs` を起動して実測)。作らないことは better-sqlite3 の `fileMustExist` が保証する ([better-sqlite3 docs「API」][] の `new Database()`) | **採用** |
| 無ければ作る (better-sqlite3 の既定)                   | テーブルの無い空の DB ができ、最初のクエリが `no such table` で落ちる。ログには出るが、どの DB を開いたかも作り方も出ない                                                                                                                                                                               | 却下     |

`fileMustExist` の失敗の文言は `unable to open database file` で、開こうとしたパスを含まない (better-sqlite3 13.0.3、2026-09-29 に実測)。ディレクトリを指していても `existsSync` は真を返す。そのため `createDb()` は開く前にファイルかを確かめ、絶対パスを例外の文言に入れる。

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

| 入口                            | 根拠                                                                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp run <タスク>`               | タスクの `cwd` の既定はパッケージのルート ([Vite+ docs「Run Config」][] の `cwd`)                                                                                                                                                                              |
| `vp run <script>`               | サブディレクトリから打ってもパッケージのルートで走る (2026-09-29 に vp 1.0.0 で実測)                                                                                                                                                                           |
| `vp test run`                   | Vitest 5 は親のディレクトリの設定を探さない ([Vite+ docs「Upgrade to Vitest 5」][])。サブディレクトリで打つと設定が読まれず、`@/` の import が解決できない。`--config` で渡しても project の設定のパスが解決できず、起動しない (2026-09-29 に vp 1.0.0 で実測) |
| `node .output/server/index.mjs` | 起動した cwd がそのまま基準になる。[TanStack Start docs「Hosting」][] は `start` script から起動する形を示す                                                                                                                                                   |
| (参考) Nitro の SQLite の既定   | 本番は cwd を基準に `.data/db.sqlite` を組む。[Nitro の `database.ts`][] は開発時だけ `cwd: rootDir` を渡し、[db0 の `node-sqlite.ts`][] は `resolve(opts.cwd \|\| ".", ...)` で組む ([Nitro docs「Database」][])                                              |

### migration を起動時に適用しない理由

[drizzle docs「Migrations」][] は migration の扱いを 6 つの選択肢に分ける (2026-09-29 に確認)。このテンプレートは Option 3 (`drizzle-kit generate` で SQL を作り、`drizzle-kit migrate` で適用する) を採る。

| 案                                                | 評価                                                                                                      | 採否     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| Option 3: `drizzle-kit migrate` で適用する        | 適用する経路が drizzle-kit の 1 か所になる。スキーマを変える手順も `db:generate` と `db:migrate` で閉じる | **採用** |
| Option 4: アプリの起動時に `migrate()` で適用する | 適用する経路が drizzle-kit とアプリの 2 か所になる                                                        | 却下     |

### seed を tsx で走らせる理由

実行口は `createDb()` を通すので、`src/` のモジュールを読める走らせ方が要る。`src/` は `@/` の alias と、拡張子の無い相対 import で書かれている。

| 案                                 | 評価                                                                                                                                                                                                                                                                                                 | 採否     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `vp exec tsx`                      | [tsx docs][] は "It also supports `tsconfig.json` paths" と書く。`src/server/db/index.ts` も `src/` のドメインのモジュールも読めた (2026-10-14、tsx 4.23.15)                                                                                                                                         | **採用** |
| `vp node` (Node の type stripping) | [Node.js docs「Modules: TypeScript」][] は "features that depend on settings within `tsconfig.json`, such as paths ... are intentionally unsupported" と書き、import の拡張子を "mandatory" とする。`src/server/db/index.ts` の import で `ERR_MODULE_NOT_FOUND` になった (2026-10-14、Node 24.21.0) | 却下     |
| Vite の `runnerImport`             | `src/` を読めたが、型定義で `@experimental` とされている。入口を拡張子つきの import だけで別に書くことになる (2026-10-14、Vite+ 1.1.0 同梱の Vite 8.3.3)                                                                                                                                             | 却下     |

### seed に drizzle-seed を使わない理由

[drizzle docs「Seed Overview」][] は、見本のデータを作るライブラリとして drizzle-seed を案内する。

| 案                                                                        | 評価                                                                                                                                    | 採否     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 固定の配列を drizzle の `insert` で入れる                                 | 長いタイトルや空の本文のような、確かめたい値をそのまま書ける。どの値が入力のスキーマと CHECK を通るかを、配列の単体テストで確かめられる | **採用** |
| drizzle-seed                                                              | 下の表の制約があり、確かめたい値を作るには、どのみち全列を値の配列で渡すことになる                                                      | 却下     |
| custom migration に INSERT を書く ([drizzle docs「Custom migrations」][]) | 見本が migration の経路に乗り、本番の DB にも入る                                                                                       | 却下     |

drizzle-seed の制約は次のとおり (2026-10-14、drizzle-seed 0.3.1、drizzle-orm 0.45.4、better-sqlite3 13.0.3 で実測)。

| 項目           | 振る舞い                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 版             | drizzle-orm 0.45 系と組めるのは 0.3.1 だけ。0.4.0 の peer は `drizzle-orm >=1.0.0-beta.1` ([drizzle-seed の npm][])        |
| CHECK          | 読まない。TEXT の列に英数字の乱数を入れ、暦の日付の CHECK を持つ列で `CHECK constraint failed` になって 1 行も入らなかった |
| 既定値を持つ列 | 型ごとの乱数で上書きする。作成日時と更新日時は 2022〜2026 年の乱数になり、更新日時が作成日時より前の行も出た               |
| 日本語         | 生成器が作るのは英数字の乱数と、英語の名前・地名・lorem ipsum だけ。日本語は `valuesFromArray` で値の配列を渡すしかない    |
| `reset`        | 行を消すだけで `sqlite_sequence` を戻さない。次にアプリが作る行の id は、消す前の最大値から続く                            |

### 見本のデータを `scripts/db/` に置く理由

見本の配列と入れ方は、出荷するアプリのコードではなく、dev server で確かめるための開発の道具である。

| 案                                                                                   | 評価                                                                                                                                                                     | 採否     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 実行口と見本を `scripts/db/` に置く                                                  | 開発の道具が出荷物のディレクトリの外にまとまる。どの build の入口からも辿られず、`vp build` の成果物に入らない (2026-10-14 に `.output/` を見本の文字列で grep して実測) | **採用** |
| 見本をドメインのディレクトリの `seed.server.ts` に、実行口を `src/server/db/` に置く | ドメインと一緒に消せるが、出荷しない道具がプロダクトコードの層に混ざる。`.server.` は実行環境の宣言で、開発用であることの目印にならない                                  | 却下     |

### 見本のデータを消して入れ直す理由

`vp run db:seed` は、何度打っても同じ状態に戻す。dev server で一覧を確かめる前に打つので、前回の確認で作った行が残ると、画面の見え方が打つたびに変わる。

| 案                                                                                              | 評価                                                                                                                                                                                 | 採否     |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1 つのトランザクションで、行を全部消し、`sqlite_sequence` の行を消し、id と日時を明示して入れる | 行も、次に作る行の id も、打つたびに同じになる。手で作った行も消える                                                                                                                 | **採用** |
| 行を全部消し、id と日時を既定値に任せて入れる                                                   | id が前の最大値の続きになり、日時が実行時刻になる。打つたびに中身が変わる (2026-10-14 に実測)                                                                                        | 却下     |
| 行を全部消し、id と日時を明示して入れる (`sqlite_sequence` に触らない)                          | 行は同じになるが、`sqlite_sequence` が消した行の最大の id を覚えたままになり、seed のあとに作る行の id が飛ぶ (2026-10-14 に実測)                                                    | 却下     |
| DB のファイルを消し、`db:migrate` で作り直してから入れる                                        | 削除の順も `sqlite_sequence` も一度に片付くが、dev server は開いた接続を持ち続けるので消したファイルを読み続け、再読み込みしても新しいファイルの行が画面に出ない (2026-10-14 に実測) | 却下     |
| 固定の id で upsert し、消さない                                                                | 手で作った行が残り、決めた状態に戻らない。drizzle の `$onUpdate` を持つ列は、`set` に書かなくても実行時刻に書き換わる (2026-10-14 に実測)                                            | 却下     |

- `sqlite_sequence` は AUTOINCREMENT の列が使った最大の id を持つ表で、通常の DELETE で書き換えられる ([SQLite「SQLite Autoincrement」][])。同じ節は、書き換えると採番を乱しうると注意する。採用の形では、表の行を全部消したあとに消すので、採番は入れ直した見本の最大の id から続く

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[drizzle docs「Migrations」]: https://orm.drizzle.team/docs/migrations
[better-sqlite3 docs「API」]: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
[drizzle docs「Node.js + Railway」]: https://orm.drizzle.team/docs/tutorials/node-railway-pg
[drizzle-orm の `migrator.ts`]: https://github.com/drizzle-team/drizzle-orm/blob/0.45.2/drizzle-orm/src/migrator.ts
[mise docs「Templates」]: https://mise.jdx.dev/templates.html
[Vite+ docs「Run Config」]: https://github.com/voidzero-dev/vite-plus/blob/v1.1.0/docs/config/run.md
[Vite+ docs「Upgrade to Vitest 5」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/vitest-v5.md
[TanStack Start docs「Hosting」]: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
[Nitro docs「Database」]: https://nitro.build/docs/database
[Nitro の `database.ts`]: https://github.com/nitrojs/nitro/blob/main/src/config/resolvers/database.ts
[db0 の `node-sqlite.ts`]: https://github.com/unjs/db0/blob/main/src/connectors/node-sqlite.ts
[TanStack Query docs「Important Defaults」]: https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults
[tsx docs]: https://tsx.is/
[Node.js docs「Modules: TypeScript」]: https://nodejs.org/docs/latest-v24.x/api/typescript.html
[drizzle docs「Seed Overview」]: https://orm.drizzle.team/docs/seed-overview
[drizzle docs「Custom migrations」]: https://orm.drizzle.team/docs/kit-custom-migrations
[drizzle-seed の npm]: https://www.npmjs.com/package/drizzle-seed
[SQLite「SQLite Autoincrement」]: https://www.sqlite.org/autoinc.html
[SQLite「SQLite Foreign Key Support」]: https://www.sqlite.org/foreignkeys.html
[SQLite「Pragma statements supported by SQLite」]: https://www.sqlite.org/pragma.html
