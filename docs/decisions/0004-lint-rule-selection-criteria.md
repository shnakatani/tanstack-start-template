# ADR-0004: ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0003 (プラグインの設定方法)、ADR-0009 (React Compiler の診断ルールの扱い)

## Context

oxlint のカテゴリ (`correctness` / `perf` / `pedantic` / `style` / `restriction` / `suspicious` / `nursery`) は、oxlint 実装者がルールを分類した軸であって、プロジェクトが検査を選ぶ軸ではない。
カテゴリを丸ごと有効にすると、`pedantic` のように上流自身が recommended から外したルールまで入り、何を残すかの判断を全件こちらで負うことになる。

型情報を要るルールは 7 カテゴリすべてに散っており、カテゴリ単位では「型検査を強める」という意図を表現できない。

## Decision

カテゴリ単位で有効にするのは `correctness` と `perf` に限る。
それ以外は、プラグインごとの上流 recommended を基準に `rules` へ名指しで足す。

### 基準にする上流設定

有効にしていないプラグインも、有効化する時点でこの表の基準に従う。

| プラグイン        | 基準                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| eslint コア       | `@eslint/js` の `recommended` + typescript-eslint の `eslint-recommended` が error にする 4 ルール                                                       |
| `typescript`      | typescript-eslint の `strict` と `strict-type-checked`                                                                                                   |
| `react`           | eslint-plugin-react の `recommended` と `jsx-runtime`。React Compiler 由来のルールだけは eslint-plugin-react-hooks の `recommended-latest`               |
| `import`          | eslint-plugin-import の `recommended`                                                                                                                    |
| `promise`         | eslint-plugin-promise の `recommended`                                                                                                                   |
| `jsdoc`           | eslint-plugin-jsdoc の `recommended-typescript`                                                                                                          |
| `vitest`          | `@vitest/eslint-plugin` の `recommended`                                                                                                                 |
| `jsx-a11y`        | eslint-plugin-jsx-a11y の `recommended`                                                                                                                  |
| `testing-library` | eslint-plugin-testing-library の `flat/react`。適用は story 本体と story 専用の helper に限る (対象は `companion-files.ts` の `storyGlobs` が唯一の定義) |
| `unicorn`         | 選定しない。`correctness` と `perf` に入る分だけ使う                                                                                                     |
| `oxc`             | 上流に対応する設定がない。`correctness` と `perf` で拾う                                                                                                 |

`@shadcn/lint` はこの表に載らない。oxlint ネイティブではなく `jsPlugins` 経由で、基準も recommended ではなく設計判断と対にしたルールを名指しするためである (「Tailwind と shadcn/ui 領域は jsPlugins で足す」)。

`testing-library` は oxlint ネイティブではなく `jsPlugins` で載せるが、基準は上流の `flat/react` を写す。`@shadcn/lint` と違い上流に recommended があるためである。

適用を story に限るのは、緩和ではなく適用範囲の確定である。対象は `*.stories.{ts,tsx}` と `*.story-helpers.{ts,tsx}` の両方で、play を helper へ切り出したときにルールが外れないようにする。種別も拡張子も字面で並べ直さず `companion-files.ts` の `storyGlobs` から引く。`.storybook/main.ts` が ts / tsx の両方を story として扱うので、片方だけに絞るとルールが無言で外れる。`*.test.tsx` は `vitest-browser-react` の locator API を使い、`screen.container` や `getByText(...).query()` が testing-library の同名 API と意味が違う。当てると誤検出が出る。支配的なのは `render-result-naming-convention` で、`vitest-browser-react` は render の結果を `screen` と名付けて locator を返すが、testing-library はその名前も戻り値も別物として扱う。件数は `vite.config.ts` の `files` を `*.test.tsx` へ広げて `vp lint` を走らせれば出る。story 側は `storybook/test` が testing-library をそのまま re-export しており、Aggressive Reporting が module の判定を解決する。

