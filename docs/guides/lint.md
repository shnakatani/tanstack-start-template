# lint の運用

Oxlint の設定を書き換えるとき、ルールを足すとき、自前のルールを書くときの手順と落とし穴を持つ。

| 決定                                                                           | ADR      |
| ------------------------------------------------------------------------------ | -------- |
| ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする | ADR-0012 |
| 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める          | ADR-0032 |
| assert には locator を渡し、matcher の無い実測は `expect.poll` の中で読む      | ADR-0044 |

## how-to

### 設定を書き換えたら解決後の設定で確かめる

oxlint は「設定したつもりで効いていない」状態を診断なしで作る (「設定の落とし穴」)。設定の文面ではなく、`vp lint --print-config` が出す解決後の設定か、実際の診断で確かめる。

- `scripts/checks/integrity/lint-config.test.ts` は解決後の設定の `plugins` を期待値と突き合わせる。プラグインを足したら、そのテストの `EXPECTED_PLUGINS` にも足す
- 同じテストは、`vite.config.ts` の `lint.rules` に書いたキーが `--print-config` の `rules` に残るかも見る。プラグインの脱落で捨てられたルールを、名指し単位で見つけられる
- 突き合わせでは 2 つのキーの形をまたぐ。eslint コアのルールは接頭辞なしで出力され、`typescript/` 接頭辞で書いた extension rule はコアのルール名へ解決される (2026-09-02 時点で `no-array-constructor` と `no-useless-constructor` の 2 件)。解決先が `correctness` なら名指しは no-op なので、`--print-config` で実効を比べる
- React Compiler 由来のルールは `--print-config` の `rules` を `react/` で絞り、eslint-plugin-react-hooks のルール一覧と比べる
- jsx-a11y は `--print-config` の `rules` を `jsx_a11y/` で絞り、上流 recommended の一覧と `comm` で両方向の差を取る。`rules` は「カテゴリで有効になったもの」と「名指ししたもの」の和なので、名前が出れば有効と読んでよい

`--print-config` から有効と読めるのは、名前が出ている場合だけである。JS plugin 由来のルールは出力に出ないので、無いことは無効の証拠にならない (「JS plugin の落とし穴」)。

### ルールを足すか迷ったら

1. 上流 recommended に入っているかを確かめる (基準表は ADR-0012)
2. 入っていないものを足すなら、ADR-0012「基準から外れる名指し」の表に理由と一緒に追記する
3. 基準と違うオプションを置くなら、理由を `vite.config.ts` のそのルールの行のコメントに書く

### 上流 recommended の改訂に追随する

名指ししたルールは `rules` に並ぶので、上流 recommended の改訂には自動で追随しない。
oxlint (Vite+ 同梱) の minor 以上の更新が Dependabot の PR で来たら、ADR-0012 の基準表のプラグインごとに上流の一覧と突き合わせる。
typescript-eslint は依存に入っていないので、`strict` の改訂を知らせるものが無い。ADR-0012 を読み直すときに追随する。

`jsPlugins` は oxlint 側が alpha 扱いで、semver の対象外と明記している。Dependabot の PR を処理するときに、plugin の読み込みと、`@shadcn/lint` の 3 ルールの発火の両方を確かめる (「`@shadcn/lint` の発火を確かめる」)。

### プラグインを足したら違反を分ける

プラグインを足すと、既存の違反が一度に出る。件数が多く、直すか外すかの判断軸が別のものは、別の変更に分ける。1 つの変更に混ぜると、どの判断でどの違反を消したかがレビューで追えない。

違反を数えるときは、診断の `plugin(rule)` 別に数える (「設定の落とし穴」の `-D`)。`require-static-classes` の件数は `vp lint 2>&1 | grep -c 'require-static-classes'` で測り直せる。

### プラグインを足す

`vite.config.ts` に `OXLINT_DEFAULT_PLUGINS` 定数で既定集合を明示し、その spread へ追加プラグインを積む。

```ts
const OXLINT_DEFAULT_PLUGINS = ["typescript", "unicorn", "oxc"] as const;
// lint.plugins: [...OXLINT_DEFAULT_PLUGINS, "react", "import", "promise", "jsdoc", "vitest", "jsx-a11y"]
```

