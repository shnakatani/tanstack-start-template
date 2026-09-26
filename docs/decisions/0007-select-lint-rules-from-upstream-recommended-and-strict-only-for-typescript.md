# ADR-0007: ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする

- Status: Accepted
- Date: 2026-09-27
- 関連: ADR-0014 (React Compiler の診断ルールの扱い)、ADR-0023 (色の統制に足す `@shadcn/lint`)、ADR-0008 (テスト専用コードの import 境界)

## Context

oxlint のカテゴリ (`correctness` / `perf` / `pedantic` / `style` / `restriction` / `suspicious` / `nursery`) は、oxlint 実装者がルールを分類した軸であって、プロジェクトが検査を選ぶ軸ではない。
カテゴリを丸ごと有効にすると、`pedantic` のように上流自身が recommended から外したルールまで入り、何を残すかの判断を全件こちらで負うことになる。

型情報を要るルールは 7 カテゴリすべてに散っており、カテゴリ単位では「型検査を強める」という意図を表現できない。

## Decision

カテゴリ単位で有効にするのは `correctness` と `perf` に限る。
それ以外は、プラグインごとの上流 recommended を基準に `rules` へ名指しで足す。

### 基準にする上流設定

有効にしていないプラグインも、有効化する時点でこの表の基準に従う。

| プラグイン        | 基準                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| eslint コア       | `@eslint/js` の `recommended` + typescript-eslint の `eslint-recommended` が error にする 4 ルール                                         |
| `typescript`      | typescript-eslint の `strict` と `strict-type-checked`                                                                                     |
| `react`           | eslint-plugin-react の `recommended` と `jsx-runtime`。React Compiler 由来のルールだけは eslint-plugin-react-hooks の `recommended-latest` |
| `import`          | eslint-plugin-import の `recommended`                                                                                                      |
| `promise`         | eslint-plugin-promise の `recommended`                                                                                                     |
| `jsdoc`           | eslint-plugin-jsdoc の `recommended-typescript`                                                                                            |
| `vitest`          | `@vitest/eslint-plugin` の `recommended`                                                                                                   |
| `jsx-a11y`        | eslint-plugin-jsx-a11y の `recommended`                                                                                                    |
| `tanstack-query`  | `@tanstack/eslint-plugin-query` の `recommended`。strict から `prefer-query-options` だけを足す。型情報が要る `no-void-query-fn` は除く    |
| `tanstack-router` | `@tanstack/eslint-plugin-router` の `recommended`                                                                                          |
| `unicorn`         | 選定しない。`correctness` と `perf` に入る分だけ使う                                                                                       |
| `oxc`             | 上流に対応する設定がない。`correctness` と `perf` で拾う                                                                                   |

`@shadcn/lint` はこの表に載らない。oxlint ネイティブではなく `jsPlugins` 経由で、基準も recommended ではなく設計判断と対にしたルールを名指しするためである (ADR-0023)。

`testing-library` もこの表に載らない。基準は上流の `flat/react` を写すが、適用を story と story 専用の helper に限り、基準から外すルールがある (`docs/guides/lint/configuration.md`「testing-library を当てる範囲」)。

browser mode 側の待機は `vitest` プラグインが持つ。`require-awaited-expect-poll` が `expect.element` を対象にしており、`correctness` カテゴリ経由で既に有効である。

eslint コアへの追加 4 ルール (`no-var` / `prefer-const` / `prefer-rest-params` / `prefer-spread`) は、TypeScript が `var` と `apply` を過去のものにし `const` と rest 引数がより良い型を与える、という typescript-eslint 側の判断を採ったもの。
`strict-type-checked` がこの variant (`eslint-recommended`) を内包するため typescript の基準としては入っているが、プラグイン別の基準表では eslint コアの欄に落ちる。
`@eslint/js` の `recommended` にも無いので、ここへ書かないと両方の欄から漏れる。

### typescript だけ strict を基準にする理由

silent failure の源として扱っている書き方を検出するルールが recommended に入っていない。
`array[expr]!` は lookup miss が `undefined` や `NaN` を後段へ流す経路で、`typescript/no-non-null-assertion` がその検出に対応する。
型の上でありえない条件分岐を検出する `typescript/no-unnecessary-condition` も同じ位置にある。
どちらも `strict-type-checked` には入り、`recommended-type-checked` には入らない。

名指しするルールは、基準がオプションを指定していればそのオプションも写す。
基準と違うオプションを置くときは、理由を `vite.config.ts` のそのルールのコメントに残す。

