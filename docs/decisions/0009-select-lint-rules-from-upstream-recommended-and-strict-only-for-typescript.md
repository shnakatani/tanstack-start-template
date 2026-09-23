# ADR-0009: ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0008 (プラグインの設定方法)、ADR-0016 (React Compiler の診断ルールの扱い)、ADR-0029 (色の統制に足す `@shadcn/lint`)、ADR-0010 (testing-library の適用範囲)、ADR-0011 (テスト専用コードの import 境界)、ADR-0018 (`no-misused-promises` が要求するハンドラの形)

## Context

oxlint のカテゴリ (`correctness` / `perf` / `pedantic` / `style` / `restriction` / `suspicious` / `nursery`) は、oxlint 実装者がルールを分類した軸であって、プロジェクトが検査を選ぶ軸ではない。
カテゴリを丸ごと有効にすると、`pedantic` のように上流自身が recommended から外したルールまで入り、何を残すかの判断を全件こちらで負うことになる。

型情報を要るルールは 7 カテゴリすべてに散っており、カテゴリ単位では「型検査を強める」という意図を表現できない。

## Decision

カテゴリ単位で有効にするのは `correctness` と `perf` に限る。
それ以外は、プラグインごとの上流 recommended を基準に `rules` へ名指しで足す。

### 基準にする上流設定

有効にしていないプラグインも、有効化する時点でこの表の基準に従う。

| プラグイン   | 基準                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| eslint コア  | `@eslint/js` の `recommended` + typescript-eslint の `eslint-recommended` が error にする 4 ルール                                         |
| `typescript` | typescript-eslint の `strict` と `strict-type-checked`                                                                                     |
| `react`      | eslint-plugin-react の `recommended` と `jsx-runtime`。React Compiler 由来のルールだけは eslint-plugin-react-hooks の `recommended-latest` |
| `import`     | eslint-plugin-import の `recommended`                                                                                                      |
| `promise`    | eslint-plugin-promise の `recommended`                                                                                                     |
| `jsdoc`      | eslint-plugin-jsdoc の `recommended-typescript`                                                                                            |
| `vitest`     | `@vitest/eslint-plugin` の `recommended`                                                                                                   |
| `jsx-a11y`   | eslint-plugin-jsx-a11y の `recommended`                                                                                                    |
| `unicorn`    | 選定しない。`correctness` と `perf` に入る分だけ使う                                                                                       |
| `oxc`        | 上流に対応する設定がない。`correctness` と `perf` で拾う                                                                                   |

`@shadcn/lint` はこの表に載らない。oxlint ネイティブではなく `jsPlugins` 経由で、基準も recommended ではなく設計判断と対にしたルールを名指しするためである (ADR-0029)。

`testing-library` もこの表に載らない。基準は上流の `flat/react` を写すが、適用を story と story 専用の helper に限り、基準から外すルールがある (ADR-0010)。

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
基準と違うオプションを置くのは次の 2 つで、いずれも理由を `vite.config.ts` のコメントに残す。