spread を落として追加分だけを書くと、`typescript` を含む既定の検査が無言で消える。
プラグインを 1 つ足すたびに確かめる不変条件である。

- 足したら `scripts/checks/integrity/lint-config.test.ts` の `EXPECTED_PLUGINS` にも足す (「設定を書き換えたら解決後の設定で確かめる」)
- 行単位の抑制は領域を問わず使ってよい。registry コードで要るのは台帳 `docs/registry-deviations.md` への記録であって、抑制の可否そのものではない

### testing-library を当てる範囲

story は `storybook/test` 経由で testing-library の API をそのまま使う。oxlint は testing-library をネイティブに持たないため、`jsPlugins` で ESLint plugin として載せる。

| プラグイン        | 基準                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testing-library` | eslint-plugin-testing-library の `flat/react`。適用は story 本体と story 専用の helper に限る (対象は `companion-files.ts` の `storyGlobs` が唯一の定義) |

`testing-library` は oxlint ネイティブではなく `jsPlugins` で載せるが、基準は上流の `flat/react` を写す。`@shadcn/lint` と違い上流に recommended があるためである。

適用を story に限るのは、緩和ではなく適用範囲の確定である。対象は `*.stories.{ts,tsx}` と `*.story-helpers.{ts,tsx}` の両方で、play を helper へ切り出したときにルールが外れないようにする。種別も拡張子も字面で並べ直さず `companion-files.ts` の `storyGlobs` から引く。`.storybook/main.ts` が ts / tsx の両方を story として扱うので、片方だけに絞るとルールが無言で外れる。`*.test.tsx` は `vitest-browser-react` の locator API を使い、`screen.container` や `getByText(...).query()` が testing-library の同名 API と意味が違う。当てると誤検出が出る。支配的なのは `render-result-naming-convention` で、`vitest-browser-react` は render の結果を `screen` と名付けて locator を返すが、testing-library はその名前も戻り値も別物として扱う。件数は `vite.config.ts` の `files` を `*.test.tsx` へ広げて `vp lint` を走らせれば出る。story 側は `storybook/test` が testing-library をそのまま re-export しており、Aggressive Reporting が module の判定を解決する。

基準からの逸脱は下表のとおりで、外すものと severity を上げるものがある。

| ルール                  | 外す理由                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefer-screen-queries` | play が受け取る `canvas` を render 結果の分割代入と誤読する。`canvas` は Storybook が渡す query 済みオブジェクトで、上流の `write-story` skill が「✅ Correct: Use canvas directly」と指定している形                                                                                                                                                   |
| `no-node-access`        | `flat/react` の中でこれだけが strict 判定 (`isTestingLibraryImported(true)`) で Aggressive Reporting を迂回し、`storybook/test` 経由の story では一度も発火しない。`settings` の `testing-library/utils-module` を足せば発火するが、その形は、accessibility tree に差が出ない対象に限って `querySelector` で掴み、理由を実装近傍に書く運用と両立しない |

`no-debugging-utils` は upstream が `warn` だが `error` へ上げる。`vp check` は warn で exit 1 にならないため、`warn` のままだと commit された `screen.debug()` が素通りする。
`no-node-access` を有効のまま残すと、設定上は error でも無検査になる。

このプラグインは ESLint 本体を依存へ持ち込む。`packageExtensions` で peer を optional にしても外さない。`@typescript-eslint/utils` のルート import が `eslint` を実行時に読むため、外せたとしてもプラグインが落ちるからである (2026-09-20 に 3 通り試して実測)。機序 (`eslint` を必須 peer に持つ依存が連鎖すること) は `pnpm-workspace.yaml` のコメントが持つ。oxlint の jsPlugins が読み込む中でだけ動き、出荷物には入らない。撤去条件は typescript-eslint#11939 (`utils` から `eslint` の import を外し `/ts-eslint` を型専用にする) が入ることで、oxc-project/oxc#17734 が oxlint 側の追跡先である。

- `eslint-plugin-testing-library` の追加で dev 依存が増え、`eslint` が展開される。増分は `git diff pnpm-lock.yaml` の `packages:` の差で数える。外すと `Failed to load JS plugin: eslint-plugin-testing-library / Cannot find module 'eslint'` で config のパースごと落ちるため fail-closed である

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

対象を絞った緩和はテストの 1 経路だけに置く。
`**/*.test.{ts,tsx}` と `src/test/**` で off にするのは次の 5 つに限る。

