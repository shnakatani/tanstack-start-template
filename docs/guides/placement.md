# 配置と境界

新しいファイルをどのディレクトリに置くか、route ファイルをどう組むかの手順と落とし穴を持つ。
ドメインのコードを `src/features/<domain>/` に集めて環境を接尾辞で宣言する決定と、route の property を route ファイルから export しない決定は ADR-0014、コンポーネントを役割で分けて design system の境界をディレクトリで示す決定は ADR-0015 が持つ。

## how-to

### route の中の置き場

その URL 配下だけで使うものは、route ファイルの隣の `-` で始まるディレクトリに置く。`-` で始まるディレクトリは routeTree の生成から外れる。

| 置くもの                                                                              | 置き場所                     |
| ------------------------------------------------------------------------------------- | ---------------------------- |
| `Route` と、Route hooks (`Route.useSearch` など) を吸収する export しない wrapper     | route ファイル               |
| ページ本体と、その URL 配下だけで使うコンポーネント                                   | `routes/<path>/-components/` |
| コンポーネントでないモジュール (行の組み立て、列定義、dialog の handle、純粋関数、型) | `routes/<path>/-lib/`        |
| React hook (`use-*`)                                                                  | `routes/<path>/-hooks/`      |
| テストと fixture                                                                      | 対象と同じディレクトリ       |

- `-lib/` と `-hooks/` は、`src/lib/` と `src/hooks/` の線引きを route の中で繰り返したものである
- `-` で始まるディレクトリの中の import は相対パスで書く。ディレクトリごと動かしても import が壊れない
- 実例は `src/routes/notes/` (`index.tsx`、`-components/notes-page.tsx`、`-lib/note-rows.ts`)

### route ファイルを組む

ADR-0014 の「route の property を export しない」に沿って、次の順で組む。

1. ページ本体を `-components/` に書き、Route hooks を使わずに props で値を受ける。Route hooks を混ぜると、ページのテストが router 無しで描けなくなる
2. route ファイルに export しない wrapper を置き、Route hooks の値をページ本体の props へ渡す。wrapper のテストは ADR-0046 の形で書く
3. loader は `createFileRoute` の options に直接書く。関数に切り出すと `context` と `deps` の型を手で書くことになる
4. pending 表示は、ページ本体と別のファイルに置く。`pendingComponent` は分割されない property で、それが import する module は eager に読まれる
5. loader と `validateSearch` とページ本体が共有する定数は `-lib/` に置き、ページ本体の module に置かない (理由は 4 と同じ)

### features か route か

置き場所は消費者で決める。

| 条件                                                 | 置き場所                                        |
| ---------------------------------------------------- | ----------------------------------------------- |
| その route だけが使う                                | route 側 (`-components/` / `-lib/` / `-hooks/`) |
| 複数の画面から使う                                   | `src/features/<domain>/`                        |
| ドメインの形 (schema、mutation) と同じ場所に居るべき | `src/features/<domain>/`                        |

画面の描画の形 (一覧の行モデル) は route 側、mutation の variables を絞る parser は `src/features/<domain>/` になる。
`src/features/<domain>/` の中の import も相対パスで書き、ディレクトリごと移せる形を保つ。

### server function の置き場

- 1 つのドメインに属する server function は `src/features/<domain>/functions.ts` に宣言し、実処理を `handlers.server.ts` に置く
- 宣言と実処理を 1 ファイルにまとめない。実処理を、server function を経由せずに単体テストできる側に残す (実例は `src/features/notes/handlers.test.ts`)
- ドメインに属さない横断的な server function は `src/server/` 直下に置く。1 つのドメインに属するかどうかが分かれ目になる

### `src/components/ui/` に付随ファイルを置く

registry 由来でない付随ファイル (`*.test.*` / `*.stories.*` / `*.test-helpers.*` / `*.story-helpers.*`) は `src/components/ui/` に置いてよい。`shadcn add` の出力に含まれないので baseline を持たず、registry の網羅検査の対象にならない。付随ファイルの種別は `scripts/lib/companion-files.ts` が定義する。

## 落とし穴

| 落とし穴                                                         | 起きること                                                                                                 | 避け方                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `vite.config.ts` の `importProtection.client.files` を書き換える | user が `files` を書くと既定を置換する。`"**/*.server.*"` を落とすと既定は戻らず、接尾辞による遮断が消える | 書き換えるときは `"**/*.server.*"` を残す (ADR-0014) |
| `importProtection` に `excludeFiles` を書く                      | 書いた時点で既定の `**/node_modules/**` が消える                                                           | 既定の値も自分で書き足す                             |
| `src` の外のファイルに Tailwind の utility を書く                | scan の対象が `src` に絞られているので、その utility の CSS は生成されない。気付くのは効かないときだけ     | utility を書くファイルは `src` の中に置く (ADR-0051) |