| ルール                         | 指定                                     | 理由                                                                                                                                        |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-confusing-void-expression` | `ignoreVoidReturningFunctions` を足す    | 素の設定は戻り値型が `void` の prop へ渡すアロー省略記法にも鳴り、`void` を値として使う本来の誤りと区別できない                             |
| `only-throw-error`             | `allow` に TanStack Router の `Redirect` | `throw redirect()` は Router の制御フロー契約で、SSR では投げた `Response` がそのまま HTTP 307 になる。`Error` を投げる置き換えが存在しない |

`only-throw-error` の `allow` に `notFound()` を登録しないのは、使っていないためである。使い始めた時点で lint が鳴るので、そこで足す。

`restrict-template-expressions` は基準がオプションを指定しているが、名指しせず oxlint の既定に委ねる。
既定が false にするのは `allowArray` と `allowNever` の 2 つで、typescript-eslint 本体も `strict-type-checked` の上へ同じ位置の値を戻しており、oxc 自身の設定もこのルールを名指ししていない。
数値をテンプレート文字列へ埋め込む書き方は silent failure の源ではなく、上流 2 つが揃う既定を採る。
なお `correctness` に入るルールも `rules` へ名指しすればオプションを上書きできる。名指ししないルールだけがカテゴリ既定で動く。

`correctness` にある type-aware ルールと `strict-type-checked` は包含関係ではなく、部分的に重なる別の集合である。基準を strict に置いても oxlint 独自の `correctness` 選択は失わない。

### 前提ごとの variant まで下ろす

上流が前提ごとに config を分けている場合は、このプロジェクトの前提に合う variant まで指定する。

| variant                             | 前提                     | variant を読まないと起きること                                                                                                    |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `react` の `jsx-runtime`            | React 17 以降の JSX 変換 | `react-in-jsx-scope` と `jsx-uses-react` が有効になり、JSX を書いた全ファイルが落ちる                                             |
| `jsdoc` の `recommended-typescript` | TypeScript               | `require-param-type` / `require-property-type` / `require-returns-type` が有効になり、シグネチャが持つ型を JSDoc へ二重に書かせる |

eslint コアと `import` の TypeScript 向け variant は、off にする側を機械的には写さない。
上流が off にする根拠は「同じ誤りを TypeScript が既に扱う」ことで、off の各行には `ts(2451)` のような診断コードが添えられている。
このリポジトリでも型検査は tsgolint が同じコードで報告するため、根拠自体は成り立つ。
それでも写さずに個別判断へ落とすのは、oxlint 側でそのルールが報告する場面が残っているかがルールごとに違うためで、off にするかは probe の実測で決める。
error にする側の 4 ルール (`eslint-recommended`) は根拠の向きが逆で、基準に含める (「基準にする上流設定」)。

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

突き合わせは `vp lint --print-config` の `rules` を `react/` で絞り、上流のルール一覧 (「出典」) と比べる。

上流が既定 off にするルールのうち oxlint に実装があるのは 9 で、有効になるのは `perf` 経由の 1 つだけである。
分割後の 22 は、上流 recommended-latest に入る 13 (`correctness` の 12 と `unsupported-syntax`) とこの 9 で尽きる。`exhaustive-deps` と `rules-of-hooks` は分割前からあるルールで、22 には含まれない。

| ルール                                                                                 | oxlint のカテゴリ | 扱い                                                                                           |
| -------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `no-deriving-state-in-effects`                                                         | `perf`            | カテゴリ経由で error                                                                           |
| `invariant` / `rule-suppression` / `syntax` / `todo`                                   | `restriction`     | off。`todo` は Compiler の未実装による bail out で、欠陥として扱わないと ADR-0016 が決めている |
| `capitalized-calls` / `exhaustive-effect-dependencies` / `hooks` / `memo-dependencies` | `suspicious`      | off。上流が既定から外している                                                                  |

`unsupported-syntax` だけを `restriction` から引き上げるのは、これが Compiler の未実装ではなく「対応する予定がない構文」(`this` / `with` / インライン `class` 宣言) を指すためである。
書き換えれば消えるのでコード側の欠陥として扱える。上流も `todo` を off にしたまま、このルールだけ recommended に入れている。

### jsx-a11y は名指しがゼロになる

上流 recommended のルールは全て `correctness` 経由で `error` になっており、`rules` へ足す先が 1 つも残らない。
そのため `"jsx-a11y/<name>"` の行は 1 つも書いていない。
判定を後から読めるよう、`vite.config.ts` の `rules` には jsx-a11y のセクション見出しコメントだけを置く。見出しが無いと「検討していない」と区別できない。

recommended 外だが `correctness` 経由で有効なままのルールが 4 つある。
`control-has-associated-label` / `lang` / `no-aria-hidden-on-focusable` / `prefer-tag-over-role` で、いずれも有効のまま残す。
off にする判断は違反が出たときに個別に行う (registry コードでの行単位抑制は ADR-0024 の許容リストが持つ)。

`anchor-ambiguous-text` は oxlint に実装があり名指しすれば足せるが、上流 recommended に含まれないため足さない。

突き合わせの手順は `vp lint --print-config` の `rules` を `jsx_a11y/` で絞り、上流 recommended の一覧と `comm` で両方向の差を取る。
`--print-config` の `rules` は「カテゴリで有効になったもの」と「設定で名指ししたもの」の和なので、名前が出る = 有効と読んでよい。

**逆は成り立たない。** `--print-config` は JS plugin を遅延ロードする前に短絡し、plugin 由来のルール名を未知として捨てる (oxc-project/oxc#22117)。
`jsPlugins` の宣言自体は出力に現れるが `shadcn/*` rule は現れず、出力だけ見ると無効に見える。lint 実行時の発火は一時 probe で確認する。

### unicorn を選定しない理由

unicorn は recommended に含めるルールの数が他プラグインと桁違いに多く、そのまま基準にすると合わないものを選り分ける判断が他プラグインとは別の規模になる。
参照した他の共有 config も、recommended をそのまま全部採る例は見当たらない。
oxc 自身の設定と同じく、`correctness` と `perf` に入る分だけを使う。

### 基準から外れる名指し

recommended に無くても、規約や他の決定を機械で守るために足すルールがある。

| ルール                                  | 名指しの理由                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `typescript/consistent-type-assertions` | `assertionStyle: "never"` の指定が要る                                             |
| `no-restricted-imports`                 | `*.test-helpers.ts` と `src/test/` をアプリのコードから import させない (ADR-0011) |

テスト専用コードの import を止める範囲と手段の比較は ADR-0011 が持つ。

`react/rules-of-hooks` と `react/unsupported-syntax` はここに載らない。どちらも基準 (eslint-plugin-react-hooks) に入っており、oxlint のカテゴリが `correctness` / `perf` の外にあるだけである (「React Compiler のルールは eslint-plugin-react-hooks を基準にする」)。

### off にする条件

基準で有効なルールを off にしてよいのは、次のいずれかに当たるときだけである。理由は `vite.config.ts` のコメントに残す。

| 条件                                                          | 該当するルール                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 同じ誤りを tsc が報告する                                     | `no-undef` (TS2304) / `no-redeclare` (TS2451) / `import/named` (TS2305)               |
| 発火条件が名前だけで内容を見ていない                          | `promise/no-callback-in-promise` (引数名 `next` / `done` / `cb`)                      |
| 公式の修正が別の欠陥を持ち込む                                | `oxc/no-map-spread` (修正が元オブジェクトの破壊的更新になる)                          |
| 書き方の方針と衝突する                                        | `jsdoc/require-param` / `jsdoc/require-returns` (説明だけの JSDoc が書けなくなる)     |
| 上流 recommended に無く `correctness` 経由で入る              | `vitest/require-mock-type-parameters`                                                 |
| 基準の variant が off にするが `correctness` 経由で有効になる | `jsdoc/require-property-type` (カテゴリ側の有効化が勝つため `rules` で明示的に落とす) |

基準がより緩いオプションを持つ場合も同様に、指定と理由を残す (`promise/always-return` の `ignoreLastCallback`、`vitest/valid-expect` の `maxArgs`、`vitest/expect-expect` の `assertFunctionNames`)。
`assertFunctionNames` は既定を置換するため、既定値を覆う指定にする。

### テストファイルの緩和

対象を絞った緩和はテストの 1 経路だけに置く。
`**/*.test.{ts,tsx}` と `src/test/**` で off にするのは次の 5 つに限る。

`no-non-null-assertion` / `no-unsafe-assignment` / `no-unsafe-call` / `no-unsafe-member-access` / `no-unsafe-return`

この 5 つは typescript-eslint 本体が自身のテストディレクトリで off にしているものと同一である。
範囲を絞って有効にするルール (`no-restricted-imports`) は緩和ではないので、この経路に載せず `excludeFiles` で対象を外す (ADR-0011)。
モックは意図的に型を外した値を扱い、assertion は取り出す要素の存在を前提に書くため、欠陥ではなく書き方そのものに鳴る。上流も同じ判断をしているので、off の理由をこちらで発明する必要がない。

`no-non-null-assertion` を strict 採用の動機に挙げていることとは矛盾しない。
`array[expr]!` が silent failure になるのは lookup miss の結果が後段へ流れるからで、テストでは `!` の空振りがその場で TypeError になりテストの失敗として見える。

テストファイルを type-aware lint の対象から外すことはしない。緩和は名指しの 5 ルールに限る。

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
- 名指ししたルールは `rules` に並ぶため、上流 recommended の改訂には自動追随しない。追随は Dependabot PR の処理時に、oxlint (Vite+ 同梱) の minor 以上の更新が来たら基準表のプラグインを突き合わせる
- 名指ししたルールが oxlint 側で改名・廃止されると `vp lint` が設定のパースで落ちる (`Rule 'react-compiler' not found in plugin 'react'`)。取りこぼしは起きないが、更新の PR は lint が動かない状態から始まる
- typescript-eslint は依存に入っていないため、`strict` の改訂を知らせる発火条件がない。追随はこの ADR を読み直すときに行う
- 有効カテゴリは `scripts/checks/integrity/lint-config.test.ts` が解決後設定の値で押さえる。カテゴリで有効になったルールは解決後設定の `rules` に列挙されないため、値でしか見えない
- `perf` の `no-await-in-loop` は順序依存のループにも鳴る。機械的に `Promise.all` へ倒さず、抑制と理由の記述で扱う
- vitest プラグインはテストファイル以外にも効き、行頭がテスト呼び出しに見えるコメントは `no-commented-out-tests` で報告される
- ルールを足すか迷ったら、まず上流 recommended に入っているかを確認する。入っていないものを足すときは「基準から外れる名指し」の表に理由とともに追記する

## 出典

- typescript-eslint の共有設定: https://typescript-eslint.io/users/configs/
- テストディレクトリでの off と `strict-type-checked` 上でのオプション上書きを含む上流本体の設定: https://github.com/typescript-eslint/typescript-eslint/blob/main/eslint.config.mjs
- oxc 自身の lint 設定 (`categories` は correctness と perf だけ、個別ルールは `rules` に列挙): https://github.com/oxc-project/oxc/blob/main/oxlintrc.json
- oxlint の recommended preset 追跡 issue: https://github.com/oxc-project/oxc/issues/20758
- React Compiler 診断の per-category ルール分割 (22 ルールとカテゴリの一覧): https://oxc.rs/blog/2026-08-18-react-compiler-support
- eslint-plugin-react-hooks のルール一覧と preset: https://react.dev/reference/eslint-plugin-react-hooks
- Rendering Lists (index を key にする問題に実行時警告がないこと): https://react.dev/learn/rendering-lists
- `only-throw-error` と TanStack Router の衝突に対する公式の案内: https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
