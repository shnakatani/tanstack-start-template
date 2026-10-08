# 配置と境界

新しいファイルをどのディレクトリに置くか、route ファイルをどう組むかの手順と落とし穴と、その理由を持つ。

| 決定                                                                                         | ADR      |
| -------------------------------------------------------------------------------------------- | -------- |
| ドメインに属するコードは `src/features/<domain>/` へ集め、環境はファイル名の接尾辞で宣言する | ADR-0010 |
| テスト専用コードの import は `no-restricted-imports` で止める                                | ADR-0008 |

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

`-` で始める理由は「route の中の置き場を `-` で始める理由」。

### route ファイルを組む

ADR-0010 に沿って、次の順で組む。

1. ページ本体を `-components/` に書き、Route hooks を使わずに props で値を受ける。Route hooks を混ぜると、ページのテストが router 無しで描けなくなる
2. route ファイルに export しない wrapper を置き、Route hooks の値をページ本体の props へ渡す。wrapper のテストは `docs/guides/testing/route-wrappers.md`「route の wrapper をテストする」 の形で書く
3. loader は `createFileRoute` の options に直接書く。関数に切り出すと `context` と `deps` の型を手で書くことになる
4. pending 表示は、ページ本体と別のファイルに置く
5. loader と `validateSearch` とページ本体が共有する定数は `-lib/` に置き、ページ本体の module に置かない

2・4・5 の理由は「route ファイルの組み方と code splitting」。

- route ファイルを rename・移動しても、`createFileRoute` に渡すパスの文字列は手で書き換えない。TanStack Router の bundler plugin が書き換える ([TanStack Router docs「Routing Concepts」][] の Anatomy of a Route の "this path is automatically written and managed by the router for you via the TanStack Router Bundler Plugin or Router CLI.")

### features か route か

置き場所は消費者で決める。

| 条件                                                 | 置き場所                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| その route だけが使う                                | route 側 (`-components/` / `-lib/` / `-hooks/`)                                                                                                                                                                                     |
| 複数の画面から使う                                   | `src/features/<domain>/`                                                                                                                                                                                                            |
| ドメインの形 (schema、mutation) と同じ場所に居るべき | `src/features/<domain>/`                                                                                                                                                                                                            |
| どのドメインにも属さない                             | React に依存しない汎用ロジックと型は `src/lib/`、React の hook と、複数のファイルから使う React の context の定義は `src/hooks/`、server の基盤 (DB の接続とテーブルの定義を置く `src/server/db/` など) は `src/server/` (ADR-0010) |

画面の描画の形 (一覧の行モデル) は route 側、mutation の variables を絞る parser は `src/features/<domain>/` になる。
1 つの部品のファイルの中だけで使う context は、`src/hooks/` へ出さずにそのファイルに置く (`src/components/action/form.tsx`)。
`src/features/<domain>/` の中の import も相対パスで書き、ディレクトリごと移せる形を保つ。

### server function の置き場

- 1 つのドメインに属する server function は `src/features/<domain>/functions.ts` に宣言し、実処理を `handlers.server.ts` に置く
- 宣言と実処理を 1 ファイルにまとめない。実処理を、server function を経由せずに単体テストできる側に残す
- ドメインに属さない横断的な server function と、server だけで使う helper (`src/server/ssr-errors.ts` など) は `src/server/` 直下に置く。1 つのドメインに属するかどうかが分かれ目になる

### `src/components/ui/` に付随ファイルを置く

registry 由来でない付随ファイル (テスト・story とその helper) は `src/components/ui/` に置いてよい。`shadcn add` の出力に含まれないので baseline を持たず、registry の網羅検査の対象にならない。付随ファイルの種別は `scripts/lib/companion-files.ts` だけが定義する。種別を足すときは、そのファイルだけを直す。

### `src/test/` に helper を置く

ドメインを跨ぐテストの helper は、そのファイルが何を作るかで `src/test/` の下のディレクトリを選ぶ。誰が呼ぶかと、ファイル名の prefix (`a11y-*`、`viewport-*`) では選ばない。理由は「`src/test/` の helper を何を作るかで分ける理由」。

