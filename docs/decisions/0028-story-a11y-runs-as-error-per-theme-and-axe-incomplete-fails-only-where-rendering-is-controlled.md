# ADR-0028: a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす

- Status: Accepted
- Date: 2026-09-24

## Context

この ADR は a11y の自動検査の合否を決める。何を合否に入れるかを戻すと、a11y の違反が CI を通り抜ける。

story を書いた部品は、`parameters.a11y.test` の設定しだいで axe の対象になる。同じ axe を 2 つの層が回すので、それぞれの合否に何を入れるかを決める。

| 層                       | きっかけ                       | 対象                     |
| ------------------------ | ------------------------------ | ------------------------ |
| `addon-a11y`             | 全 story × light dark          | story を書いた部品       |
| `expectNoA11yViolations` | `src/routes/` のブラウザテスト | テストに書いたケースだけ |

`addon-a11y` の既定は `test: "todo"` で、違反が出ても warning に留まり合否へ入らない (同 addon の `parameters`)。

ブラウザテストの側で `incomplete` を合否に入れると、確認ダイアログを閉じた直後の検査が Base UI の focus guard を `aria-hidden-focus` の `incomplete` として拾い、CI でだけ落ちる (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」)。

story 側で `incomplete` を合否に入れると次の 3 つのルールが出る。いずれも部品の構造から来る。

| ルール                  | 原因                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `aria-hidden-focus`     | ダイアログが開いている間の構造 (axe の `focusable-modal-open`) |
| `aria-valid-attr-value` | `aria-haspopup` と `aria-controls` を併せ持つ trigger          |
| `color-contrast`        | 要素の重なりと擬似要素で背景を決められない                     |

件数は部品と story が増えれば動く。数え直し方は `docs/guides/accessibility.md`「`incomplete` を数え直す」にある。

## incomplete は「判定できなかった」ではなく混成のバケツである

axe-core 自身が `incomplete` を人の判断へ回す設計だと書いている。

> axe-core will return elements as "incomplete" where axe-core could not be certain, and manual review is needed. (`node_modules/axe-core/README.md`)

> An incomplete result may or may not turn out to be an accessibility issue. ... consult a digital accessibility expert before deciding whether to fix or ignore them. (Deque の用語集)

中身は 3 種類が混ざる。件数ゼロを不変条件にすると、この 3 つを区別せずに落とすことになる。

| 入るもの                                 | 出典                                                            |
| ---------------------------------------- | --------------------------------------------------------------- |
| 技術的に判定できなかったもの             | axe `doc/API.md`「aborted and require further testing」         |
| ルールが JavaScript エラーで落ちたもの   | 同上「or because a JavaScript error occurred」                  |
| 失敗にするのが怖くて review へ回したもの | dequelabs/axe-core#3486「I'm reluctant to outright fail these」 |

