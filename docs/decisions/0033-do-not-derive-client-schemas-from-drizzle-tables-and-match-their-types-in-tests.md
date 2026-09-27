# ADR-0033: フロントで使うスキーマはテーブル定義から作らず、テーブル定義の型と型テストで突き合わせる

- Status: Accepted
- Date: 2026-09-28
- 関連: ADR-0010 (`importProtection` が `src/server/db/` をクライアントから止める)、ADR-0013 (ドメイン型は valibot スキーマから導出する)

## Context

notes の形は、drizzle のテーブル定義 (`src/server/db/schema.ts`) と valibot のスキーマ (`src/features/notes/schema.ts`) の 2 か所に書かれている。書き込みは、`src/features/notes/handlers.server.ts` の `insert(notes).values(data)` が `NoteInput` を受けるので、DB が値を入れない NOT NULL の列を足すとそこで型エラーになる。読み出しには同じ型検査が無い。テーブルに列を足してもスキーマを変え忘れると、型検査も lint も落ちない。読み出し口の `v.safeParse` (`src/features/notes/handlers.server.ts`) が使う `noteSchema` は `v.object` なので、足した列を黙って捨てて成功し、実行時にも食い違いが表に出ない。

drizzle は、テーブル定義から valibot のスキーマを作る関数を持つ。drizzle docs「valibot」は `createSelectSchema` / `createInsertSchema` / `createUpdateSchema` を示し、第 2 引数で項目ごとに制約を足せる。drizzle-orm 1.0.0-beta.15 から別パッケージの `drizzle-valibot` は非推奨になり、`drizzle-orm/valibot` に統合された。

ただし、このスキーマはフロントでも実行時に使う。2026-09-28 に grep で確かめた箇所は次のとおりで、型だけの import では済まない。

