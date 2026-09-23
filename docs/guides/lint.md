# lint の運用

Oxlint の設定を書き換えるとき、ルールを足すとき、自前のルールを書くときの手順と落とし穴を持つ。

| 決定                                                                           | ADR      |
| ------------------------------------------------------------------------------ | -------- |
| 有効にするプラグインは既定集合を明示して積む                                   | ADR-0010 |
| ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする | ADR-0011 |
| 色は `@theme` と `@shadcn/lint` の 2 層で semantic token に閉じ込める          | ADR-0031 |
| assert には locator を渡し、matcher の無い実測は `expect.poll` の中で読む      | ADR-0043 |

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

1. 上流 recommended に入っているかを確かめる (基準表は ADR-0011)
2. 入っていないものを足すなら、ADR-0011「基準から外れる名指し」の表に理由と一緒に追記する
3. 基準と違うオプションを置くなら、理由を `vite.config.ts` のそのルールの行のコメントに書く

### 上流 recommended の改訂に追随する

名指ししたルールは `rules` に並ぶので、上流 recommended の改訂には自動で追随しない。
oxlint (Vite+ 同梱) の minor 以上の更新が Dependabot の PR で来たら、ADR-0011 の基準表のプラグインごとに上流の一覧と突き合わせる。
typescript-eslint は依存に入っていないので、`strict` の改訂を知らせるものが無い。ADR-0011 を読み直すときに追随する。

`jsPlugins` は oxlint 側が alpha 扱いで、semver の対象外と明記している。Dependabot の PR を処理するときに、plugin の読み込みと、`@shadcn/lint` の 3 ルールの発火の両方を確かめる (「`@shadcn/lint` の発火を確かめる」)。

### プラグインを足したら違反を分ける

プラグインを足すと、既存の違反が一度に出る。件数が多く、直すか外すかの判断軸が別のものは、別の変更に分ける。1 つの変更に混ぜると、どの判断でどの違反を消したかがレビューで追えない。

違反を数えるときは、診断の `plugin(rule)` 別に数える (「設定の落とし穴」の `-D`)。`require-static-classes` の件数は `vp lint 2>&1 | grep -c 'require-static-classes'` で測り直せる。

### 行単位で抑制する

- `oxlint-disable-next-line` は、違反が報告される行の直前に置く。`.map()` の行に置いても、その中の `key` の行には効かない
- 同じ行に複数のルールが鳴るときは、カンマで区切って 1 行にまとめる。`oxlint-disable-next-line` を 2 行積むと、2 行目が 1 行目のコメント行を「次の行」と解釈して no-op になり、1 件しか抑制されない
- 抑制の directive に書くプラグイン名は、`jsPlugins` のエントリの `name` と揃える (「JS plugin の落とし穴」)
- registry コードの中の抑制は、台帳 `docs/registry-deviations.md` の「行単位の lint 抑制」にも記録する (ADR-0026)
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

`scripts/lint/` に置き、`vite.config.ts` の `lint.jsPlugins` から読む (ADR-0043)。実例は `scripts/lint/browser-test.ts` とそのテスト `scripts/lint/browser-test.test.ts`。

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

| 落とし穴                                                                                          | 起きること                                                                                                  | 避け方                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| トップレベルの `plugins` は既定集合を置換する                                                     | spread を落とすと `typescript` を含む既定の検査が消える                                                     | `OXLINT_DEFAULT_PLUGINS` を spread して積む (ADR-0010)                                                                                                                                                                                                    |
| `overrides` の中の `plugins` はトップレベルと逆で、継承した集合への追加になる                     | override に 1 つだけ書いても、ベースのプラグインは無効にならない。絞ったつもりで絞れていない                | override でプラグインを絞ろうとしない。`overrides` は `categories` も持てない                                                                                                                                                                             |
| サブディレクトリに置いた `.oxlintrc.json` は `vp lint` に読まれない                               | `"error"` にしても診断は出ず、`"off"` にしても CLI の指定が通る。丸ごと no-op になる                        | 設定は `vite.config.ts` の `lint` にまとめる。Vite+ の lint の docs も `.oxlintrc.json` の併用を推奨しない                                                                                                                                                |
| CLI の `-D` は未知のルール名を無視する (exit 0、診断なし)                                         | 打ち間違いが「違反 0 件」に見える                                                                           | 0 件を結論にする前に `--print-config` にそのルール名があるかを確かめる                                                                                                                                                                                    |
| `-D` にプラグイン名を付けずにルール名を渡すと、同じ名前のルールを持つプラグインがすべて有効になる | 2026-09-23 に oxlint 1.82.0 で、`-D prefer-spread` が eslint と unicorn の両方の `prefer-spread` を報告した | `-D eslint/prefer-spread` のようにプラグイン名を付ける。件数は診断の `plugin(rule)` 別に数える                                                                                                                                                            |
| `overrides` の `files` の否定 glob (`!**/*.test.ts`) は除外として効かない                         | oxlint 1.79.0 で、最小構成で除外されなかった (2026-09-14)                                                   | `excludeFiles` を使う (ADR-0013)                                                                                                                                                                                                                          |
| `vitest` プラグインはテストファイル以外にも効く                                                   | 行頭がテストの呼び出しに見えるコメントが、テストファイルの外でも `no-commented-out-tests` で報告される      | コメントの行頭をテストの呼び出しの形にしない                                                                                                                                                                                                              |
| `rules` に `"warn"` と書く                                                                        | `vp check` は warn を exit code に出さない。新しいコードの違反が通る                                        | `"error"` で書く。移行を待つ間も warn に下げない (ADR-0012 の `no-debugging-utils`、ADR-0043 の移行と同じ判断)。`lint.categories` の格上げ (warn を error へ) も外さない。`scripts/checks/integrity/lint-config.test.ts` が解決後の設定の値で固定している |

