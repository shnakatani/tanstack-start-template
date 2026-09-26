# 自前の lint ルール

`jsPlugins` に自前のルールを書くときの手順と、JS plugin の落とし穴を持つ。

| 決定                                                                      | ADR      |
| ------------------------------------------------------------------------- | -------- |
| ブラウザテストの規範は jsPlugins の自前ルール (`browser-test/*`) で止める | ADR-0009 |
| 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める     | ADR-0023 |

## how-to

### 自前のルールを書く

`scripts/lint/` に置き、`vite.config.ts` の `lint.jsPlugins` から読む (ADR-0009)。実例は `scripts/lint/browser-test.ts` とそのテスト `scripts/lint/browser-test.test.ts`。

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

## JS plugin の落とし穴

JS plugin を足す前に、oxlint ネイティブのルールで代替できないかを確かめる。JS plugin は lint の時間を伸ばし、`jsPlugins` は oxlint 側が alpha 扱いにしている。`@shadcn/lint` を足したのは、oxlint が Tailwind と shadcn/ui の領域のルールをネイティブに持たないためである (ADR-0023)。

| 落とし穴                                                                                                            | 起きること                                                                                                                                                                                 | 避け方                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 抑制 directive に登録していない名前を書いてもエラーにならない                                                       | ルールは有効なまま、抑制だけが無言で外れる (2026-09-19 に Oxlint 1.82.0 で実測)                                                                                                            | `jsPlugins` のエントリを `{ name, specifier }` で書き、directive はその `name` で書く。`@shadcn/lint` は `{ name: "shadcn", specifier: "@shadcn/lint" }`      |
| `rules` のキーに別名 (`@shadcn/lint/no-raw-colors`) を書く                                                          | 設定のパースが `Plugin '@shadcn/lint' not found` で落ちる                                                                                                                                  | plugin の `meta.name`、診断コード、rule key、抑制 directive が同じ名前 (`shadcn`) を共有する                                                                  |
| `--print-config` は JS plugin を読み込む前に短絡し、plugin 由来のルール名を捨てる (oxc-project/oxc#22117)           | `jsPlugins` の宣言は出力に出るが、`shadcn/*` のルールは出ず、無効に見える                                                                                                                  | 発火は`docs/guides/lint/tailwind-and-shadcn.md`「`@shadcn/lint` の発火を確かめる」の probe で見る                                                             |
| `settings.shadcn.componentImports` や `variantFunctions` を消しても、`--print-config` に `settings.shadcn` が出ない | `componentImports` を消すと自作部品が規則から見えなくなり、routes からの上書きが素通りする。`variantFunctions` を消すと variant 関数の呼び出しが落ちる。宣言が消えたことを見張るものは無い | どちらも消さない。宣言の理由は`docs/guides/lint/tailwind-and-shadcn.md`「variant 関数を宣言する」(`variantFunctions`) と ADR-0023 (`componentImports`) が持つ |
| 引数を取らない関数を `mergeFunctions` へ登録する                                                                    | 規則を通しながら、戻り値の中身の検査を落とせる (2026-09-19 実測)                                                                                                                           | 抜け道として使わない。variant 関数は `variantFunctions` へ宣言する (`docs/guides/lint/tailwind-and-shadcn.md`「variant 関数を宣言する」)                      |
| package 名に `/` を含む plugin を、`name` を指定せずに載せる                                                        | 設定の rule key は解決できるが、抑制 directive の解決が追いついていない (oxc の PR 17073)                                                                                                  | `name` に `/` を含まない別名を付ける。TanStack の plugin は `tanstack-query` / `tanstack-router`                                                              |