`no-non-null-assertion` / `no-unsafe-assignment` / `no-unsafe-call` / `no-unsafe-member-access` / `no-unsafe-return`

この 5 つは typescript-eslint 本体が自身のテストディレクトリで off にしているものと同一である。
範囲を絞って有効にするルール (`no-restricted-imports`) は緩和ではないので、この経路に載せず `excludeFiles` で対象を外す (ADR-0014)。
モックは意図的に型を外した値を扱い、assertion は取り出す要素の存在を前提に書くため、欠陥ではなく書き方そのものに鳴る。上流も同じ判断をしているので、off の理由をこちらで発明する必要がない。

`no-non-null-assertion` を strict 採用の動機に挙げていることとは矛盾しない。
`array[expr]!` が silent failure になるのは lookup miss の結果が後段へ流れるからで、テストでは `!` の空振りがその場で TypeError になりテストの失敗として見える。

テストファイルを type-aware lint の対象から外すことはしない。緩和は名指しの 5 ルールに限る。

### 行単位で抑制する

- `oxlint-disable-next-line` は、違反が報告される行の直前に置く。`.map()` の行に置いても、その中の `key` の行には効かない
- 同じ行に複数のルールが鳴るときは、カンマで区切って 1 行にまとめる。`oxlint-disable-next-line` を 2 行積むと、2 行目が 1 行目のコメント行を「次の行」と解釈して no-op になり、1 件しか抑制されない
- 抑制の directive に書くプラグイン名は、`jsPlugins` のエントリの `name` と揃える (「JS plugin の落とし穴」)
- registry コードの中の抑制は、台帳 `docs/registry-deviations.md` の「行単位の lint 抑制」にも記録する (ADR-0027)
- `perf` の `no-await-in-loop` は順序に依存するループにも鳴る。逐次でないと壊れるループは `Promise.all` へ倒さず、抑制して順序が要る理由を書く

### `@shadcn/lint` の発火を確かめる

3 ルール (`no-raw-colors` / `no-arbitrary-values` / `no-unknown-classes`) の発火は `--print-config` に出ない。次を一時ファイルへ置いて `vp lint <path>` を走らせ、3 行とも診断が出たら消す。

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

- JS plugin は lint の時間を伸ばす。測るときは `time vp lint` を 2 回ずつ実行して、2 回目同士を比べる。1 回目には解決のコストが乗る
- theme と component の探索に失敗すると、`vp lint` の出力に `[@shadcn/lint]` の警告が出る (2026-09-19 に実測)。`components.json` の `tailwind.css` が無いパスなら代わりの stylesheet を使う旨、Tailwind を import する stylesheet が無ければ `no-raw-colors` が宣言済みの token を確かめられない旨、`ui` alias がディレクトリに解決しなければ design system component を認識しない旨を報告する。3 ルールは警告を出したまま発火し続け、診断の token の提案が減る

### 自前のルールを書く

`scripts/lint/` に置き、`vite.config.ts` の `lint.jsPlugins` から読む (ADR-0044)。実例は `scripts/lint/browser-test.ts` とそのテスト `scripts/lint/browser-test.test.ts`。

- API は同梱の `node_modules/vite-plus/docs/guide/lint.md`「Writing Your Own Rules」に従う。型は `vite-plus/lint/plugins` の `definePlugin` / `defineRule` / `SourceCode`、テストは `vite-plus/lint/plugins-dev` の `RuleTester` から取る
- `@oxlint/plugins` と `oxlint` を直接の依存に足さない。同 docs が理由を 2 つ挙げる。別に pin した写しが linter 本体からずれること、pnpm の strict な layout では plugin のファイルから解決できないことである。vite-plus 0.3.2 の版には両方の entrypoint があり、2026-09-22 に型解決とルールのテストが通ることを確かめた
- 木は親だけを辿る。oxlint の node は `parent` を持つので、`Object.values` で部分木を降りる走査は木を登り直して無限再帰する (2026-09-22 に `RangeError: Maximum call stack size exceeded` で観測)。判定は、値の使われ方を上へ辿る形で書く
- oxlint の JS plugin は型情報を持たない (公式の JS plugin ガイドが「Lint rules that rely on TypeScript type-awareness」を未対応に挙げる)。名前だけで判定するなら、`overrides` の適用範囲で誤検出を補う

