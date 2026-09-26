# lint の設定

Oxlint の設定を書き換えるとき、ルールやプラグインを足すとき、ルールを off にするときの手順と落とし穴を持つ。

| 決定                                                                                                               | ADR      |
| ------------------------------------------------------------------------------------------------------------------ | -------- |
| ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする                                     | ADR-0007 |
| テスト専用コードの import は `no-restricted-imports` で止める                                                      | ADR-0008 |
| メモ化は React Compiler に委ね、予防的なメモ化を強制しない                                                         | ADR-0014 |
| registry との乖離は生成時 baseline との 3-way で判別し、許容リスト (registry コードと `src/styles.css`) の行に限る | ADR-0020 |

## how-to

### 設定を書き換えたら解決後の設定で確かめる

oxlint は「設定したつもりで効いていない」状態を診断なしで作る (「設定の落とし穴」)。設定の文面ではなく、`vp lint --print-config` が出す解決後の設定か、実際の診断で確かめる。

- `scripts/checks/integrity/lint-config.test.ts` は解決後の設定の `plugins` を期待値と突き合わせる。プラグインを足したら、そのテストの `EXPECTED_PLUGINS` にも足す
- 同じテストは、`vite.config.ts` の `lint.rules` に書いたキーが `--print-config` の `rules` に残るかも見る。プラグインの脱落で捨てられたルールを、名指し単位で見つけられる
- 突き合わせでは 2 つのキーの形をまたぐ。eslint コアのルールは接頭辞なしで出力され、`typescript/` 接頭辞で書いた extension rule はコアのルール名へ解決される (2026-09-02 時点で `no-array-constructor` と `no-useless-constructor` の 2 件)。解決先が `correctness` なら名指しは no-op なので、`--print-config` で実効を比べる
- React Compiler 由来のルールは `--print-config` の `rules` を `react/` で絞り、eslint-plugin-react-hooks のルール一覧と比べる
- jsx-a11y は `--print-config` の `rules` を `jsx_a11y/` で絞り、上流 recommended の一覧と `comm` で両方向の差を取る。`rules` は「カテゴリで有効になったもの」と「名指ししたもの」の和なので、名前が出れば有効と読んでよい

`--print-config` から有効と読めるのは、名前が出ている場合だけである。JS plugin 由来のルールは出力に出ないので、無いことは無効の証拠にならない (`docs/guides/lint/custom-rules.md`「JS plugin の落とし穴」)。

### ルールを足すか迷ったら

1. 上流 recommended に入っているかを確かめる (基準表は ADR-0007)
2. 入っていないものを足すなら、ADR-0007「基準から外れる名指し」の表に理由と一緒に追記する
3. 基準と違うオプションを置くなら、理由を `vite.config.ts` のそのルールの行のコメントに書く

### 上流 recommended の改訂に追随する

名指ししたルールは `rules` に並ぶので、上流 recommended の改訂には自動で追随しない。
oxlint (Vite+ 同梱) の minor 以上の更新が Dependabot の PR で来たら、ADR-0007 の基準表のプラグインごとに上流の一覧と突き合わせる。
typescript-eslint は依存に入っていないので、`strict` の改訂を知らせるものが無い。ADR-0007 を読み直すときに追随する。

### プラグインを足す

`vite.config.ts` の `OXLINT_DEFAULT_PLUGINS` で既定集合を明示し、`lint.plugins` はその spread へ追加プラグインを積む。spread を落としてはいけない理由は「plugins は既定集合を置換する」にある。プラグインを 1 つ足すたびに確かめる。

- 足したら `scripts/checks/integrity/lint-config.test.ts` の `EXPECTED_PLUGINS` にも足す (「設定を書き換えたら解決後の設定で確かめる」)

### プラグインを足したら違反を分ける

プラグインを足すと、既存の違反が一度に出る。件数が多く、直すか外すかの判断軸が別のものは、別の変更に分ける。1 つの変更に混ぜると、どの判断でどの違反を消したかがレビューで追えない。