## JS plugin の落とし穴

JS plugin を足す前に、oxlint ネイティブのルールで代替できないかを確かめる。JS plugin は lint の時間を伸ばし、`jsPlugins` は oxlint 側が alpha 扱いにしている。`@shadcn/lint` を足したのは、oxlint が Tailwind と shadcn/ui の領域のルールをネイティブに持たないためである (ADR-0031)。

| 落とし穴                                                                                                            | 起きること                                                                                                                                                                                 | 避け方                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 抑制 directive に登録していない名前を書いてもエラーにならない                                                       | ルールは有効なまま、抑制だけが無言で外れる (2026-09-19 に Oxlint 1.82.0 で実測)                                                                                                            | `jsPlugins` のエントリを `{ name, specifier }` で書き、directive はその `name` で書く。`@shadcn/lint` は `{ name: "shadcn", specifier: "@shadcn/lint" }` |
| `rules` のキーに別名 (`@shadcn/lint/no-raw-colors`) を書く                                                          | 設定のパースが `Plugin '@shadcn/lint' not found` で落ちる                                                                                                                                  | plugin の `meta.name`、診断コード、rule key、抑制 directive が同じ名前 (`shadcn`) を共有する                                                             |
| `--print-config` は JS plugin を読み込む前に短絡し、plugin 由来のルール名を捨てる (oxc-project/oxc#22117)           | `jsPlugins` の宣言は出力に出るが、`shadcn/*` のルールは出ず、無効に見える                                                                                                                  | 発火は「`@shadcn/lint` の発火を確かめる」の probe で見る                                                                                                 |
| `settings.shadcn.componentImports` や `variantFunctions` を消しても、`--print-config` に `settings.shadcn` が出ない | `componentImports` を消すと自作部品が規則から見えなくなり、routes からの上書きが素通りする。`variantFunctions` を消すと variant 関数の呼び出しが落ちる。宣言が消えたことを見張るものは無い | どちらも消さない。宣言の理由は ADR-0030 (`variantFunctions`) と ADR-0031 (`componentImports`) が持つ                                                     |
| 引数を取らない関数を `mergeFunctions` へ登録する                                                                    | 規則を通しながら、戻り値の中身の検査を落とせる (2026-09-19 実測)                                                                                                                           | 抜け道として使わない。variant 関数は `variantFunctions` へ宣言する (ADR-0030)                                                                            |

## explanation

### `correctness` と基準のずれ

oxlint のカテゴリは実装者がルールを分類した軸で、上流の recommended とは一致しない (ADR-0011)。そのため次のずれが起きる。

- 基準が off にするルールでも、`correctness` に入っていればカテゴリ側が勝つ。`rules` で明示的に off にしないと有効のまま残る

### React Compiler の既定 off のルール

eslint-plugin-react-hooks が既定で off にするルールのうち、oxlint に実装があるのは 9 で、有効になるのは `perf` 経由の 1 つだけである。
分割後の 22 ルールは、上流 recommended-latest に入る 13 (`correctness` の 12 と `unsupported-syntax`) とこの 9 で尽きる。`exhaustive-deps` と `rules-of-hooks` は分割前からあるルールで、22 には含まれない。

| ルール                                                                                 | oxlint のカテゴリ | 扱い                                                                              |
| -------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `no-deriving-state-in-effects`                                                         | `perf`            | カテゴリ経由で error                                                              |
| `invariant` / `rule-suppression` / `syntax` / `todo`                                   | `restriction`     | off。`todo` は Compiler の未実装による bail out で、欠陥として扱わない (ADR-0018) |
| `capitalized-calls` / `exhaustive-effect-dependencies` / `hooks` / `memo-dependencies` | `suspicious`      | off。上流が既定から外している                                                     |

どれを名指しして引き上げるかは ADR-0011「React Compiler のルールは eslint-plugin-react-hooks を基準にする」が決める。
