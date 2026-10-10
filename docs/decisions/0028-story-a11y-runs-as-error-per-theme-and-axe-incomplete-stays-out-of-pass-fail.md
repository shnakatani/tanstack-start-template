# ADR-0028: a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` はどちらの層でも合否に入れない

- Status: Accepted
- Date: 2026-10-08

## Context

この ADR は a11y の自動検査の合否を決める。何を合否に入れるかを戻すと、a11y の違反が CI を通り抜ける。

story を書いた部品は、`parameters.a11y.test` の設定しだいで axe の対象になる。同じ axe を 2 つの層が回すので、それぞれの合否に何を入れるかを決める。

| 層                       | きっかけ                       | 対象                     |
| ------------------------ | ------------------------------ | ------------------------ |
| `addon-a11y`             | 全 story × light dark          | story を書いた部品       |
| `expectNoA11yViolations` | `src/routes/` のブラウザテスト | テストに書いたケースだけ |

`addon-a11y` の `test` は 3 値で、既定の `todo` では違反が出ても合否へ入らない。Storybook の docs「Accessibility testing」は次のように書く。

| 値      | docs の説明                                                                                |
| ------- | ------------------------------------------------------------------------------------------ |
| `off`   | "Do not run accessibility tests (you can still manually verify via the addon panel)"       |
| `todo`  | "Run accessibility tests; violations return a warning in the Storybook UI"                 |
| `error` | "Run accessibility tests; violations return a failing test in the Storybook UI and CLI/CI" |

同じ docs の「Recommended workflow」は、まず全体を `error` にし、直せない部品だけを `todo` へ移し、直したら外す流れを勧める。`todo` にした story は "there will be no accessibility-related errors, warnings, or output in CI" になる (同「Automate with CI」)。

### `incomplete` は手で確かめる対象として返される

axe の結果には `violations` のほかに `incomplete` がある。Storybook も axe も、`incomplete` を手で確かめる対象として扱う。

> **Incomplete** highlights areas that you should confirm manually because they could not be checked automatically (Storybook docs「Accessibility testing」の Check for violations)

> axe-core will return elements as "incomplete" where axe-core could not be certain, and manual review is needed. (`node_modules/axe-core/README.md`)

> An incomplete result may or may not turn out to be an accessibility issue. ... consult a digital accessibility expert before deciding whether to fix or ignore them. (Deque の用語集)

中身は 3 種類が混ざる。件数ゼロを条件にすると、この 3 つを区別せずに落とすことになる。

| 入るもの                                 | 出典                                                            |
| ---------------------------------------- | --------------------------------------------------------------- |
| 技術的に判定できなかったもの             | axe `doc/API.md`「aborted and require further testing」         |
| ルールが JavaScript エラーで落ちたもの   | 同上「or because a JavaScript error occurred」                  |
| 失敗にするのが怖くて review へ回したもの | dequelabs/axe-core#3486「I'm reluctant to outright fail these」 |

### 主要な統合は、ほぼすべて violations だけで判定する

