# ADR-0034: フロントで使うスキーマはテーブル定義から作らず、テーブル定義の型と型テストで突き合わせる

- Status: Accepted
- Date: 2026-09-28
- 関連: ADR-0010 (`importProtection` が `src/server/db/` をクライアントから止める)、ADR-0013 (ドメイン型は valibot スキーマから導出する)

## Context

drizzle で DB を持つと、同じデータの形が drizzle のテーブル定義と valibot のスキーマの 2 か所に書かれる。書き込みは、insert に入力スキーマの型の値を渡す箇所で型検査を受けるので、DB が値を入れない NOT NULL の列を足すとそこで型エラーになる。読み出しには同じ型検査が無い。テーブルに列を足してもスキーマを変え忘れると、型検査も lint も落ちない。読み出し口の検証が `v.object` なら、足した列を黙って捨てて成功し、実行時にも食い違いが表に出ない。

drizzle は、テーブル定義から valibot のスキーマを作る関数を持つ。drizzle docs「valibot」は `createSelectSchema` / `createInsertSchema` / `createUpdateSchema` を示し、第 2 引数で項目ごとに制約を足せる。drizzle-orm 1.0.0-beta.15 から別パッケージの `drizzle-valibot` は非推奨になり、`drizzle-orm/valibot` に統合された。

ただし、入力スキーマはフロントでも実行時に使う。フォームの項目ごとの validator、送信値を作る `v.parse` (TanStack Form docs「Submission Handling」)、mutation の値の検証、`v.metadata` から読む項目の呼称 (ADR-0013) はどれも、スキーマの値をブラウザで動かす。型だけの import では済まない。

スキーマをテーブル定義から作ると、テーブル定義と drizzle の本体がクライアントの bundle に入る。2026-09-28 に、5 列 (整数の id、文字列 2 列、日付の文字列、`timestamp_ms` の日時) のテーブル 1 つを持つテンプレートで `vp build` を回し、クライアントの出力 (`.output/public/assets/` の js の合計。gzip 後の値は Vite の表示) を比べた。B と C は、テーブル定義の写しをクライアントから import できる場所に一時的に置いてスキーマのモジュールから参照し、C はさらに `drizzle-valibot` 0.4.2 を入れて `createInsertSchema` を呼んだ (drizzle-orm 0.45.2、valibot 1.4.2)。drizzle 1.0 の `drizzle-orm/valibot` では測っていない。

| 状態                                          | js の合計 | gzip 後   | A との差 (gzip) |
| --------------------------------------------- | --------- | --------- | --------------- |
| A. テンプレートのまま                         | 883.80 kB | 283.07 kB | —               |
| B. A にテーブル定義を足す                     | 900.63 kB | 287.74 kB | +4.67 kB        |
| C. B に `createInsertSchema` の呼び出しを足す | 910.01 kB | 290.06 kB | +6.99 kB        |

増えたのは、どれもエントリの chunk (`index-*.js`) だった。計測した構成では、スキーマのモジュールを route の `validateSearch` が import していた。`validateSearch` は分割されない property なので (ADR-0010)、スキーマのモジュールを分割されない property から import すると、エントリの chunk に入る。

上流もこの問題を認識しているが、公式の解決策は無い。

- drizzle-team/drizzle-orm#941「Codegen for zod schemas」(2023-07-26 から open) は、生成したスキーマをクライアントで使うと "`drizzle-zod` and `drizzle-orm` being in the client bundle. That's more than 20 KB gzipped" になると指摘し、コード生成を提案した。メンテナは同じ日に "a non-target for us for the moment. Feel free to implement it as a 3rd party package" と答えている。同じ issue には、DB のスキーマがクライアントに漏れるという懸念 (2024-04-19) もある
- 同じ issue のコメントに、スキーマを手で書き、テーブル定義から作った形と `satisfies` で型を突き合わせる回避策がある (2023-11-12)
- drizzle-team/drizzle-orm#5773 (2026-05-17 から open) は、テーブル定義を JSON にできるデータとして取り出す `getTableMetadata` を足してコード生成の土台にする提案で、実際の Vite のアプリで "~56 KB gzipped on first load" と計測している
- 第三者のコード生成ツール (`drizzle-zod-to-code`、`vite-plugin-zod-decoupling`) は zod 向けで、`$type<…>()` や `default()` の型を落とすと同じ issue で報告されている。valibot 向けのツールは、issue にも npm にも見当たらない (2026-09-28 に `npm search` で「drizzle valibot generate」「drizzle codegen zod schema file」を検索)
- valibot のスキーマは関数を持つ値なので (valibot docs「Parse data」の "Each schema has a `~run` method")、JSON のように書き出せない。ビルド時に埋め込むには、スキーマを組み立て直すコードを生成する仕組みが要り、コード生成の案と同じになる

## Decision

フロントで実行時に使うスキーマは、テーブル定義から作らない。valibot で書き、テーブル定義から推論される読み出しの型と型テストで突き合わせる。

- 型テストはテーブルごとに `expectTypeOf<typeof <テーブル>.$inferSelect>().toEqualTypeOf<<読み出しのスキーマの型>>()` の 1 行にする。TypeScript の型の上で、項目の有無、null を許すか、型のどれがずれても落ちる
- 書き込みの型 (`$inferInsert`) は突き合わせない。insert の呼び出し箇所の型検査が止める (Context)
- 型テストはテーブル定義のファイルの隣に `schema.test-d.ts` として置く。テーブル定義を import できるのはサーバー側とテストだけで (ADR-0010)、落とすのは `vp check` の type-aware lint である
- 項目ごとの制約 (長さ、trim、メッセージ、呼称) は valibot のスキーマだけが持つ。DB の CHECK 制約と、同じ TypeScript の型になる保存の形の違い (`integer` の `timestamp` と `timestamp_ms` はどちらも `Date`) は、推論される型に現れないので、この突き合わせの対象外である