違反を数えるときは、診断の `plugin(rule)` 別に数える (「設定の落とし穴」の `-D`)。`require-static-classes` の件数は `vp lint 2>&1 | grep -c 'require-static-classes'` で測り直せる。

### testing-library を当てる範囲

story は `storybook/test` 経由で testing-library の API をそのまま使うので、eslint-plugin-testing-library を `jsPlugins` で載せる。理由は「testing-library を story に限る理由」にある。

- 基準は上流の `flat/react` を写す
- 適用は story 本体と story 専用の helper に限る。対象は `scripts/lib/companion-files.ts` の `storyGlobs` から引き、種別も拡張子も字面で並べ直さない
- `prefer-screen-queries` と `no-node-access` は off にする
- `no-debugging-utils` は上流の `warn` から `error` へ上げる
- ESLint 本体が依存に入るが、`packageExtensions` で外さない

### 前提ごとの variant まで下ろす

上流が前提ごとに config を分けている場合は、このプロジェクトの前提に合う variant まで指定する。

| variant                             | 前提                     | variant を読まないと起きること                                                                                                    |
| ----------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `react` の `jsx-runtime`            | React 17 以降の JSX 変換 | `react-in-jsx-scope` と `jsx-uses-react` が有効になり、JSX を書いた全ファイルが落ちる                                             |
| `jsdoc` の `recommended-typescript` | TypeScript               | `require-param-type` / `require-property-type` / `require-returns-type` が有効になり、シグネチャが持つ型を JSDoc へ二重に書かせる |

eslint コアと `import` の TypeScript 向け variant が off にする側は写さず、ルールごとに probe の実測で決める。理由は「TypeScript 向け variant の off を写さない理由」にある。

### ルールを off にする

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

対象を絞った緩和はテストの 1 経路だけに置く。`**/*.test.{ts,tsx}` と `src/test/**` で off にするのは次の 5 つに限る。理由は「テストファイルで 5 ルールを緩める理由」にある。

`no-non-null-assertion` / `no-unsafe-assignment` / `no-unsafe-call` / `no-unsafe-member-access` / `no-unsafe-return`

- 範囲を絞って有効にするルール (`no-restricted-imports`) は緩和ではないので、この経路に載せず `excludeFiles` で対象を外す (ADR-0008)
- テストファイルを type-aware lint の対象から外すことはしない

### 行単位で抑制する

- `oxlint-disable-next-line` は、違反が報告される行の直前に置く。`.map()` の行に置いても、その中の `key` の行には効かない
- 同じ行に複数のルールが鳴るときは、カンマで区切って 1 行にまとめる。`oxlint-disable-next-line` を 2 行積むと、2 行目が 1 行目のコメント行を「次の行」と解釈して no-op になり、1 件しか抑制されない
- 抑制の directive に書くプラグイン名は、`jsPlugins` のエントリの `name` と揃える (`docs/guides/lint/custom-rules.md`「JS plugin の落とし穴」)
- 行単位の抑制は領域を問わず使ってよい。registry コードの中の抑制は、台帳 `docs/registry-deviations.md` の「行単位の lint 抑制」にも記録する。要るのは記録であって、抑制の可否そのものではない (ADR-0020)
- `perf` の `no-await-in-loop` は順序に依存するループにも鳴る。逐次でないと壊れるループは `Promise.all` へ倒さず、抑制して順序が要る理由を書く

## 設定の落とし穴

どれも「設定したつもりで効いていない」状態を、診断なしで作る。