### 検査を作ったら 2 通りに壊して確かめる

ルールや検査を足したら、効かなくなる壊し方を 2 つ決め、どちらでも赤になることを確かめる。

| 壊し方 | 例 (`browser-test/prefer-locator-methods` の場合)        | 確かめること                     |
| ------ | -------------------------------------------------------- | -------------------------------- |
| 直接   | `vite.config.ts` の `lint.rules` でルールを `off` にする | 違反が 1 件も報告されなくなる    |
| 間接   | 設定は残したまま、判定の一部 (変数束縛の追跡) を止める   | 束縛を挟んだ違反だけが無言で通る |

間接の側が要るのは、一部の形だけが外れても残りは報告され続け、設定が有効に見えるためである。壊した形はルールのテストの invalid に置いておく。

## 設定の落とし穴

どれも「設定したつもりで効いていない」状態を、診断なしで作る。

| 落とし穴                                                                                          | 起きること                                                                                                  | 避け方                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| トップレベルの `plugins` は既定集合を置換する                                                     | spread を落とすと `typescript` を含む既定の検査が消える                                                     | `OXLINT_DEFAULT_PLUGINS` を spread して積む (「プラグインを足す」)                                                                                                                                                                                               |
| `overrides` の中の `plugins` はトップレベルと逆で、継承した集合への追加になる                     | override に 1 つだけ書いても、ベースのプラグインは無効にならない。絞ったつもりで絞れていない                | override でプラグインを絞ろうとしない。`overrides` は `categories` も持てない                                                                                                                                                                                    |
| サブディレクトリに置いた `.oxlintrc.json` は `vp lint` に読まれない                               | `"error"` にしても診断は出ず、`"off"` にしても CLI の指定が通る。丸ごと no-op になる                        | 設定は `vite.config.ts` の `lint` にまとめる。Vite+ の lint の docs も `.oxlintrc.json` の併用を推奨しない                                                                                                                                                       |
| CLI の `-D` は未知のルール名を無視する (exit 0、診断なし)                                         | 打ち間違いが「違反 0 件」に見える                                                                           | 0 件を結論にする前に `--print-config` にそのルール名があるかを確かめる                                                                                                                                                                                           |
| `-D` にプラグイン名を付けずにルール名を渡すと、同じ名前のルールを持つプラグインがすべて有効になる | 2026-09-23 に oxlint 1.82.0 で、`-D prefer-spread` が eslint と unicorn の両方の `prefer-spread` を報告した | `-D eslint/prefer-spread` のようにプラグイン名を付ける。件数は診断の `plugin(rule)` 別に数える                                                                                                                                                                   |
| `overrides` の `files` の否定 glob (`!**/*.test.ts`) は除外として効かない                         | oxlint 1.79.0 で、最小構成で除外されなかった (2026-09-14)                                                   | `excludeFiles` を使う (ADR-0014)                                                                                                                                                                                                                                 |
| `vitest` プラグインはテストファイル以外にも効く                                                   | 行頭がテストの呼び出しに見えるコメントが、テストファイルの外でも `no-commented-out-tests` で報告される      | コメントの行頭をテストの呼び出しの形にしない                                                                                                                                                                                                                     |
| `rules` に `"warn"` と書く                                                                        | `vp check` は warn を exit code に出さない。新しいコードの違反が通る                                        | `"error"` で書く。移行を待つ間も warn に下げない (「testing-library を当てる範囲」の `no-debugging-utils` と同じ判断)。`lint.categories` の格上げ (warn を error へ) も外さない。`scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で固定している |

## JS plugin の落とし穴

JS plugin を足す前に、oxlint ネイティブのルールで代替できないかを確かめる。JS plugin は lint の時間を伸ばし、`jsPlugins` は oxlint 側が alpha 扱いにしている。`@shadcn/lint` を足したのは、oxlint が Tailwind と shadcn/ui の領域のルールをネイティブに持たないためである (ADR-0032)。

| 落とし穴                                                                                                            | 起きること                                                                                                                                                                                 | 避け方                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 抑制 directive に登録していない名前を書いてもエラーにならない                                                       | ルールは有効なまま、抑制だけが無言で外れる (2026-09-19 に Oxlint 1.82.0 で実測)                                                                                                            | `jsPlugins` のエントリを `{ name, specifier }` で書き、directive はその `name` で書く。`@shadcn/lint` は `{ name: "shadcn", specifier: "@shadcn/lint" }` |
| `rules` のキーに別名 (`@shadcn/lint/no-raw-colors`) を書く                                                          | 設定のパースが `Plugin '@shadcn/lint' not found` で落ちる                                                                                                                                  | plugin の `meta.name`、診断コード、rule key、抑制 directive が同じ名前 (`shadcn`) を共有する                                                             |
| `--print-config` は JS plugin を読み込む前に短絡し、plugin 由来のルール名を捨てる (oxc-project/oxc#22117)           | `jsPlugins` の宣言は出力に出るが、`shadcn/*` のルールは出ず、無効に見える                                                                                                                  | 発火は「`@shadcn/lint` の発火を確かめる」の probe で見る                                                                                                 |
| `settings.shadcn.componentImports` や `variantFunctions` を消しても、`--print-config` に `settings.shadcn` が出ない | `componentImports` を消すと自作部品が規則から見えなくなり、routes からの上書きが素通りする。`variantFunctions` を消すと variant 関数の呼び出しが落ちる。宣言が消えたことを見張るものは無い | どちらも消さない。宣言の理由は ADR-0031 (`variantFunctions`) と ADR-0032 (`componentImports`) が持つ                                                     |
| 引数を取らない関数を `mergeFunctions` へ登録する                                                                    | 規則を通しながら、戻り値の中身の検査を落とせる (2026-09-19 実測)                                                                                                                           | 抜け道として使わない。variant 関数は `variantFunctions` へ宣言する (ADR-0031)                                                                            |

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
| registry コードを lint 対象から除外する  | ADR-0027 の既定は改変して許容リストへ記録する運用で、除外はそれを反転させる | 却下     |

### jsx-a11y は名指しがゼロになる

上流 recommended のルールは全て `correctness` 経由で `error` になっており、`rules` へ足す先が 1 つも残らない。
そのため `"jsx-a11y/<name>"` の行は 1 つも書いていない。
判定を後から読めるよう、`vite.config.ts` の `rules` には jsx-a11y のセクション見出しコメントだけを置く。見出しが無いと「検討していない」と区別できない。

recommended 外だが `correctness` 経由で有効なままのルールが 4 つある。
`control-has-associated-label` / `lang` / `no-aria-hidden-on-focusable` / `prefer-tag-over-role` で、いずれも有効のまま残す。
off にする判断は違反が出たときに個別に行う (registry コードでの行単位抑制は台帳 `docs/registry-deviations.md` が持つ)。

`anchor-ambiguous-text` は oxlint に実装があり名指しすれば足せるが、上流 recommended に含まれないため足さない。

### `correctness` と基準のずれ

oxlint のカテゴリは実装者がルールを分類した軸で、上流の recommended とは一致しない (ADR-0012)。そのため次のずれが起きる。

- 基準が off にするルールでも、`correctness` に入っていればカテゴリ側が勝つ。`rules` で明示的に off にしないと有効のまま残る

### React Compiler の既定 off のルール

eslint-plugin-react-hooks が既定で off にするルールのうち、oxlint に実装があるのは 9 で、有効になるのは `perf` 経由の 1 つだけである。
分割後の 22 ルールは、上流 recommended-latest に入る 13 (`correctness` の 12 と `unsupported-syntax`) とこの 9 で尽きる。`exhaustive-deps` と `rules-of-hooks` は分割前からあるルールで、22 には含まれない。

| ルール                                                                                 | oxlint のカテゴリ | 扱い                                                                              |
| -------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `no-deriving-state-in-effects`                                                         | `perf`            | カテゴリ経由で error                                                              |
| `invariant` / `rule-suppression` / `syntax` / `todo`                                   | `restriction`     | off。`todo` は Compiler の未実装による bail out で、欠陥として扱わない (ADR-0019) |
| `capitalized-calls` / `exhaustive-effect-dependencies` / `hooks` / `memo-dependencies` | `suspicious`      | off。上流が既定から外している                                                     |

どれを名指しして引き上げるかは ADR-0012「React Compiler のルールは eslint-plugin-react-hooks を基準にする」が決める。