2026-09-21 に 11 種を実装で確認した。`incomplete` を既定で失敗にするのは pa11y だけで、それも同じ PR (pa11y/pa11y#685) で格下げのレバーを足している。

| 統合                              | `incomplete` を失敗にするか                          |
| --------------------------------- | ---------------------------------------------------- |
| `jest-axe` / `vitest-axe`         | しない (matcher が `violations` だけ見る)            |
| `@axe-core/playwright`            | 判定を持たない。公式例も `violations`                |
| `cypress-axe` / `@axe-core/react` | しない (`incomplete` に触れられない)                 |
| `@axe-core/cli --exit`            | しない                                               |
| Storybook `addon-a11y`            | しない (UI には出すが合否に使わない)                 |
| Lighthouse                        | scored audit からは意図的に外す                      |
| **pa11y (axe runner)**            | **する。`--level-cap-when-needs-review` で降ろせる** |

AbsaOSS/cps-shared-ui#857 は、pa11y が `incomplete` で落ちる一方 Playwright 側は無視するという 2 基準の併存を、`incomplete` を warning へ降ろして一本化することで解いた。

### `incomplete` を名指しのルールで落としたときの代償

`addon-a11y` の結果を読み直し、`color-contrast` などの `incomplete` を失敗へ格上げする層を、2026-09-21 に実装して確かめた (`@storybook/addon-a11y` 10.6.0、`axe-core` 4.13.0)。`color-contrast` は背景を決められないと `violations` ではなく `incomplete` を返すので、合否に入れなければその箇所は測られないまま緑になる。名指しのルールでこの穴を塞ぐなら、次のものが要る。

| 要るもの             | 中身                                                                                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| vitest 経由の余白    | vitest から走らせた story には `layout` の余白が当たらない。グリフが行ボックスからはみ出す部品 (registry の `leading-none` など) は、はみ出しが背景を持つ唯一の箱 (body) の外へ出て背景を決められない。落とさずに通すには、vitest 経由の story の body に余白を当てる必要がある                  |
| 書体の環境差への対処 | フォントは実行環境が持つ。折り返す位置が変わると矩形の重なり先も変わり、背景を決められるかが環境で変わる。`incomplete` を落とすと、比を測れなかっただけの箇所が CI でだけ赤になる。`violations` だけで判定すれば、片方の環境でだけ赤になるのは、その環境で比を測って閾値に届かなかったときに限る |
| story ごとの除外     | 部品の構造から背景を決められない要素を `context.exclude` で外す必要がある。Calendar の見出し (nav が重なる) と期間の両端 (擬似要素)、Combobox の空の listbox (`aria-required-children` の `reviewEmpty`)                                                                                         |
| 層そのものの保守     | annotation を `addon-a11y` より前に登録する preset、addon の結果の形への追随、外す (ルール, `messageKey`) の名指しの一覧、axe を上げるたびの `color-contrast` の分岐の読み直し                                                                                                                   |

どれも部品の欠陥を直すものではなく、`incomplete` を合否に入れたことから来る。

## Decision

**story の a11y は `error` で light と dark の両方に掛け、axe の `incomplete` は story でもブラウザテストでも合否に入れない。ブラウザテストは `incomplete` を warning の注釈で残し、story の `incomplete` は Storybook の UI の a11y パネルで手で確かめる。**

### story の a11y は `error` で検査する

`parameters.a11y.test` を `"error"` にする。story を書いた部品は自動で axe の対象になり、検査の範囲がブラウザテストより広がる。Storybook docs の「Recommended workflow」の最初の段と同じ形である。

違反が出たら抑制せず直す。部品側の欠陥なら部品を直す。story 単位の `parameters.a11y` は global の `"error"` より強いので、書けば黙る。抑制するときの書き方は `docs/guides/accessibility.md`「story で出た違反を抑制する」にある。

### テーマごとに project を持ち、Storybook 経由の実行では light だけにする

a11y を light と dark の両方へ当てるため、`tooling/test/storybook-project.ts` の `storybookProject()` を `initialGlobals` のテーマ違いで 2 つ作る。これは `@storybook/addon-vitest` の型が名指しで勧める形で、「define one Vitest project per theme, each with a different value」と書いてある。

その形のまま Storybook 経由で走らせると、project 名が衝突して起動しない (storybookjs/storybook#32427、2025-09-07 から open)。`VITEST_STORYBOOK` が真のときだけ light の 1 つに絞る。判定の正本は `mise run verify` が回す `vp test run` で、そこは両テーマのまま変わらない。test panel は書いている最中の確認に使うもので、dark を落としても正本は痩せない。衝突の仕組みと真偽の読み方は `scripts/lib/storybook-env.ts` の docstring にある。

| 経路                                       | テーマ        |
| ------------------------------------------ | ------------- |
| `vp test run` / `mise run verify` / CI     | light と dark |
| Storybook の test panel / `tools test run` | light のみ    |

### `incomplete` を合否に入れない

`incomplete` は、Storybook も axe も手で確かめる対象として返す。合否は `violations` だけで決め、`incomplete` は層ごとに読む場所を決める。

| 層                               | 合否                         | `incomplete` を読む場所                     |
| -------------------------------- | ---------------------------- | ------------------------------------------- |
| story (`src/components/**`)      | `addon-a11y` の `violations` | Storybook の UI の a11y パネルの Incomplete |
| ブラウザテスト (`src/routes/**`) | `violations`                 | 該当テストの行に付く warning の注釈         |

story の層は `addon-a11y` の判定をそのまま使い、読み直す層を足さない。足すと Context の「`incomplete` を名指しのルールで落としたときの代償」が全部戻る。

ブラウザテストで落とさないのは、そこで出るものが部品の問題ではなく、実行環境の速さで結果が変わるからでもある。確定でダイアログを閉じた直後の検査は閉じかけの popup を拾い、この窓の内側に落ちるか外側に落ちるかは実行環境の速さで決まる (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」)。黙って捨てると緑のときに何が測れていないかを読めないので、warning の注釈で残す。

### 受け入れる穴

`color-contrast` の `incomplete` は 7 通りで、どれも「比が通っていることを確認できていない」側である (`axe.js` の `color-contrast` evaluate、2026-10-10 に `axe-core@4.14.0` で確認)。

| 分岐                             | 意味                                                                      |
| -------------------------------- | ------------------------------------------------------------------------- |
| `nonBmp`                         | 文字が絵文字だけで、測らない (`ignoreUnicode` の既定)                     |
| `pseudoContent`                  | 擬似要素が文字の背後に重なり、背景を決められない                          |
| `complexTextShadows`             | 文字の影が複雑で、前景を決められない                                      |
| `fgColor` か `bgColor` が `null` | 背景か前景を解決できず測れていない                                        |
| `equalRatio`                     | 測れて比が 1:1                                                            |
| `shortTextContent` かつ閾値未満  | 測れて閾値未満。1 字なので保留                                            |
| `emptyValue` かつ閾値未満        | 値が空の入力欄で、要素の `color` が閾値未満。値を入れて測り直す前提で保留 |

story でこれらに当たる箇所は、CI では緑のまま測られていない。部品を足したり描き方を変えたりしたときは、Storybook の UI の a11y パネルで Incomplete を確かめる。

## 検討した選択肢

| 案                                                                                                 | 採否 | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **story の a11y を `error` にする**                                                                | 採用 | story を書いた部品が自動で合否に入る。Storybook docs の「Recommended workflow」の最初の段                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `addon-a11y` の既定 (`todo`) のままにする                                                          | 却下 | 違反が warning に留まり、CI には何も出ない (Storybook docs「Automate with CI」)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **テーマごとに project を 2 つ持つ**                                                               | 採用 | addon の型が勧める形で、dark の a11y も正本で検査される                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2 project を 1 つへ戻す                                                                            | 却下 | addon の型が勧める形を捨てることになり、dark の a11y 検査が正本からも消える                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| テーマごとに `configDir` を分ける                                                                  | 却下 | 上流のバグのために設定ディレクトリを 2 つ持つ。テンプレートとして読む人の負担が増える                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| config フックで project 名を戻す                                                                   | 却下 | 効かない。addon は名前の上書きを `order: "pre"` の config フックで入れ、こちらが `post` 順の config フックで上書きしても戻らなかった (2026-09-21 に `@storybook/addon-vitest` 10.6.0 で実測)。同じ手は `cacheDir` には効くので、効かないことを残す                                                                                                                                                                                                                                                                                                                                                  |
| **`incomplete` をどちらの層でも合否に入れない**                                                    | 採用 | Storybook docs は `error` を violations で落とす設定とし、`incomplete` を手で確かめる対象とする。主要な統合も violations だけで判定する                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| story で `incomplete` を名指しのルールで落とす                                                     | 却下 | Storybook docs が手で確かめる対象とするものを失敗へ格上げする。部品の欠陥と関係の無い余白、書体の環境差で CI でだけ落ちる経路、story ごとの除外、層そのものの保守が要る (Context の「`incomplete` を名指しのルールで落としたときの代償」)                                                                                                                                                                                                                                                                                                                                                           |
| story の `incomplete` を warning として出す (ブラウザテストの `annotate(..., "warning")` と同じ形) | 却下 | Storybook docs「Accessibility testing」は CI に出るものを `test` の値で説明し (`todo` は "there will be no accessibility-related errors, warnings, or output in CI")、`incomplete` を CI へ出す設定を挙げていない。出すには preview の `afterEach` で addon の `reporting` を読み直す層が要り、annotation を `addon-a11y` より前に登録する preset と、addon の結果の形への追随が戻る。story の helper はテストの文脈を持たないので `console.warn` でしか残せず、`console.warn` は PR の画面に出ない (`docs/guides/testing/annotations.md`「注釈を残す」と「`console.warn` ではなく注釈で残す理由」) |
| vitest 経由の story にだけ body の余白を当て、`incomplete` は合否に入れない                        | 却下 | 余白で背景が決まり、グリフがはみ出す部品の比も CI で測れる。代わりに、Storybook の UI と見分けるために内部の class 名 (`sb-show-main`) を使い、余白の値を写す独自の仕組みを置く。公式に vitest 経路へ `layout` を効かせる口は無い (2026-10-07 に storybookjs/storybook の issue と Discussions を検索)。測れない箇所は UI の a11y パネルが余白の上で測る (`docs/guides/accessibility.md`「story の `incomplete` を確かめる」)                                                                                                                                                                       |
| 全ルールの `incomplete` を入れる                                                                   | 却下 | 混成のバケツを区別せずに落とす。閉じかけの popup の窓で落ちる検査を全 story へ広げる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Consequences

- story を書いた部品は axe の検査対象になり、検査範囲が既存のブラウザテストより広がる。`vp test run` に storybook project が加わり、CI の実行時間が伸びる
- story の `incomplete` は CI に出ない。確かめ方は `docs/guides/accessibility.md`「story の `incomplete` を確かめる」にある
- vitest から走らせた story には canvas の余白が当たらず、余白も足さない (`docs/guides/storybook.md`「story の余白を decorator で足さない理由」)。余白の有無で合否が変わりうる。グリフが行ボックスからはみ出す部品では、余白があれば axe が背景を決められ、比が閾値に届かなければ `violations` として落ちうる。余白が無いとその箇所は `incomplete` になって合否に入らず、CI では測られないまま緑になる (「受け入れる穴」)
- ブラウザテストの `incomplete` は warning の注釈で残る。読み方は `docs/guides/accessibility.md`「ブラウザテストの `incomplete` を読む」にある

## 出典

- Storybook の a11y テスト (`test` の 3 値、Recommended workflow、Incomplete の位置づけ、CI での `todo`): https://storybook.js.org/docs/writing-tests/accessibility-testing
- Storybook: Vitest addon: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- `incomplete` は人が見る対象という位置づけ: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
- Deque の用語集 (Needs Review / Incomplete): https://docs.deque.com/devtools-for-web/4/en/glossary/
- 失敗にするのが怖いものを review へ回す設計: https://github.com/dequelabs/axe-core/issues/3486
- pa11y が incomplete の格下げレバーを足した PR: https://github.com/pa11y/pa11y/pull/685
- 2 基準の併存を incomplete の格下げで解いた例: https://github.com/AbsaOSS/cps-shared-ui/issues/857