| 何を作るか                                                            | ディレクトリ        | 例                                                                |
| --------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| browser project の実行環境 (setup、config が読む定数)                 | `src/test/browser/` | `browser-setup.tsx`、`park-mouse.ts`、`viewport-sizes.ts`         |
| テスト本文が呼ぶ assert と実測、その引数の型                          | `src/test/assert/`  | `absent.ts`、`viewport.ts`、`screen-assertions.ts`                |
| axe の実行と結果の整形                                                | `src/test/a11y/`    | `a11y.ts`、`a11y-message.ts`                                      |
| アプリの依存 (router・QueryClient・mock・action) をテスト用に作る足場 | `src/test/app/`     | `create-test-router.tsx`、`query-client.ts`、`settling-action.ts` |

- config が読む定数は、テスト本文が使うものでも `browser/` に置く。assert の helper と同じファイルにすると、config が browser mode の import (`vite-plus/test/browser`) を引いて落ちる (`viewport-sizes.ts` の docstring)
- 1 つのファイルに役割が 2 つ混ざったら、ファイルを分けてそれぞれのディレクトリへ置く。混ざったファイルが残ると、次の helper を置くときの手本が 2 通りになる
- helper を持たず、全 project に効く実行環境 (root の globalSetup が決める TZ など) が効いていることだけを確かめるテストは、`src/test/` の直下に置く (`test-time-zone.tz.test.ts`)。上の表は helper が何を作るかで分けていて、テストだけのディレクトリは軸から外れる
- helper のテストは helper と同じディレクトリに置く。DOM が要るかで接尾辞を選ぶ (`docs/guides/testing/configuration.md`「テストの種別と置き場所」)
- ディレクトリ名と重なる prefix (`a11y/a11y-message.ts` の `a11y-`) は外さない。文書はファイル名だけで helper を指すことが多く、`story.ts` や `setup.tsx` のような名前はファイル名だけで引いたときに 1 つに決まらない
- `helpers`・`utils` のような中身を表さない名前にしない。役割が混ざった受け皿になり、上の「ファイルを分ける」が働かなくなる

### 部品専用のテスト helper を置く

特定の部品だけを扱う locator と fixture は、部品と同じディレクトリの `<部品>.test-helpers.ts` に置く。ドメインを跨ぐものは「`src/test/` に helper を置く」、story だけが使うものは `docs/guides/storybook.md`「story を置く」に従う。

- `routes/` の中では、対象と同じ `-components/` か `-lib/` に置く。route ファイル自身を扱う helper は route ファイルの隣に置く
- 同じ部品の locator を、2 つのテストで別々に書かない。ラベルを変えたときに片方だけが落ちる
- `.test-helpers` で終わるファイルはテスト専用コードで、アプリのコードからは import しない。`no-restricted-imports` が止める (ADR-0008)

### `scripts/` に関数と fixture を置く

スクリプトの純粋関数・定数・fixture の置き場所は、使う側で決める。上から順に当て、最初に当たった行で止める。

| 対象                                                                | 置き場所                     | 理由                                                                               |
| ------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| 検査の判定、または実行口の外 (config / 別ディレクトリ) から使うもの | `scripts/lib/`               | 実行口を 1 つ動かしても付いて回らない (`scripts/lib/response-headers.ts`)          |
| テストだけが使う fixture                                            | そのテストと同じディレクトリ | `scripts/lib/` に置くと共有物と見分けが付かない                                    |
| 1 つの実行口だけが使い、実行口と拡張子が違う                        | `scripts/<ツール>/` 直下     | 拡張子で見分けが付く                                                               |
| 1 つの実行口だけが使い、実行口と拡張子が同じ                        | `scripts/<ツール>/lib/`      | 直接実行するファイルと読まれるだけのファイルが見分けられない (`scripts/contrast/`) |

### 落とし穴