| 場所                                                  | 使っているもの                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/routes/notes/-components/note-create-dialog.tsx` | `v.parse(noteInputSchema, value)` と、`noteInputSchema.entries.*` (項目ごとの validator) |
| `src/features/notes/creating-rows.ts`                 | `v.object({ variables: noteInputSchema, … })` (保存中の行の検証)                         |
| `src/routes/notes/-lib/note-columns.ts` ほか          | `NOTE_FIELD_LABELS` (`noteSchema.entries` の metadata から呼称を読む)                    |

スキーマをテーブル定義から作ると、テーブル定義と drizzle の本体がクライアントの bundle に入る。2026-09-28 に、プロジェクトの外の一時ディレクトリで測った。条件は次のとおりで、テンプレートの実際のビルド (Vite と Rolldown) と `drizzle-orm/valibot` では測っていない。

- 版: esbuild 0.25.12、drizzle-orm 0.45.2、drizzle-valibot 0.4.2、valibot 1.4.2
- ディレクトリの `package.json` は `"type": "module"` (テンプレートと同じ)。`"commonjs"` にするとエントリが CJS と判定されて drizzle-orm の tree-shaking が効かず、C の minify 後は 83,915 B になった
- テーブル定義は `src/server/db/schema.ts` の `notes` と同じ。A と B のスキーマは title・body・dueDate の 3 項目を `v.object` で組み、C は同じ 3 項目を `createInsertSchema` の第 2 引数に渡した
- コマンドは `esbuild <entry> --bundle --minify --format=esm --platform=browser`、gzip 後の値は `gzip -9 -c | wc -c`

| エントリ                                     | minify 後 | gzip 後  | A との差 (gzip) |
| -------------------------------------------- | --------- | -------- | --------------- |
| A. valibot だけでスキーマを組む              | 4,526 B   | 1,725 B  | —               |
| B. A にテーブル定義を足す                    | 27,307 B  | 7,730 B  | +6,005 B        |
| C. テーブル定義から `drizzle-valibot` で作る | 37,960 B  | 10,316 B | +8,591 B        |

上流もこの問題を認識しているが、公式の解決策は無い。

- drizzle-orm の issue 941「Codegen for zod schemas」(2023-07-26 から open) は、生成したスキーマをクライアントで使うと "`drizzle-zod` and `drizzle-orm` being in the client bundle. That's more than 20 KB gzipped" になると指摘し、コード生成を提案した。メンテナは同じ日に "a non-target for us for the moment. Feel free to implement it as a 3rd party package" と答えている。同じ issue には、DB のスキーマがクライアントに漏れるという懸念 (2024-04-19) もある
- 同じ issue のコメントに、スキーマを手で書き、テーブル定義から作った形と `satisfies` で型を突き合わせる回避策がある (2023-11-12)
- drizzle-orm の PR 5773 (2026-05-17 から open) は、テーブル定義を JSON にできるデータとして取り出す `getTableMetadata` を足してコード生成の土台にする提案で、実際の Vite のアプリで "~56 KB gzipped on first load" と計測している
- 第三者のコード生成ツール (`drizzle-zod-to-code`、`vite-plugin-zod-decoupling`) は zod 向けで、`$type<…>()` や `default()` の型を落とすと同じ issue で報告されている。valibot 向けのツールは、issue にも npm にも見当たらない (2026-09-28 に `npm search` で「drizzle valibot generate」「drizzle codegen zod schema file」を検索)
- valibot のスキーマは関数を持つ値なので (valibot docs「Parse data」の "Each schema has a `~run` method")、JSON のように書き出せない。ビルド時に埋め込むには、スキーマを組み立て直すコードを生成する仕組みが要り、コード生成の案と同じになる

## Decision

フロントで実行時に使うスキーマは、テーブル定義から作らない。valibot で書き、テーブル定義から推論される読み出しの型と型テストで突き合わせる。

- 型テストは `expectTypeOf<typeof notes.$inferSelect>().toEqualTypeOf<Note>()` の 1 行にする。TypeScript の型の上で、項目の有無、null を許すか、型のどれがずれても落ちる
- 書き込みの型 (`$inferInsert`) は突き合わせない。insert の呼び出し箇所の型検査が止める (Context)
- 型テストはテーブル定義の隣 (`src/server/db/schema.test.ts`) に置く。テーブル定義を import できるのはサーバー側とテストだけで (ADR-0010)、落とすのは `vp check` の type-aware lint である
- 項目ごとの制約 (長さ、trim、メッセージ、呼称) は valibot のスキーマだけが持つ。DB の CHECK 制約と、同じ TypeScript の型になる保存の形の違い (`integer` の `timestamp` と `timestamp_ms` はどちらも `Date`) は、推論される型に現れないので、この突き合わせの対象外である

ADR-0013 は、手書きの型とスキーマを型テストで突き合わせる案を却下し、型をスキーマから導出して出処を 1 つにした。テーブル定義とスキーマについては、出処を 1 つにする手段 (テーブル定義からスキーマを作る) がバンドルの理由で取れないので、突き合わせる形を採る。

### 検討した選択肢

| 案                                                                                                | クライアントの bundle                  | 結び付くもの                               | 採否     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------ | -------- |
| スキーマは valibot で書き、テーブル定義の型と型テストで突き合わせる                               | 増えない                               | 項目の有無、null を許すか、型              | **採用** |
| スキーマ全体をテーブル定義から作る (`drizzle-orm/valibot`)                                        | gzip で約 8.6 KB 増える (Context の C) | 出処が 1 つになる                          | 却下     |
| サーバーの validator だけテーブル定義から作り、フロントは共有の項目スキーマから `v.object` を組む | 増えない                               | 採用案と同じに、サーバーの検証の形が加わる | 却下     |
| コード生成 (第三者のツールか自作)                                                                 | 増えない                               | 出処が 1 つになる                          | 却下     |

- テーブル定義から作る案は、公式の用法であり出処も 1 つになるが、フロントの 3 か所がスキーマを実行時に使うので、drizzle の本体がクライアントに入る。テーブル定義もクライアントへ出すことになり、issue 941 が挙げる DB のスキーマの漏えいに当たる。ADR-0010 の `importProtection` (`**/src/server/db/**`) も、クライアントからのテーブル定義の import を止めているので、その範囲を狭める必要がある。Context の実測で、テーブル定義を足しただけで gzip の大きさは約 4.5 倍になった
- サーバーの validator だけテーブル定義から作る案は、server function の validator がクライアント向けのビルドから消えるので bundle は増えない (TanStack/router の `packages/start-plugin-core/tests/createServerFn/` の client 向けの snapshot で、`.validator(...)` が消えている)。ただし項目ごとの制約は DB に無いので、共有の項目スキーマに手で書くことは変わらない。結び付くものは型テストと同じで、スキーマを組む経路と依存だけが増える。drizzle 1.0 で `drizzle-valibot` から `drizzle-orm/valibot` へ移すときに書き直しも要る
- コード生成は、valibot 向けのツールが無く、zod 向けのツールも型を落とす (Context)。自作すると、生成器という検査の道具を保守することになる

## Consequences

- テーブル定義とスキーマのずれ (項目、null、型) は、`vp check` で型エラーになる。2026-09-28 に 4 通りのずれ (NULL 可の列を足す、DB が値を入れない NOT NULL の列を足す、期日を NOT NULL にする、入力スキーマに項目を足す) を入れ、どれも `src/server/db/schema.test.ts` の行で落ちることを確かめた。`created_at` の mode を `timestamp_ms` から `timestamp` へ変えたときは落ちなかった (Decision の対象外)
- 項目ごとの制約は突き合わせの対象外である。スキーマの長さの上限を変えても DB には伝わらない。SQLite「Datatypes In SQLite」は、型名の後の括弧の数値は "are ignored by SQLite" で、"SQLite does not impose any length restrictions (other than the large global SQLITE_MAX_LENGTH limit)" と書く。DB でも長さを守るなら CHECK 制約を書く
- テーブル定義は `src/server/db/` に置いたままで、`importProtection` も変えない
- 再評価の条件: drizzle が公式にスキーマのコード生成を持ったら (PR 5773 のマージか、issue 941 の対応)、出処をテーブル定義 1 つにする案を見直す

## 出典

| 出典                                                                                                                                                               | 使った内容                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| drizzle docs「valibot」 https://orm.drizzle.team/docs/valibot                                                                                                      | `createSelectSchema` / `createInsertSchema` と第 2 引数の制約。`drizzle-valibot` は 1.0.0-beta.15 から非推奨 |
| drizzle-orm の issue 941 https://github.com/drizzle-team/drizzle-orm/issues/941                                                                                    | クライアントの bundle に入る問題、メンテナの回答、型で突き合わせる回避策、第三者のツールの限界               |
| drizzle-orm の PR 5773 https://github.com/drizzle-team/drizzle-orm/pull/5773                                                                                       | `getTableMetadata` の提案と、実アプリでの計測 (~56 KB gzipped)                                               |
| valibot docs「Parse data」 https://valibot.dev/guides/parse-data/                                                                                                  | スキーマは `~run` を持つ値である                                                                             |
| TanStack Start docs「Import Protection」 https://tanstack.com/start/latest/docs/framework/react/guide/import-protection                                            | import の連鎖をたどって止める。型だけの import は止めない                                                    |
| SQLite「Datatypes In SQLite」 https://www.sqlite.org/datatype3.html                                                                                                | 列の型の長さの指定は効かない                                                                                 |
| TanStack/router の `packages/start-plugin-core/tests/createServerFn/` https://github.com/TanStack/router/tree/main/packages/start-plugin-core/tests/createServerFn | client 向けの出力で server function の validator が消える                                                    |