`restrict-template-expressions` は基準のオプションから `allowNumber` だけを true に戻して名指しする。
oxlint の既定はルール自身の既定 (`allow*` の 5 つが true) で、名指ししないと基準から外れる。
基準の `allowNumber: false` は浮動小数の表示 (`${0.1 + 0.2}`) を狙ったもので (typescript-eslint の issue 9311)、整数の埋め込みにも鳴る。2026-09-27 に基準の値で測ると `allowNumber` で 33 件鳴り、29 件が件数や id などの整数、4 件はテストの診断文に埋めた DOMRect の座標だった。利用者に見せる浮動小数の表示は、このルールに頼らず `toFixed()` などで書く。テストの診断文のように値そのものを見せたいものは丸めない。
`allowBoolean` は基準どおり false にする。`` `btn ${active && "active"}` `` は `active` が false のとき `"false"` を埋め込み、型が `false | "active"` なので `allowBoolean: true` では通る (2026-09-27 に oxlint 1.82.0 で実測)。typescript-eslint 本体の `eslint.config.mjs` はこのルールの `allow*` を 5 つとも true に戻しているが、`allowBoolean` の誤りを止めるため採らない。
なお `correctness` に入るルールも `rules` へ名指しすればオプションを上書きできる。名指ししないルールだけがカテゴリ既定で動く。

`correctness` にある type-aware ルールと `strict-type-checked` は包含関係ではなく、部分的に重なる別の集合である。基準を strict に置いても oxlint 独自の `correctness` 選択は失わない。

上流が前提ごとに config を分けている場合は、このプロジェクトの前提に合う variant まで指定する。variant の表と、TypeScript 向けの off を写さない理由は `docs/guides/lint/configuration.md`「前提ごとの variant まで下ろす」にある。

### React Compiler のルールは eslint-plugin-react-hooks を基準にする