参照先が実在しても出る既知の誤検出もある (dequelabs/axe-core#4861、2026-09-21 時点で open)。

## 主要な統合は、ほぼすべて violations だけで判定する

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

厳格に運用する前例はあるが少数で、いずれも逃がし弁とセットである。pa11y は一律の格下げ、Atlassian Design System は `color-contrast` などのルール単位の無効化 (`design-system/table` の 1 ファイルだけのローカル判断)、IBM Equal Access は baseline との突き合わせを持つ。

逆向きの前例もある。AbsaOSS/cps-shared-ui#857 は、pa11y が `incomplete` で落ちる一方 Playwright 側は無視するという本 ADR と同じ構図を、`incomplete` を warning へ降ろして一本化することで解いた。

## Decision

**story の a11y は `error` で light と dark の両方に掛け、axe の `incomplete` は描画を統制できる story でだけ落とし、ブラウザテストでは落とさない。`color-contrast` の `incomplete` は外さない。**

### story の a11y は `error` で検査する

`parameters.a11y.test` を `"error"` にする。story を書いた部品は自動で axe の対象になり、検査の範囲がブラウザテストより広がる。

違反が出たら抑制せず直す。部品側の欠陥なら部品を直す。story 単位の `parameters.a11y` は global の `"error"` より強いので、書けば黙る。抑制するときの書き方は `docs/guides/accessibility.md`「story で出た違反を抑制する」にある。

### テーマごとに project を持ち、Storybook 経由の実行では light だけにする

a11y を light と dark の両方へ当てるため、`vitest.storybook.config.ts` の `storybookProject()` を `initialGlobals` のテーマ違いで 2 つ作る。これは `@storybook/addon-vitest` の型が名指しで勧める形で、「define one Vitest project per theme, each with a different value」と書いてある。

その形のまま Storybook 経由で走らせると、project 名が衝突して起動しない (storybookjs/storybook の issue 32427、2025-09-07 から open)。`VITEST_STORYBOOK` が真のときだけ light の 1 つに絞る。判定の正本は `mise run verify` が回す `vp test run` で、そこは両テーマのまま変わらない。test panel は書いている最中の確認に使うもので、dark を落としても正本は痩せない。衝突の仕組みと真偽の読み方は `scripts/lib/storybook-env.ts` の docstring にある。

| 経路                                       | テーマ        |
| ------------------------------------------ | ------------- |
| `vp test run` / `mise run verify` / CI     | light と dark |
| Storybook の test panel / `tools test run` | light のみ    |

### `incomplete` を落とすかは、描画を統制できる層かで決める

**単一の部品を描く story では落とし、組み上げて操作するブラウザテストでは落とさない。**

| 層                               | 描画を統制できるか                         | そこで出る `incomplete` の意味   | 扱い     |
| -------------------------------- | ------------------------------------------ | -------------------------------- | -------- |
| story (`src/components/**`)      | できる。props も decorator も自分で書く    | 統制しているのに判定できない     | 落とす   |
| ブラウザテスト (`src/routes/**`) | できない。合成とタイミングと実行環境が絡む | 組み合わせの結果。避けようがない | 都度読む |

ブラウザテストで落とさないのは、**そこで出るものが部品の問題ではなく、実行環境の速さで結果が変わるからである。** 確定でダイアログを閉じた直後の検査は閉じかけの popup を拾い、この窓の内側に落ちるか外側に落ちるかは実行環境の速さで決まる。遅い CI ほど内側に落ちる (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」)。ここで `incomplete` を落とすと、直しようのないものがエラーになり、animation を無効にする回避策が要る。

story で落とすのは逆の理由による。描くものを自分で決めているのに axe が判定できないなら、それは部品側の信号である。調べる価値がある。

そのうえで、**単一部品でも統制の外へ出る状態**だけを名指しで外す。popup は開いている間だけこれに当たる。

外すものは (ルール, `messageKey`) の粒度で書く。ルールごと外すのは、そのルールの `incomplete` が `messageKey` を持たないときに限る。

| 外すもの                                        | 理由                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `aria-hidden-focus` (ルールごと)                | ダイアログが可視な間、配下の tabbable 要素がまとめて判定不能になる。story 側で描き方を変えても消せない |
| `aria-valid-attr-value` / `controlsWithinPopup` | 同じく popup の状態。`aria-haspopup` と `aria-controls` を併せ持つ trigger で必ず出る                  |

上流のバグ (mui/base-ui#5528、axe-core#4418 の設計と #4861) は補強であって、外す主たる理由ではない。上流が直っても popup が統制の外に出ることは変わらない。

`aria-valid-attr-value` をルールごと外さないのは、同じルールの `noId` (参照先が DOM に無い) が部品側の信号だからである。キーで外せばそちらは落ち続ける。

ただし完全ではない。axe はこの check の `messageKey` を単一の変数で持ち、属性を走査した最後の代入だけを 1 回報告する。1 つの要素が popup の `aria-controls` と壊れた idref を同時に持つと、報告されるキーは属性の順で決まり、`controlsWithinPopup` 側になったときは `noId` が出ない。これは axe の報告の粒度から来る穴で、除外の書き方では塞げない。

**逆向き (落とすものを名指しする) にしない。** axe のメタデータには「この incomplete は判定不能を意味する」を表すフラグが無い (`audit.data.checks[*]` のキーは `impact` と `messages` の 2 つだけ。`getRules()` にも出ない。2026-09-21 実測)。落とすものを列挙すると、新しい原因が出たときに CI は無音のまま緑を出す。

外れたものが一度も出なくなったら、その行を消す (手順は `docs/guides/accessibility.md`「`incomplete` を数え直す」)。

検査は `addon-a11y` が `reporting` へ積んだ結果を読み直す形で入れる。**axe を回し直さない。**
axe を回し直す形には 2 つの穴がある (2026-09-21 に実装して実測)。

| 穴                         | 何が起きるか                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `axe.configure` の持ち越し | addon は走査の直前に `axe.reset()` を呼ぶ。回し直す側は前の story の設定のまま走り、抑制を書いた story の次で無言に止まる |
| portal の取りこぼし        | addon は `document.body` から Storybook 自身の要素を除いて走る。`canvasElement` を渡す側は popup と dialog の中を見ない   |

読み直す側は `addon-a11y` **より前**の annotation として登録する。`afterEach` は annotation の
並びの逆順に走るので (`storybook/dist/preview/runtime.js` の `applyAfterEach`)、常に最後尾の
`.storybook/preview.tsx` からは addon の結果へ届かない。並びが変わって読めなくなったときは
「レポートが無い」で落とす。

### `color-contrast` の `incomplete` は外さない

このルールの `incomplete` は 3 通りで、どれも「比が通っていることを確認できていない」側である (`axe.js` の `color-contrast` evaluate、2026-09-21 に `axe-core@4.13.0` で確認)。

| 分岐                             | 意味                               |
| -------------------------------- | ---------------------------------- |
| `fgColor` か `bgColor` が `null` | 背景か前景を解決できず測れていない |
| `equalRatio`                     | 測れて比が 1:1                     |
| `shortTextContent` かつ閾値未満  | 測れて閾値未満。1 字なので保留     |

「測ったうえで問題なし」の分岐が無い。1 字でも比が足りていれば `passes` に入る (実測)。

`contrastRatio` や色の有無で「測ったもの」を選り分ける形は採らない。`equalRatio` と `shortTextContent` は色も比も揃っているので「測った」側に入り、自分で閾値判定をやり直さない限り素通りする。

`color-contrast` の `incomplete` をエラーにしている実装は、2026-09-21 時点の調査では 1 件も見つからなかった (Cloudscape と oaknational は逆に判定不能を捨てる側、pa11y は全ルール一律)。先行例の無い道を採る根拠は「`incomplete` を落とすかは、描画を統制できる層かで決める」の軸にある。統制できる層で統制するというだけで、このルールに固有の事情ではない。

## 検討した選択肢

| 案                                              | 採否 | 理由                                                                                                                                         |
| ----------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **story の a11y を `error` にする**             | 採用 | story を書いた部品が自動で合否に入る                                                                                                         |
| `addon-a11y` の既定 (`todo`) のままにする       | 却下 | 違反が warning に留まり、合否に入らない                                                                                                      |
| **テーマごとに project を 2 つ持つ**            | 採用 | addon の型が勧める形で、dark の a11y も正本で検査される                                                                                      |
| 2 project を 1 つへ戻す                         | 却下 | addon の型が勧める形を捨てることになり、dark の a11y 検査が正本からも消える                                                                  |
| テーマごとに `configDir` を分ける               | 却下 | 上流のバグのために設定ディレクトリを 2 つ持つ。テンプレートとして読む人の負担が増える                                                        |
| **`addon-a11y` が積んだレポートを読み直す**     | 採用 | 走査範囲と `parameters.a11y` の解釈が 1 つで済む。axe を 2 回回さない                                                                        |
| `preview.tsx` で axe を回し直す                 | 却下 | addon の走査範囲と既定を写すことになる。実装したところ上の 2 つの穴が開いた                                                                  |
| run 全体で「レポートを 1 件でも見たか」だけ見る | 却下 | addon-vitest は test panel のトグルを `globals.a11y.manual` へ run 全体で渡す。全 story が走らない形になるので、run 単位でも同じ偽陽性が出る |
| **ルールを名指して `incomplete` を入れる**      | 採用 | 緑が嘘になるルールだけを塞ぐ。落ちるのは実際に測れていない箇所に限られる                                                                     |
| 全ルールの `incomplete` を入れる                | 却下 | 混成のバケツを区別せず、animate-out の窓で落ちた事故を全 story へ広げる                                                                      |
| `incomplete` を一切見ない                       | 却下 | `color-contrast` の緑が何も意味しない状態を放置する                                                                                          |
| pa11y のように一律で格下げする                  | 却下 | 本リポジトリは合否の層を 1 つしか持たず、warning の行き先が無い                                                                              |
| `messageKey` で原因を選り分ける                 | 却下 | API.md に出ない内部キー。到達不能なキーも混じり、キーが付かない incomplete もある                                                            |
| `data` の形で選り分ける                         | 却下 | 自分で閾値判定をやり直すことになる。`color-contrast` には不要                                                                                |
| check の `after` で incomplete を昇格する       | 却下 | 実測では動くが、API.md が書く `after` の用途 (フレーム跨ぎの集約) の外                                                                       |
| CDP の `CSS.getBackgroundColors` で測る         | 保留 | gradient を解ける。コントラストを axe から切り離す案                                                                                         |
| baseline ファイルで差分だけ落とす               | 却下 | 件数を固定する台帳が増える。ルール単位の名指しで足りる                                                                                       |

## Consequences

- story を書いた部品は axe の検査対象になり、検査範囲が既存のブラウザテストより広がる。`vp test run` に storybook project が加わり、CI の実行時間が伸びる
- vitest から走らせた story には canvas の padding が当たらない。差を `.storybook/preview.css` が埋める理由は `docs/guides/storybook.md`「vitest 経由の story に padding を当てる理由」にある
- `expectNoA11yViolations` は `incomplete` を見ない。ブラウザテストの animation 無効化 (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」) は、`incomplete` を落とす基準の下で要る回避策である。`incomplete` を見ない基準の下で、その回避策が他の理由 (待機と実イベントの規律) でも要るかは別に確かめる
- story 側で `color-contrast` の `incomplete` が落ちる。部品側の信号として調べる。落ちる story とその理由は実装の PR が持ち、本 ADR には写さない
- story で統制できるのは markup までで、フォントは実行環境が持つ。CI でだけ赤になったときの扱いは `docs/guides/accessibility.md`「story が CI でだけ赤になったら」にある
- `aria-hidden-focus` と `aria-valid-attr-value` は合否に入らない。上流が直したら (axe-core#4861 / #3486) 見直す
- レポートが無いことを落とす条件は、addon が走る条件に `test: "todo"` を足したものである (todo は addon が走って warning へ降ろす形なので、合否へ入れない側で揃える)。公式は「走ったか」を知る API を持たない (`storybook.js.org/docs/writing-tests/accessibility-testing` に記載なし)。addon が条件を足すと、こちらが偽陽性を出して知らせる
- `a11y-incomplete` の annotation は `.storybook/main.ts` の `addons` で `@storybook/addon-a11y` より前に置く。並びが変わると addon の結果を読めなくなり、「レポートが無い」で落ちる
- 名指しのリストは axe の出荷物と突き合わせられない。版が上がって `color-contrast` の分岐が変わっても音が鳴らないので、更新時に読み直す (手順は `docs/guides/accessibility.md`「axe を上げたとき」)

## 出典

- `incomplete` は人が見る対象という位置づけ: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
- Deque の用語集 (Needs Review / Incomplete): https://docs.deque.com/devtools-for-web/4/en/glossary/
- 失敗にするのが怖いものを review へ回す設計: https://github.com/dequelabs/axe-core/issues/3486
- 参照先が実在しても出る誤検出 (open): https://github.com/dequelabs/axe-core/issues/4861
- `aria-haspopup` と `aria-controls` を incomplete にした変更: https://github.com/dequelabs/axe-core/pull/4418
- pa11y が incomplete の格下げレバーを足した PR: https://github.com/pa11y/pa11y/pull/685
- 2 基準の併存を incomplete の格下げで解いた例: https://github.com/AbsaOSS/cps-shared-ui/issues/857
- Storybook の a11y テスト (violations が合否): https://storybook.js.org/docs/writing-tests/accessibility-testing
- Storybook: Vitest addon: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