browser mode 側の待機は `vitest` プラグインが持つ。`require-awaited-expect-poll` が `expect.element` を対象にしており、`correctness` カテゴリ経由で既に有効である。

基準からの逸脱は下表のとおりで、外すものと severity を上げるものがある。

| ルール                  | 外す理由                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefer-screen-queries` | play が受け取る `canvas` を render 結果の分割代入と誤読する。`canvas` は Storybook が渡す query 済みオブジェクトで、上流の `write-story` skill が「✅ Correct: Use canvas directly」と指定している形                                                                                                                                                                           |
| `no-node-access`        | `flat/react` の中でこれだけが strict 判定 (`isTestingLibraryImported(true)`) で Aggressive Reporting を迂回し、`storybook/test` 経由の story では一度も発火しない。`settings` の `testing-library/utils-module` を足せば発火するが、その形は `.claude/rules/testing.md`「状態のアサートは semantic matcher を先に探す」が `querySelector` を条件付きで許しているのと両立しない |

`no-debugging-utils` は upstream が `warn` だが `error` へ上げる。`vp check` は warn で exit 1 にならないため、`warn` のままだと commit された `screen.debug()` が素通りする。
`no-node-access` を有効のまま残すと、設定上は error でも無検査になる。

このプラグインは ESLint 本体を依存へ持ち込む。`packageExtensions` で peer を optional にしても外さない。`@typescript-eslint/utils` のルート import が `eslint` を実行時に読むため、外せたとしてもプラグインが落ちるからである (2026-09-20 に 3 通り試して実測)。機序 (`eslint` を必須 peer に持つ依存が連鎖すること) は `pnpm-workspace.yaml` のコメントが持つ。oxlint の jsPlugins が読み込む中でだけ動き、出荷物には入らない。撤去条件は typescript-eslint#11939 (`utils` から `eslint` の import を外し `/ts-eslint` を型専用にする) が入ることで、oxc-project/oxc#17734 が oxlint 側の追跡先である。

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

| ルール                                                                                 | oxlint のカテゴリ | 扱い                                                                                                        |
| -------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `no-deriving-state-in-effects`                                                         | `perf`            | カテゴリ経由で error。effect からの派生 state を禁じる規範 (`.claude/rules/implementation.md`) がこれに依る |
| `invariant` / `rule-suppression` / `syntax` / `todo`                                   | `restriction`     | off。`todo` は Compiler の未実装による bail out で、欠陥として扱わないと ADR-0009 が決めている              |
| `capitalized-calls` / `exhaustive-effect-dependencies` / `hooks` / `memo-dependencies` | `suspicious`      | off。上流が既定から外している                                                                               |

`unsupported-syntax` だけを `restriction` から引き上げるのは、これが Compiler の未実装ではなく「対応する予定がない構文」(`this` / `with` / インライン `class` 宣言) を指すためである。
書き換えれば消えるのでコード側の欠陥として扱える。上流も `todo` を off にしたまま、このルールだけ recommended に入れている。

### jsx-a11y は名指しがゼロになる

上流 recommended のルールは全て `correctness` 経由で `error` になっており、`rules` へ足す先が 1 つも残らない。
そのため `"jsx-a11y/<name>"` の行は 1 つも書いていない。
判定を後から読めるよう、`vite.config.ts` の `rules` には jsx-a11y のセクション見出しコメントだけを置く。見出しが無いと「検討していない」と区別できない。

recommended 外だが `correctness` 経由で有効なままのルールが 4 つある。
`control-has-associated-label` / `lang` / `no-aria-hidden-on-focusable` / `prefer-tag-over-role` で、いずれも有効のまま残す。
off にする判断は違反が出たときに個別に行う (registry コードでの行単位抑制は ADR-0006 の許容リストが持つ)。

`anchor-ambiguous-text` は oxlint に実装があり名指しすれば足せるが、上流 recommended に含まれないため足さない。

突き合わせの手順は `vp lint --print-config` の `rules` を `jsx_a11y/` で絞り、上流 recommended の一覧と `comm` で両方向の差を取る。
`--print-config` の `rules` は「カテゴリで有効になったもの」と「設定で名指ししたもの」の和なので、名前が出る = 有効と読んでよい。

**逆は成り立たない。** `--print-config` は JS plugin を遅延ロードする前に短絡し、plugin 由来のルール名を未知として捨てる (oxc-project/oxc#22117)。
`jsPlugins` の宣言自体は出力に現れるが `shadcn/*` rule は現れず、出力だけ見ると無効に見える。lint 実行時の発火は一時 probe で確認する。

### unicorn を選定しない理由

unicorn は recommended に含めるルールの数が他プラグインと桁違いに多く、そのまま基準にすると合わないものを選り分ける判断が他プラグインとは別の規模になる。
参照した他の共有 config も、recommended をそのまま全部採る例は見当たらない。
oxc 自身の設定と同じく、`correctness` と `perf` に入る分だけを使う。

### Tailwind と shadcn/ui 領域は jsPlugins で足す

色を semantic token だけに保つ統制は 2 層で行い、lint はその 2 層目である。

| 層  | 場所                                                | 担うもの                                                         |
| --- | --------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `src/styles.css` の `@theme` (`--color-*: initial`) | 既定 palette を生成から外す。CSS が出ないので画面にも出ない      |
| 2   | `@shadcn/lint` の 3 ルール                          | 未知 class、palette・raw color、arbitrary color を記述時に落とす |

1 層目だけだと違反は「無言で効かない class」になり、2 層目だけだと既定 palette の CSS 生成を止められない。

oxlint は Tailwind と shadcn/ui 領域のルールをネイティブに持たないため、`jsPlugins` で `@shadcn/lint` を読み込む。
`components.json` の UI alias と theme CSS を自動探索できるため、同じ値を `settings.shadcn` へ複製しない。
`settings.shadcn.componentImports` はこの探索結果の書き直しではなく、`ui` alias の外側にある自作部品 (`parts/` 等) まで design system component として認識させる追加である (ADR-0020)。

| 有効にしたルール                | 見るもの                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `shadcn/no-unknown-classes`     | theme から生成されない class と未知 variant                                                       |
| `shadcn/no-raw-colors`          | palette class、未定義 semantic color token、SVG の raw color                                      |
| `shadcn/no-arbitrary-values`    | `deny: ["color"]` で arbitrary color だけを禁止し、非色の arbitrary value は許可する              |
| `shadcn/no-restyle`             | design system component への `className` 上書き。`allow: ["layout"]` で layout だけ通す           |
| `shadcn/require-static-classes` | design system component へ渡す className が静的に読めるか。読めないと他ルールが中身を検査できない |

`no-raw-colors` は `bg-[#333]` のような arbitrary color を検査しないため、`no-arbitrary-values` と対で使う。
`no-raw-colors` は class だけでなく `fill` / `stroke` など SVG 属性の raw color も見る。移行前の 2 ルールに無かった検査で、統制の範囲はここだけ広がる。
`no-arbitrary-values` は `color-mix()` の材料が semantic token だけでも color category と判定する。raw color を持たず dark mode に追従する既存表現は、行単位で抑制し ADR-0006 の許容リストへ記録する。
`no-restyle` は 2026-09-19 に ADR-0020 の層の決定と対で、`require-static-classes` は同日に ADR-0021 の配り方の決定と対で採用した。
`require-static-classes` は `no-restyle` と同じ `overrides` に相乗りし、`settings.shadcn.variantFunctions` で `cva` 由来の variant 関数を宣言する。
宣言が要る理由と `mergeFunctions` を使わない理由は ADR-0021 が持つ。
`no-inline-styles` は対になる設計判断がまだ無いため有効化しない。

`@shadcn/lint` は上流の `recommended` を持たない。ルールは設計判断と対にして 1 つずつ名指しし、まとめて有効にしない。

`jsPlugins` のエントリは `{ name, specifier }` の形で書き、`@shadcn/lint` には `{ name: "shadcn", specifier: "@shadcn/lint" }` を使う。
plugin 本体の `meta.name`、診断コード、rule key、抑制 directive が `shadcn` を共有する。
`rules` のキーに別名 (`@shadcn/lint/no-raw-colors`) を書くと設定のパースが `Plugin '@shadcn/lint' not found` で落ちる。
一方、抑制 directive は未登録の名前を書いてもエラーにならず、ただ効かない (2026-09-19 に Oxlint 1.82.0 で実測)。名前を揃えないと、rule は有効なまま抑制だけが無言で外れる。
JS plugin は lint 時間を伸ばす。測るときは `time vp lint` を 2 回ずつ実行して 2 回目同士を比べる (1 回目には解決のコストが乗る)。

3 ルールの発火は `--print-config` に出ないため、次を一時ファイルへ置いて `vp lint <path>` を走らせ、3 行とも診断が出たら消す。

```tsx
export function Probe() {
  return (
    <div>
      <span className="bg-blue-500" /> {/* no-raw-colors */}
      <span className="bg-[#333]" /> {/* no-arbitrary-values */}
      <span className="not-a-real-class" /> {/* no-unknown-classes */}
    </div>
  );
}
```

theme と component の探索に失敗したときは、`vp lint` の出力へ `[@shadcn/lint]` の警告が出る。
`components.json` の `tailwind.css` が存在しないパスなら代替の stylesheet を使う旨、Tailwind を import する stylesheet が 1 つも無ければ `no-raw-colors` が宣言済み token を確認できない旨、`ui` alias がディレクトリに解決しなければ design-system component を認識しない旨をそれぞれ報告する (2026-09-19 に実測)。
3 ルールは警告を出したうえで発火し続け、診断から token の提案が減る。silent failure ではないので、この解決を見張る検査は置かない。

### 基準から外れる名指し

recommended に無くても、規約や他の決定を機械で守るために足すルールがある。

| ルール                                  | 名指しの理由                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `typescript/consistent-type-assertions` | `assertionStyle: "never"` の指定が要る                                         |
| `no-restricted-imports`                 | `*.test-helpers.ts` と `src/test/` をアプリのコードから import させない (下記) |

テスト専用のコードの置き場所は `.claude/rules/directory-structure.md`「テストとスクリプトの配置」が持つ。
アプリのコードが誤って import しても、helper が型しか引かなければ build は通り、fixture がそのまま client と server の bundle に入る (2026-09-14 に `vp build` で確認)。
レビューで見るしかなかった境界を lint で止める。

| 手段                                                       | 判定                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| eslint-plugin-import の `import/no-restricted-paths`       | この用途の専用ルール (zones) だが oxlint に無い (oxc-project/oxc#13789)                                             |
| dependency-cruiser の既定ルール `not-to-test`              | 同じ用途を既定で持つが、1 ルールのためにツールを増やす                                                              |
| TanStack Start の `importProtection` (`files`)             | パス単位で bundle から遮断できるが build 時にしか鳴らず、client / server の環境境界のための機構 (公式 guide の説明) |
| eslint コアの `no-restricted-imports` を範囲を絞って当てる | 採用。oxlint の保守者が同じ用途に示した形 (oxc-project/oxc#20881)                                                   |

`patterns` の `regex` で `.test-helpers` 終わりの specifier と、alias (`@/test/`) または相対 (`./test/` `../test/`) で `test/` を指す specifier を止める。
当てる範囲は `overrides` の `files` (`src/**` `scripts/**`) と `excludeFiles` (テスト、`*.test-helpers`、`src/test/`) で絞る。
oxc-project/oxc#20881 が示す `files` の否定 glob (`!**/*.test.ts`) は oxlint 1.79.0 では除外として効かず (2026-09-14 に最小構成で実測)、`excludeFiles` が効く。
全体で error にしてテスト側で off にする形は取らない。off はテストの緩和経路に載り、`*.test-helpers` を緩和へ足すことになる (「テストファイルの緩和」の 5 ルールは helper に要らない)。

再評価条件: oxlint が `import/no-restricted-paths` を実装したら (oxc-project/oxc#13789 の close)、zones の形へ移す。

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
範囲を絞って有効にするルール (`no-restricted-imports`) は緩和ではないので、この経路に載せず `excludeFiles` で対象を外す (「基準から外れる名指し」)。
モックは意図的に型を外した値を扱い、assertion は取り出す要素の存在を前提に書くため、欠陥ではなく書き方そのものに鳴る。上流も同じ判断をしているので、off の理由をこちらで発明する必要がない。

`no-non-null-assertion` を strict 採用の動機に挙げていることとは矛盾しない。
`array[expr]!` が silent failure になるのは lookup miss の結果が後段へ流れるからで、テストでは `!` の空振りがその場で TypeError になりテストの失敗として見える。

テストファイルを type-aware lint の対象から外すことはしない。緩和は名指しの 5 ルールに限る。

### `no-misused-promises` が要求する実装の形

このルールは名指しで足したルールのうち、既存コードの構造に最も踏み込む。鳴るのは `async` 関数をイベントハンドラとして prop へ直接渡している箇所である。

**ハンドラは同期関数として宣言し、非同期処理はその内側へ閉じる。** 待たない判断は内側で 1 回だけ表明する。

```tsx
function handleSignOut() {
  void performSignOut();
}
<DropdownMenuItem onClick={handleSignOut}>
```

内側の書き方は、失敗をどこで見せるかで決まる。呼び先が通知まで持つなら `void`、呼び出し側で処理するなら `.catch()` である。

呼び出し側の JSX で `void` する形は採らない。ハンドラが名前を失って JSX へインライン化され、失敗の扱いを誰が持つかが読めなくなる。
受け手の prop 型を `() => void | Promise<void>` にする形も採らない。自作コンポーネント間でしか使えず DOM の prop には適用できないため、境界ごとに書き方が割れる。
`checksVoidReturn.attributes` を off にすると、本当に rejection を落としている箇所も検出できなくなる。

React 公式もこの構造を採っている。React 19 の `TransitionFunction` は非同期処理を受け取るが、`onClick` に渡すハンドラ自体は同期である。
mutation を伴う操作は、その同期ハンドラの内側で `startTransition` に非同期関数を渡す形 (Action) にし、pending は Transition から取る。この判断は ADR-0014 が持つ。
2026-09-13 までは `startTransition` を第 3 の選択肢としない (pending の源が mutation の `isPending` と二重になる) としていたが、pending の源を Transition 側へ一本化することで解消した。

### 検討した選択肢

| 案                                                  | 評価                                                                                           | 採否     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| プラグインごとの上流 recommended を基準に名指しする | 含める含めないの判断を上流の共有設定に委ねられる                                               | **採用** |
| カテゴリ単位で有効にし、合わないものを off にする   | カテゴリは好みが分かれるルールを多く含み、何を残すかの判断を全件負う                           | 却下     |
| 必要になったルールだけを都度足す                    | 選定の基準が残らず、何を検査していないかも読み取れない                                         | 却下     |
| oxlint が recommended 相当の preset を出すまで待つ  | 追跡 issue (oxc-project/oxc#20758) が着地するまで選定を止められない。preset が出たら再評価する | 却下     |
| 顕在化した違反を実害なしとして見送る                | 実害がないのは現在のコードについてだけ。index key の事故に React は実行時警告を出さない        | 却下     |

tailwind 領域のプラグイン選定は別軸なので分けて置く。

| 案                                 | 評価                                                                                                                                                                 | 採否     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `@shadcn/lint`                     | Tailwind CSS v4、`components.json`、theme CSS、shadcn component を理解し、色の統制を 3 つの専用 rule へ分けられる                                                    | **採用** |
| `eslint-plugin-better-tailwindcss` | shadcn 専用 plugin が存在しなかった期間の代替。未知 class と正規表現による arbitrary color 検査はできるが、shadcn component と semantic token を専用モデルで扱わない | 移行     |
| `eslint-plugin-tailwindcss`        | Tailwind v4 には対応するが peerDependencies は `eslint` だけで、oxlint 経由の利用を上流が想定していない (2026-08-17 に確認)                                          | 却下     |
| 自前の正規表現でソースを走査する   | 字面しか見ないため theme の実体と乖離し、任意値の中身も読めない。撤去した                                                                                            | 却下     |

## Consequences

- `correctness` と `perf` へのルール追加は次の `vp check` で自動的に入る。この 2 カテゴリだけが opt-out である。依存更新で違反が増えたら、修正するか off にするかを判断する
- 名指ししたルールは `rules` に並ぶため、上流 recommended の改訂には自動追随しない。追随は Dependabot PR の処理時に、oxlint (Vite+ 同梱) の minor 以上の更新が来たら基準表のプラグインを突き合わせる
- 名指ししたルールが oxlint 側で改名・廃止されると `vp lint` が設定のパースで落ちる (`Rule 'react-compiler' not found in plugin 'react'`)。取りこぼしは起きないが、更新の PR は lint が動かない状態から始まる
- typescript-eslint は依存に入っていないため、`strict` の改訂を知らせる発火条件がない。追随はこの ADR を読み直すときに行う
- 有効カテゴリは `scripts/checks/integrity/lint-config.test.ts` が解決後設定の値で押さえる。カテゴリで有効になったルールは解決後設定の `rules` に列挙されないため、値でしか見えない
- `eslint-plugin-testing-library` の追加で dev 依存が増え、`eslint` が展開される。増分は `git diff pnpm-lock.yaml` の `packages:` の差で数える。外すと `Failed to load JS plugin: eslint-plugin-testing-library / Cannot find module 'eslint'` で config のパースごと落ちるため fail-closed である
- `jsPlugins` は alpha 扱いで semver の対象外だと oxlint 側が明記している。oxlint の更新で読み込み方が変わりうるため、追随の発火条件は Dependabot PR の処理時とする。確認するのは plugin の読み込みと 3 ルールの発火の両方である
- 3 ルールが発火していることを機械で見張るものは無い。`--print-config` の top-level `rules` に JS plugin 由来のルールが出ないため、`rules` から 3 行を消しても `"off"` にしても整合性テストと `vp check` は通る。確認は下の probe を一時ファイルへ置いて `vp lint <path>` を走らせる手動の手順になる
- `overrides` に置いた JS plugin 由来のルールは解決後設定に出るため、`scripts/checks/integrity/lint-config.test.ts` が規則名と severity を固定している。top-level の 3 ルールとは扱いが違う (ADR-0021)
- `no-arbitrary-values` は `color-mix()` の材料を区別しない。token だけを混ぜる表現にも行単位の抑制が要り、抑制は class 文字列の行全体に効く。抑制した行へ後から色の任意値を足すと無言で通る
- `@shadcn/lint` は `@typescript-eslint/parser` を実依存に持つが、oxlint 経由では読まない。この経路の eslint peer は `pnpm-workspace.yaml` の `packageExtensions` で optional にして止める。ただし `eslint` がグラフから消えるわけではない。`eslint-plugin-testing-library` が `@typescript-eslint/utils` 経由で `eslint` を必須 peer に持ち、そちらは止まらない (節「基準にする上流設定」)
- parser の `typescript` peer (`>=4.8.4 <6.1.0`) が Vite+ の `^5.0.0 || ^6.0.0 || ^7.0.0` の上限を押さえるため、依存グラフの `typescript` は 6 系になる。型検査は tsgolint が担う (ADR-0002) ため `vp check` の結果は変わらない
- 2026-09-19 の移行で lockfile の `typescript@7.0.2` は `6.0.3` へ置き換わり、Vite+ が読む実体も切り替わった。`@shadcn/lint` を外した fresh resolve では `typescript` 自体が入らないため、7.0.2 は増分解決で積み上がっていた版である
- eslint peer の optional 化と `typescript` の 6 系固定は撤去条件が同じで、上流が parser を optional peer へ移すこと (shadcn-ui/lint#1)。移れば `packageExtensions` は不要になるが、`eslint` は `eslint-plugin-testing-library` 経由で残る。撤去で解けるのは `typescript` の 6 系固定だけである
- parser と `oxc-parser` のどちらも解決できないと、`@shadcn/lint` は cross-file 解析だけを無警告で失う。呼び出し元が parser のエラーを握りつぶすためで、ルールは動き続ける。診断の提案文言が縮むことでしか気付けない (shadcn-ui/lint#1)
- theme に無いクラスを全て落とすため、`src/styles.css` へ token を足す前に utility を書くと lint で止まる。順序は token の定義が先になる
- `perf` の `no-await-in-loop` は順序依存のループにも鳴る。機械的に `Promise.all` へ倒さず、抑制と理由の記述で扱う
- vitest プラグインはテストファイル以外にも効き、行頭がテスト呼び出しに見えるコメントは `no-commented-out-tests` で報告される
- ルールを足すか迷ったら、まず上流 recommended に入っているかを確認する。入っていないものを足すときは「基準から外れる名指し」の表に理由とともに追記する
- `settings.shadcn.componentImports` を消すと自作部品が規則から見えなくなり、routes からの上書きが素通りする。`--print-config` に JS plugin 由来の設定は出ないため無言で効かなくなる
- `no-restyle` の適用範囲はディレクトリで決まる (ADR-0020)。画面の組み立てを `parts/` へ置くと規則が効かない。機械では止まらない

## 出典

- typescript-eslint の共有設定: https://typescript-eslint.io/users/configs/
- テストディレクトリでの off と `strict-type-checked` 上でのオプション上書きを含む上流本体の設定: https://github.com/typescript-eslint/typescript-eslint/blob/main/eslint.config.mjs
- oxc 自身の lint 設定 (`categories` は correctness と perf だけ、個別ルールは `rules` に列挙): https://github.com/oxc-project/oxc/blob/main/oxlintrc.json
- oxlint の recommended preset 追跡 issue: https://github.com/oxc-project/oxc/issues/20758
- React Compiler 診断の per-category ルール分割 (22 ルールとカテゴリの一覧): https://oxc.rs/blog/2026-08-18-react-compiler-support
- eslint-plugin-react-hooks のルール一覧と preset: https://react.dev/reference/eslint-plugin-react-hooks
- oxlint の JS plugins (alpha 扱いと `{ name, specifier }` の指定形): https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- `@shadcn/lint` の setup と rule 一覧: https://github.com/shadcn-ui/lint/blob/main/SETUP.md
- 使われない `@typescript-eslint/parser` が ESLint と typescript を連れてくる件: https://github.com/shadcn-ui/lint/issues/1
- pnpm の `packageExtensions` (依存の manifest へ `peerDependenciesMeta` を後付けする): https://pnpm.io/settings/dependency-resolution
- Tailwind CSS の既定 palette を差し替える手順 (`--color-*: initial`): https://tailwindcss.com/docs/colors
- eslint-plugin-better-tailwindcss: https://github.com/schoero/eslint-plugin-better-tailwindcss
- Rendering Lists (index を key にする問題に実行時警告がないこと): https://react.dev/learn/rendering-lists
- `only-throw-error` と TanStack Router の衝突に対する公式の案内: https://tanstack.com/router/latest/docs/eslint/eslint-plugin-router
- 非同期イベントハンドラの書き方に関するメンテナの回答: https://github.com/typescript-eslint/typescript-eslint/issues/11008
- Transition の目的 (ノンブロッキング更新・`isPending`・optimistic update): https://react.dev/reference/react/useTransition
