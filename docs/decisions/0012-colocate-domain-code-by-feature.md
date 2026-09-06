# ADR-0012: ドメインに属するコードは `src/features/<domain>/` へ集め、環境はファイル名の接尾辞で宣言する

- Status: Accepted
- Date: 2026-09-06
- 関連: ADR-0011 (server function のデータ境界)

## Context

`src/server/` は「server 専用モジュール」と定義されていたが、その配下の `createServerFn` 宣言は client から import される正当な経路だった。
定義と実態が食い違い、`vite.config.ts` の `importProtection` が除外をコメントで説明する形になっていた。

環境の境界を決めているのはディレクトリではない。
`@tanstack/start-plugin-core` 1.171.39 の import protection は specifier・ファイル名パターン・marker の 3 経路で判定する (`dist/esm/vite/import-protection-plugin/plugin.js` が `type: "specifier"` / `"file"` / `"marker"` を立てる)。
既定のファイル名パターンは `dist/esm/import-protection/defaults.js` が返す `client: { files: ["**/*.server.*"] }` / `server: { files: ["**/*.client.*"] }` で、**既定にディレクトリは入らない**。
ディレクトリ単位で止まるのは `files` へ glob を書いたときだけで、機構がディレクトリを特別扱いすることはない。

同居させても遮断が保たれることを 2 パターンで確認した (2026-09-06)。

| プローブ                                                                                          | 結果                                                                           |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| client component が `*.server.ts` を直接 import する                                              | `vp build` が `[import-protection] Import denied in client environment` で失敗 |
| `functions.ts` が `createServerFn` で包まない handler を再 export し、client がそれを import する | 同じく失敗。`Denied by file pattern: **/*.server.*`                            |

つまり client-safe なファイルと server 専用のファイルを同じディレクトリに置いても遮断は保たれる。遮断の観点では、ディレクトリを分けても得られるものは無い。

接尾辞を落としたときに何が残るかは、`vite.config.ts` の `importProtection` 次第である。
user が `files` を指定すると既定を置換する (同 `plugin.js` の `pick`)。マージされるのは `client.specifiers` だけで、`server.specifiers` と `excludeFiles` は置換になる。
このリポジトリは `files: ["**/src/server/db/**", "**/*.server.*"]` を指定しているので、`src/server/db/` を引く実処理は接尾辞を外しても前者が止める (2026-09-06 に改名して実測、`Denied by file pattern: **/src/server/db/**`)。
接尾辞が唯一の防壁になるのは、外部 API や secret だけを扱って `src/server/db/` を引かない実処理を足したときである。

### 公式の指針とその限界

公式スキル `@tanstack/start-client-core#start-core/server-functions` の File Organization は、エンティティ接頭辞つきのファイルを 1 ディレクトリへ並べ、環境を接尾辞で宣言する形を示す (`users.functions.ts` / `users.server.ts` / `schemas.ts`)。
同 `start-core/auth-server-primitives` は横断的なものを `src/server/` 直下へ並べる (`session.ts` / `auth-middleware.ts` / `login.functions.ts`)。

どちらもエンティティを 1 つしか示しておらず、増えたときの区切り方を持たない。
スキーマに至っては `schemas.ts` 1 ファイルをエンティティ間で共有する形である。

### エコシステムの実例

ドメインが複数ある実アプリは、いずれもディレクトリで区切っている (2026-09-06 に確認)。

| リポジトリ                                | ドメインの区切り                                                               | 横断的な server コード                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| BearStudio/start-ui-web                   | `src/features/<domain>/` (client) と `src/server/routers/<domain>.ts` (server) | `src/server/` 直下 (`auth` / `email` / `logger` / `s3`) |
| mugnavo/tanstarter (Vite+ / Drizzle 構成) | `src/lib/<domain>/functions.ts`                                                | `src/lib/db/`                                           |
| Kiranism/tanstack-start-dashboard         | `src/features/<domain>/{api,components,schemas}`                               | —                                                       |

## Decision

**1 つのドメインに属するコードは `src/features/<domain>/` に集める。環境の宣言はファイル名の接尾辞が担う。**