oxlint 1.79 で `react/react-compiler` は廃止され、React Compiler の診断は 22 のルールへ分割された (oxc-project/oxc#25500)。
分割後のルールは oxlint の `react` プラグインに属するが、上流は eslint-plugin-react ではなく eslint-plugin-react-hooks である。
`recommended` ではなく `recommended-latest` を基準に採る。差は `void-use-memo` の 1 ルールで、oxlint はこれを `correctness` に置いており、`recommended` を基準にしても外す先がない。

上流 `recommended-latest` は 17 ルールで、うち 13 は oxlint の `correctness` に入りカテゴリ経由で error になる (React Compiler 由来の 12 と `exhaustive-deps`)。
残る 4 の扱いは次のとおり。

| 上流 `recommended-latest` の残り | oxlint のカテゴリ | 有効化           |
| -------------------------------- | ----------------- | ---------------- |
| `rules-of-hooks`                 | `pedantic`        | `rules` へ名指し |
| `unsupported-syntax`             | `restriction`     | `rules` へ名指し |
| `config` / `gating`              | 実装なし          | —                |

上流が既定 off にするルールのうち oxlint に実装があるものは有効にしない (`perf` 経由で入る 1 つを除く)。一覧は `docs/guides/lint/configuration.md`「React Compiler の既定 off のルール」にある。

`unsupported-syntax` だけを `restriction` から引き上げるのは、これが Compiler の未実装ではなく「対応する予定がない構文」(`this` / `with` / インライン `class` 宣言) を指すためである。
書き換えれば消えるのでコード側の欠陥として扱える。上流も `todo` を off にしたまま、このルールだけ recommended に入れている。

jsx-a11y は上流 recommended のルールが全て `correctness` 経由で有効になり、名指しがゼロになる。扱いは `docs/guides/lint/configuration.md`「jsx-a11y は名指しがゼロになる」にある。

### unicorn を選定しない理由

unicorn は recommended に含めるルールの数が他プラグインと桁違いに多く、そのまま基準にすると合わないものを選り分ける判断が他プラグインとは別の規模になる。
参照した他の共有 config も、recommended をそのまま全部採る例は見当たらない。
oxc 自身の設定と同じく、`correctness` と `perf` に入る分だけを使う。

### 基準から外れる名指し

recommended に無くても、規約や他の決定を機械で守るために足すルールがある。

| ルール                                  | 名指しの理由                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `typescript/consistent-type-assertions` | `assertionStyle: "never"` の指定が要る                                                                                     |
| `no-restricted-imports`                 | `*.test-helpers.ts` と `src/test/` をアプリのコードから import させない (ADR-0008)                                         |
| `tanstack-query/prefer-query-options`   | recommended-strict だけにある。useQuery 系にインラインの queryKey / queryFn を書かせず、queryOptions の 1 か所で定義させる |

テスト専用コードの import を止める範囲と手段の比較は ADR-0008 が持つ。

`react/rules-of-hooks` と `react/unsupported-syntax` はここに載らない。どちらも基準 (eslint-plugin-react-hooks) に入っており、oxlint のカテゴリが `correctness` / `perf` の外にあるだけである (「React Compiler のルールは eslint-plugin-react-hooks を基準にする」)。

基準で有効なルールを off にしてよい条件と、テストファイルで緩める 5 つのルールは `docs/guides/lint/configuration.md`「ルールを off にする」「テストファイルの緩和」にある。

### 検討した選択肢

| 案                                                  | 評価                                                                                           | 採否     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| プラグインごとの上流 recommended を基準に名指しする | 含める含めないの判断を上流の共有設定に委ねられる                                               | **採用** |
| カテゴリ単位で有効にし、合わないものを off にする   | カテゴリは好みが分かれるルールを多く含み、何を残すかの判断を全件負う                           | 却下     |
| 必要になったルールだけを都度足す                    | 選定の基準が残らず、何を検査していないかも読み取れない                                         | 却下     |
| oxlint が recommended 相当の preset を出すまで待つ  | 追跡 issue (oxc-project/oxc#20758) が着地するまで選定を止められない。preset が出たら再評価する | 却下     |
| 顕在化した違反を実害なしとして見送る                | 実害がないのは現在のコードについてだけ。index key の事故に React は実行時警告を出さない        | 却下     |

## Consequences

- `correctness` と `perf` へのルール追加は次の `vp check` で自動的に入る。この 2 カテゴリだけが opt-out である。依存更新で違反が増えたら、修正するか off にするかを判断する
- 名指ししたルールは `rules` に並ぶため、上流 recommended の改訂には自動追随しない。追随の手順は `docs/guides/lint/configuration.md`「上流 recommended の改訂に追随する」にある
- 名指ししたルールが oxlint 側で改名・廃止されると `vp lint` が設定のパースで落ちる (`Rule 'react-compiler' not found in plugin 'react'`)。取りこぼしは起きないが、更新の PR は lint が動かない状態から始まる
- 有効カテゴリは `scripts/checks/integrity/lint-config.test.ts` が解決後設定の値で押さえる。カテゴリで有効になったルールは `rules` に名指ししないので、書いたルールとの突き合わせでは脱落を拾えない
- TanStack の 2 plugin は JS plugin で載せる。oxlint にネイティブの実装は無く、ネイティブ化を求めた oxc の issue 11648 は discussion へ移され、実装は入っていない (2026-09-26 に oxc の issue と PR を検索)。JS plugin は型情報を受け取れないので、型情報を使う `no-void-query-fn` は入れず、`no-rest-destructuring` は型情報を使うケースを見逃す
- `prefer-query-options` は `QueryClient` のメソッド呼び出しを、client の出どころを同じファイルの `useQueryClient()` か `new QueryClient()` まで辿れたときだけ検査する。引数や router の context で受け取った client の呼び出しと、定数で渡した `queryKey` は検査されない (`@tanstack/eslint-plugin-query` 5.103.2 のルールの実装と、2026-09-26 の probe で確認)
- 上流が warn にしているルールは error で入れる。`vp check` は警告では落ちない

## 出典

- typescript-eslint の共有設定: https://typescript-eslint.io/users/configs/
- テストディレクトリでの off と `strict-type-checked` 上でのオプション上書きを含む上流本体の設定: https://github.com/typescript-eslint/typescript-eslint/blob/main/eslint.config.mjs
- oxc 自身の lint 設定 (`categories` は correctness と perf だけ、個別ルールは `rules` に列挙): https://github.com/oxc-project/oxc/blob/main/oxlintrc.json
- oxlint の recommended preset 追跡 issue: https://github.com/oxc-project/oxc/issues/20758
- React Compiler 診断の per-category ルール分割 (22 ルールとカテゴリの一覧): https://oxc.rs/blog/2026-08-18-react-compiler-support
- eslint-plugin-react-hooks のルール一覧と preset: https://react.dev/reference/eslint-plugin-react-hooks
- Rendering Lists (index を key にする問題に実行時警告がないこと): https://react.dev/learn/rendering-lists
- `only-throw-error` と TanStack Router の衝突に対する公式の案内: https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
- `@tanstack/eslint-plugin-query` のルールと設定: https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query
- `prefer-query-options`: https://tanstack.com/query/latest/docs/eslint/prefer-query-options
- `@tanstack/eslint-plugin-router`: https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
- oxlint の JS plugin が型情報を扱えないこと: https://oxc.rs/docs/guide/usage/linter/js-plugins
- oxlint の JS plugin での TanStack Query の適合テスト: https://github.com/oxc-project/oxc/pull/26698
- oxlint へ `@tanstack/eslint-plugin-query` のネイティブ化を求めた issue: https://github.com/oxc-project/oxc/issues/11648
- `restrict-template-expressions` の strict の `allowNumber: false` の理由: https://github.com/typescript-eslint/typescript-eslint/issues/9311