| 落とし穴                                                         | 起きること                                                                                                 | 避け方                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts` の `importProtection.client.files` を書き換える | user が `files` を書くと既定を置換する。`"**/*.server.*"` を落とすと既定は戻らず、接尾辞による遮断が消える | 書き換えるときは `"**/*.server.*"` を残す (ADR-0010)                                                              |
| `importProtection` に `excludeFiles` を書く                      | 書いた時点で既定の `**/node_modules/**` が消える                                                           | 既定の値も自分で書き足す                                                                                          |
| `src` の外のファイルに Tailwind の utility を書く                | scan の対象が `src` に絞られているので、その utility の CSS は生成されない。気付くのは効かないときだけ     | utility を書くファイルは `src` の中に置く (`docs/guides/styling-and-tokens.md`「scan と `theme(static)` の範囲」) |

## explanation

### route の中の置き場を `-` で始める理由

TanStack Router の file-based routing は、`-` で始まるファイルとディレクトリを route tree から外す。"Files and folders with the `-` prefix are excluded from the route tree. They will not be added to the `routeTree.gen.ts` file and can be used to colocate logic in route folders." ([TanStack Router docs「File Naming Conventions」][]、2026-09-28 に確認)。
この接頭辞は `@tanstack/router-plugin` の `routeFileIgnorePrefix` の既定値 `'-'` である (同梱の intent skill [`@tanstack/router-plugin` の `router-plugin/SKILL.md`][]、`library_version` 1.168.23)。`-components/` などに置くと、その URL の近くに置いたまま route として生成されない。

### route ファイルの組み方と code splitting

TanStack Router の automatic code splitting は、route ファイルの property を種類ごとに別の chunk へ分ける ([TanStack Router docs「Automatic Code Splitting」][]、2026-09-28 に確認)。組み方の 2・4・5 は、この分割を壊さないためにある (ADR-0010)。

| 手順                                                        | 分割の規則                                                                                                                                                                                                           | 守らないと起きること                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 2 (route ファイルから wrapper もページ本体も export しない) | "Route properties like `component`, `loader`, etc., should not be exported from the route file." ([TanStack Router docs「Automatic Code Splitting」][] の Rules of Splitting)                                        | export した property とそれが使うものが main bundle に入り、分割されない                          |
| 4 (pending 表示を別ファイルに置く)                          | 既定で分けるのは `component` / `errorComponent` / `notFoundComponent` だけで、`pendingComponent` と `loader` は route ファイルに残る ([TanStack Router docs「Automatic Code Splitting」][] の What gets code split?) | 分割されない property が import する module は eager に読まれ、同じ module のページ本体も巻き込む |
| 5 (共有する定数を `-lib/` に置く)                           | 同上。`loader` と `validateSearch` も分割されない                                                                                                                                                                    | 定数を置いたページ本体の module が、分割されない側から eager に読まれる                           |

- ページ本体を export したときに main chunk へ入ることを `vp build` で確かめた実測は ADR-0010 が持つ。`pendingComponent` と `validateSearch` が既定の groupings に入らない根拠 ([`@tanstack/router-plugin` の `core/constants.ts`][] の `defaultCodeSplitGroupings` と、[TanStack/router#4047][]) も ADR-0010 が持つ。intent skill [`@tanstack/router-core` の `router-core/code-splitting/SKILL.md`][] は `pendingComponent` を分割される側に挙げるが、[TanStack Router docs「Automatic Code Splitting」][] と実装では分割されない

### `src/test/` の helper を何を作るかで分ける理由

| 分類の軸                                     | 採否     | 理由                                                                                                          |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| 何を作るか (実行環境、assert、axe、足場)     | **採用** | 1 つのファイルは 1 つのものを作るので、置き先が 1 つに決まる                                                  |
| 誰が呼ぶか (setup、テスト本文)               | 却下     | 1 つの helper を setup とテスト本文の両方が呼ぶことがあり (`park-mouse.ts`)、呼び出し元では置き先が決まらない |
| ファイル名の prefix (`a11y-*`、`viewport-*`) | 却下     | prefix を持たない helper の置き先が決まらない                                                                 |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。[TanStack Router docs「Routing Concepts」][] の引用は 2026-10-06 に原文と照らした。

[TanStack Router docs「File Naming Conventions」]: https://tanstack.com/router/latest/docs/routing/file-naming-conventions
[`@tanstack/router-plugin` の `router-plugin/SKILL.md`]: https://github.com/TanStack/router/blob/@tanstack/router-plugin@1.168.40/packages/router-plugin/skills/router-plugin/SKILL.md
[TanStack Router docs「Automatic Code Splitting」]: https://tanstack.com/router/latest/docs/guide/automatic-code-splitting
[`@tanstack/router-plugin` の `core/constants.ts`]: https://github.com/TanStack/router/blob/@tanstack/router-plugin@1.168.40/packages/router-plugin/src/core/constants.ts
[TanStack/router#4047]: https://github.com/TanStack/router/pull/4047
[`@tanstack/router-core` の `router-core/code-splitting/SKILL.md`]: https://github.com/TanStack/router/blob/@tanstack/router-core@1.171.32/packages/router-core/skills/router-core/code-splitting/SKILL.md
[TanStack Router docs「Routing Concepts」]: https://tanstack.com/router/latest/docs/routing/routing-concepts