ADR-0013 は、手書きの型とスキーマを型テストで突き合わせる案を却下し、型をスキーマから導出して出処を 1 つにした。テーブル定義とスキーマについては、出処を 1 つにする手段 (テーブル定義からスキーマを作る) がバンドルの理由で取れないので、突き合わせる形を採る。

### 検討した選択肢

| 案                                                                                                | 評価                                                                                                                                                                                                                                                                                                                                                        | 採否     |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| スキーマは valibot で書き、テーブル定義の読み出しの型と型テストで突き合わせる                     | クライアントの bundle は増えない。項目の有無、null を許すか、型のずれを `vp check` で止められる                                                                                                                                                                                                                                                             | **採用** |
| スキーマ全体をテーブル定義から作る (`drizzle-orm/valibot`)                                        | 公式の用法で出処も 1 つになるが、フロントがスキーマを実行時に使うので、エントリの chunk が gzip で約 7 kB 増える (Context の C)。テーブル定義をクライアントへ出すことになり、drizzle-team/drizzle-orm#941 が挙げる DB のスキーマの漏えいに当たる。ADR-0010 の `importProtection` (`**/src/server/db/**`) の範囲も狭める必要がある                           | 却下     |
| サーバーの validator だけテーブル定義から作り、フロントは共有の項目スキーマから `v.object` を組む | server function の validator はクライアント向けのビルドから消えるので bundle は増えない (TanStack/router の `packages/start-plugin-core/tests/createServerFn/` の client 向けの snapshot)。ただし項目ごとの制約は DB に無く、共有の項目スキーマに手で書くことは変わらない。結び付くものは採用案と同じで、経路と依存だけが増え、drizzle 1.0 で書き直しも要る | 却下     |
| コード生成 (第三者のツールか自作)                                                                 | valibot 向けのツールが無く、zod 向けのツールも型を落とす (Context)。自作すると、生成器という検査の道具を保守することになる                                                                                                                                                                                                                                  | 却下     |
| 読み出し口のスキーマを `v.strictObject` にし、余分な列を実行時に弾く                              | drizzle の `select()` はテーブル定義の列を名前で列挙するので (2026-09-28 に `toSQL()` で、テーブル定義の列を並べた `select` を確認し、`ALTER TABLE` で足した列が行に出ないことも確かめた)、読み出し口に届く余分な項目は、テーブル定義にあってスキーマに無い列だけである。それは型テストが `vp check` で止めるので、捕まえる範囲は増えない                   | 却下     |

## Consequences

- テーブル定義とスキーマのずれ (項目、null、型) は、`vp check` で型エラーになる。2026-09-28 に 4 通りのずれ (NULL 可の列を足す、DB が値を入れない NOT NULL の列を足す、NULL 可の列を NOT NULL にする、入力スキーマに項目を足す) を入れ、どれも型テストの行で落ちることを確かめた。`integer` の列の mode を `timestamp_ms` から `timestamp` へ変えたときは落ちなかった (Decision の対象外)
- 項目ごとの制約は突き合わせの対象外である。スキーマの長さの上限を変えても DB には伝わらない。SQLite「Datatypes In SQLite」は、型名の後の括弧の数値は "are ignored by SQLite" で、"SQLite does not impose any length restrictions (other than the large global SQLITE_MAX_LENGTH limit)" と書く。DB でも長さを守るなら CHECK 制約を書く
- テーブル定義は `src/server/db/` に置いたままで、`importProtection` も変えない
- 再評価の条件: drizzle が公式にスキーマのコード生成を持ったら (drizzle-team/drizzle-orm#5773 のマージか、drizzle-team/drizzle-orm#941 の対応)、出処をテーブル定義 1 つにする案を見直す

## 出典

| 出典                                                                                                                                                               | 使った内容                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| drizzle docs「valibot」 https://orm.drizzle.team/docs/valibot                                                                                                      | `createSelectSchema` / `createInsertSchema` と第 2 引数の制約。`drizzle-valibot` は 1.0.0-beta.15 から非推奨 |
| drizzle-team/drizzle-orm#941 https://github.com/drizzle-team/drizzle-orm/issues/941                                                                                | クライアントの bundle に入る問題、メンテナの回答、型で突き合わせる回避策、第三者のツールの限界               |
| drizzle-team/drizzle-orm#5773 https://github.com/drizzle-team/drizzle-orm/pull/5773                                                                                | `getTableMetadata` の提案と、実アプリでの計測 (~56 KB gzipped)                                               |
| valibot docs「Parse data」 https://valibot.dev/guides/parse-data/                                                                                                  | スキーマは `~run` を持つ値である                                                                             |
| TanStack Start docs「Import Protection」 https://tanstack.com/start/latest/docs/framework/react/guide/import-protection                                            | import の連鎖をたどって止める。型だけの import は止めない                                                    |
| SQLite「Datatypes In SQLite」 https://www.sqlite.org/datatype3.html                                                                                                | 列の型の長さの指定は効かない                                                                                 |
| TanStack/router の `packages/start-plugin-core/tests/createServerFn/` https://github.com/TanStack/router/tree/main/packages/start-plugin-core/tests/createServerFn | client 向けの出力で server function の validator が消える                                                    |