| ファイル             | 役割                             | client から import           |
| -------------------- | -------------------------------- | ---------------------------- |
| `schema.ts`          | valibot スキーマ                 | 可                           |
| `queries.ts`         | TanStack Query の `queryOptions` | 可                           |
| `functions.ts`       | `createServerFn` の宣言          | 可                           |
| `handlers.server.ts` | 実処理 (DB アクセス)             | 不可 (`.server.` が遮断する) |

- ドメインに属さないものは分けたまま置く。server 基盤は `src/server/`、汎用ロジックは `src/lib/`、React 依存の hook は `src/hooks/`
- ドメインの UI は `src/routes/<domain>/` が持つ。file-based routing が既にドメイン単位なので `src/features/` へ移さない
- `src/features/<domain>/` 内部の import は相対パスで書く

### 検討した選択肢

| 案                                                               | 評価                                                                                                                                    | 採否     |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ドメインをディレクトリで区切り、環境を接尾辞で宣言する           | ドメインが増えても 1 ディレクトリに収まる。スキルの「まとめる」「接尾辞で宣言する」を保ち、まとめ方だけを接頭辞からディレクトリへ替える | **採用** |
| スキルどおり接頭辞つきファイルをフラットに並べる                 | スキルに忠実だが、スキル自身がエンティティ 1 つしか示していない。ドメインが増えると 1 ディレクトリに平たく積む                          | 却下     |
| client と server をトップレベルで分け、その中をドメインで区切る  | server 側を一望できるが、1 ドメインが 2 ツリーに割れる。環境をディレクトリで表す形は遮断機構と対応しない                                | 却下     |
| 現状を保ち `.claude/rules/directory-structure.md` の文言だけ直す | 差分は最小だが、テンプレートから作るプロジェクトへ構造の指針を渡さない                                                                  | 却下     |
| ドメインディレクトリを `src/lib/` の下に置く                     | 新しいトップレベルを増やさないが、`src/lib/` の「React 非依存の汎用ロジック」という定義に `.server.ts` が入る                           | 却下     |

## Consequences

- ドメインが増えても `src/lib/` と `src/server/` は平たくならない。増えるのは `src/features/` 直下のディレクトリ 1 つ
- サンプル機能を消すとき、ドメインの本体が `src/features/notes/` と `src/routes/notes/` の 2 ディレクトリに収まる。`src/server/db/schema.ts` や `drizzle/` のように外に残るものは `README.md`「サンプル機能を残すか決める」が持つ
- `src/server/` は「ドメインに属さないもの」になり、ディレクトリ名が環境を語らなくなる。そのため `importProtection` が client から import できるファイルを除外として説明する必要も無くなった
- client-safe なファイルと `.server.ts` が同居する。安全性は同居しないことではなく接尾辞を必ず付けることに依存するので、規範として `.claude/rules/server-functions.md` に置いた
- `vite.config.ts` の `importProtection.client.files` から `"**/*.server.*"` を落とすと、既定が復活せず接尾辞の遮断が消える。`excludeFiles` も同じで、書いた瞬間に既定の `**/node_modules/**` が消える
- 横断的な server function を足すときは `src/server/` 直下に置く。ドメイン 1 つに属するかどうかが判断の分かれ目
- 再評価条件: TanStack Start が既定でディレクトリ単位の環境境界を持ったとき。既定の判定材料にディレクトリが入らないという本 ADR の前提が変わる

## 出典

- 遮断の 3 経路の判定と user 設定の合成: `@tanstack/start-plugin-core` 1.171.39 の `dist/esm/vite/import-protection-plugin/plugin.js` (2026-09-06 に確認)
- 既定の遮断規則: 同 1.171.39 の `dist/esm/import-protection/defaults.js` (2026-09-06 に確認)
- File Organization: intent skill `@tanstack/start-client-core#start-core/server-functions` (`library_version` 1.170.14、2026-09-06 に確認)
- 横断的な server コードの配置: intent skill `@tanstack/start-client-core#start-core/auth-server-primitives` (同 1.170.14、2026-09-06 に確認)
- エコシステムの実例: https://github.com/BearStudio/start-ui-web / https://github.com/mugnavo/tanstarter / https://github.com/Kiranism/tanstack-start-dashboard (いずれも 2026-09-06 に確認)