| 落とし穴                                                                                          | 起きること                                                                                                  | 避け方                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| トップレベルの `plugins` は既定集合を置換する                                                     | 「plugins は既定集合を置換する」                                                                            | `OXLINT_DEFAULT_PLUGINS` を spread して積む (「プラグインを足す」)                                                                                                                                                                                                      |
| `overrides` の中の `plugins` はトップレベルと逆で、継承した集合への追加になる                     | override に 1 つだけ書いても、ベースのプラグインは無効にならない。絞ったつもりで絞れていない                | override でプラグインを絞ろうとしない。`overrides` は `categories` も持てない                                                                                                                                                                                           |
| サブディレクトリに置いた `.oxlintrc.json` は `vp lint` に読まれない                               | `"error"` にしても診断は出ず、`"off"` にしても CLI の指定が通る。丸ごと no-op になる                        | 設定は `vite.config.ts` の `lint` にまとめる。Vite+ の lint の docs も `.oxlintrc.json` の併用を推奨しない                                                                                                                                                              |
| CLI の `-D` は未知のルール名を無視する (exit 0、診断なし)                                         | 打ち間違いが「違反 0 件」に見える                                                                           | 0 件を結論にする前に `--print-config` にそのルール名があるかを確かめる                                                                                                                                                                                                  |
| `-D` にプラグイン名を付けずにルール名を渡すと、同じ名前のルールを持つプラグインがすべて有効になる | 2026-09-23 に oxlint 1.82.0 で、`-D prefer-spread` が eslint と unicorn の両方の `prefer-spread` を報告した | `-D eslint/prefer-spread` のようにプラグイン名を付ける。件数は診断の `plugin(rule)` 別に数える                                                                                                                                                                          |
| `overrides` の `files` の否定 glob (`!**/*.test.ts`) は除外として効かない                         | oxlint 1.79.0 で、最小構成で除外されなかった (2026-09-14)                                                   | `excludeFiles` を使う (ADR-0008)                                                                                                                                                                                                                                        |
| `vitest` プラグインはテストファイル以外にも効く                                                   | 行頭がテストの呼び出しに見えるコメントが、テストファイルの外でも `no-commented-out-tests` で報告される      | コメントの行頭をテストの呼び出しの形にしない                                                                                                                                                                                                                            |
| `rules` に `"warn"` と書く                                                                        | `vp check` は warn を exit code に出さない。新しいコードの違反が通る                                        | `"error"` で書く。移行を待つ間も warn に下げない (「testing-library を story に限る理由」の `no-debugging-utils` と同じ判断)。`lint.categories` の格上げ (warn を error へ) も外さない。`scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で固定している |

## explanation

### plugins は既定集合を置換する

`lint.plugins` は既定集合 (`typescript` / `unicorn` / `oxc`) へ追加する設定ではなく、**置換する**。
`plugins: ["react"]` と書くと `typescript` が無効になり、`rules` に書いた `typescript/*` の設定は 1 件も検出しなくなる。

**有効でないプラグインのルール設定は、ルール名が検証されるにもかかわらず無診断で捨てられる。**

| `plugins`     | `rules` に書いたルール                  | 結果                         |
| ------------- | --------------------------------------- | ---------------------------- |
| `["react"]`   | `typescript/consistent-type-assertions` | exit 0、無出力               |
| 未指定 (既定) | `vitest/expect-expect`                  | exit 0、無出力               |
| 未指定 (既定) | `unicorn/no-null`                       | exit 1、検出する             |
| いずれでも    | `vitest/no-such-rule-here`              | exit 1、`Rule ... not found` |

判定は既定集合への所属ではなく、その時点で有効かどうかだけで決まる。
`--print-config` の解決後設定からも消えるため、設定を出力しても気付けない。

`eslint` のコアルールだけは `plugins` の指定によらず常時有効で、列挙しても解決後の `plugins` からは落ちる。

ルール名からプラグインを推測しない。
`no-array-index-key` と `no-object-type-as-default-prop` は名前から `react-perf` に属すると読めるが、実際は `react` にしかない。
誤ったプラグインへ指定した場合は `Rule '...' not found in plugin '...'` で落ちる (こちらは fail-loud)。

| 案                                       | 評価                                                                        | 採否     |
| ---------------------------------------- | --------------------------------------------------------------------------- | -------- |
| 既定集合を定数化し、追加プラグインを積む | 置換の仕様をコードに表し、既定検査が silent に消えるのを防げる              | **採用** |
| 既定集合を暗黙に任せ、追加分だけ書く     | `plugins` が既定集合を置換するため `typescript` 等が無効になる              | 却下     |
| `eslint` も `plugins` に列挙する         | 置換対象ではなく常時有効で、書いても解決後の `plugins` から落ちる           | 却下     |
| registry コードを lint 対象から除外する  | ADR-0020 の既定は改変して許容リストへ記録する運用で、除外はそれを反転させる | 却下     |

- 出典: oxlint の configuration file reference (「Setting the `plugins` field will overwrite the base set of plugins.」、`overrides` が受け付けるキー、2026-09-24 に確認): https://oxc.rs/docs/guide/usage/linter/config-file-reference.html#plugins
- 出典: Vite+ の lint (「We do not recommend using `oxlint.config.ts` or `.oxlintrc.json` with Vite+.」、2026-09-24 に確認): https://viteplus.dev/guide/lint

### jsx-a11y は名指しがゼロになる

上流 recommended のルールは全て `correctness` 経由で `error` になっており、`rules` へ足す先が 1 つも残らない。
そのため `"jsx-a11y/<name>"` の行は 1 つも書いていない。
判定を後から読めるよう、`vite.config.ts` の `rules` には jsx-a11y のセクション見出しコメントだけを置く。見出しが無いと「検討していない」と区別できない。

recommended 外だが `correctness` 経由で有効なままのルールが 4 つある。
`control-has-associated-label` / `lang` / `no-aria-hidden-on-focusable` / `prefer-tag-over-role` で、いずれも有効のまま残す。
off にする判断は違反が出たときに個別に行う (registry コードでの行単位抑制は台帳 `docs/registry-deviations.md` が持つ)。

`anchor-ambiguous-text` は oxlint に実装があり名指しすれば足せるが、上流 recommended に含まれないため足さない。

### testing-library を story に限る理由

`testing-library` は oxlint ネイティブではなく `jsPlugins` で載せるが、基準は上流の `flat/react` を写す。`@shadcn/lint` と違い上流に recommended があるためである。

適用を story に限るのは、緩和ではなく適用範囲の確定である。対象は `*.stories.{ts,tsx}` と `*.story-helpers.{ts,tsx}` の両方で、play を helper へ切り出したときにルールが外れないようにする。種別も拡張子も字面で並べ直さず `scripts/lib/companion-files.ts` の `storyGlobs` から引く。`.storybook/main.ts` が ts / tsx の両方を story として扱うので、片方だけに絞るとルールが無言で外れる。`*.test.tsx` は `vitest-browser-react` の locator API を使い、`screen.container` や `getByText(...).query()` が testing-library の同名 API と意味が違う。当てると誤検出が出る。支配的なのは `render-result-naming-convention` で、`vitest-browser-react` は render の結果を `screen` と名付けて locator を返すが、testing-library はその名前も戻り値も別物として扱う。件数は `vite.config.ts` の `files` を `*.test.tsx` へ広げて `vp lint` を走らせれば出る。story 側は `storybook/test` が testing-library をそのまま re-export しており、Aggressive Reporting が module の判定を解決する。

| ルール                  | 外す理由                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefer-screen-queries` | play が受け取る `canvas` を render 結果の分割代入と誤読する。`canvas` は Storybook が渡す query 済みオブジェクトで、上流の `write-story` skill が「✅ Correct: Use canvas directly」と指定している形                                                                                                                                                   |
| `no-node-access`        | `flat/react` の中でこれだけが strict 判定 (`isTestingLibraryImported(true)`) で Aggressive Reporting を迂回し、`storybook/test` 経由の story では一度も発火しない。`settings` の `testing-library/utils-module` を足せば発火するが、その形は、accessibility tree に差が出ない対象に限って `querySelector` で掴み、理由を実装近傍に書く運用と両立しない |

- `no-debugging-utils` を `error` へ上げるのは、`vp check` が warn で exit 1 にならず、`warn` のままだと commit された `screen.debug()` が素通りするためである
- `no-node-access` を有効のまま残すと、設定上は error でも無検査になる
- このプラグインは ESLint 本体を依存へ持ち込む。`packageExtensions` で peer を optional にしても外さない。`@typescript-eslint/utils` のルート import が `eslint` を実行時に読むため、外せたとしてもプラグインが落ちるからである (2026-09-20 に 3 通り試して実測)。機序 (`eslint` を必須 peer に持つ依存が連鎖すること) は `vp why eslint` で見る。oxlint の jsPlugins が読み込む中でだけ動き、出荷物には入らない。
- `eslint-plugin-testing-library` の追加で dev 依存が増え、`eslint` が展開される。増分は `git diff pnpm-lock.yaml` の `packages:` の差で数える。外すと `Failed to load JS plugin: eslint-plugin-testing-library / Cannot find module 'eslint'` で config のパースごと落ちるため fail-closed である

### TypeScript 向け variant の off を写さない理由

eslint コアと `import` の TypeScript 向け variant は、off にする側を機械的には写さない。
上流が off にする根拠は「同じ誤りを TypeScript が既に扱う」ことで、off の各行には `ts(2451)` のような診断コードが添えられている。
このリポジトリでも型検査は tsgolint が同じコードで報告するため、根拠自体は成り立つ。
それでも写さずに個別判断へ落とすのは、oxlint 側でそのルールが報告する場面が残っているかがルールごとに違うためで、off にするかは probe の実測で決める。
error にする側の 4 ルール (`eslint-recommended`) は根拠の向きが逆で、基準に含める (ADR-0007「基準にする上流設定」)。

### テストファイルで 5 ルールを緩める理由

この 5 つは typescript-eslint 本体が自身のテストディレクトリで off にしているものと同一である。
モックは意図的に型を外した値を扱い、assertion は取り出す要素の存在を前提に書くため、欠陥ではなく書き方そのものに鳴る。上流も同じ判断をしているので、off の理由をこちらで発明する必要がない。
`no-non-null-assertion` を strict 採用の動機に挙げていることとは矛盾しない。
`array[expr]!` が silent failure になるのは lookup miss の結果が後段へ流れるからで、テストでは `!` の空振りがその場で TypeError になりテストの失敗として見える。

### `correctness` と基準のずれ

oxlint のカテゴリは実装者がルールを分類した軸で、上流の recommended とは一致しない (ADR-0007)。そのため次のずれが起きる。

- 基準が off にするルールでも、`correctness` に入っていればカテゴリ側が勝つ。`rules` で明示的に off にしないと有効のまま残る

### React Compiler の既定 off のルール

eslint-plugin-react-hooks が既定で off にするルールのうち、oxlint に実装があるのは 9 で、有効になるのは `perf` 経由の 1 つだけである。
分割後の 22 ルールは、上流 recommended-latest に入る 13 (`correctness` の 12 と `unsupported-syntax`) とこの 9 で尽きる。`exhaustive-deps` と `rules-of-hooks` は分割前からあるルールで、22 には含まれない。

| ルール                                                                                 | oxlint のカテゴリ | 扱い                                                                              |
| -------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `no-deriving-state-in-effects`                                                         | `perf`            | カテゴリ経由で error                                                              |
| `invariant` / `rule-suppression` / `syntax` / `todo`                                   | `restriction`     | off。`todo` は Compiler の未実装による bail out で、欠陥として扱わない (ADR-0014) |
| `capitalized-calls` / `exhaustive-effect-dependencies` / `hooks` / `memo-dependencies` | `suspicious`      | off。上流が既定から外している                                                     |

どれを名指しして引き上げるかは ADR-0007「React Compiler のルールは eslint-plugin-react-hooks を基準にする」が決める。
