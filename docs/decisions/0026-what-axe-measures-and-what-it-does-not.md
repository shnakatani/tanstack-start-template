# ADR-0026: axe の incomplete は既定で落とし、構造的に出るものだけ名指しで外す

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0004 (静的 lint の構成) / ADR-0017 (a11y 検査の対象) / ADR-0018 (incomplete に噛まれた事故と回避策) / ADR-0022 (story を検査の単位にする) / ADR-0024 (1.4.11 を axe が持たない) / ADR-0025 (`::placeholder` を axe が誤って評価する)

## Context

同じ axe を 2 つの層が回しており、**合否の基準が食い違っている**。理由はどこにも書かれていない。

| 層                             | きっかけ                  | 合否の基準                                 | 対象                     |
| ------------------------------ | ------------------------- | ------------------------------------------ | ------------------------ |
| `addon-a11y` (`test: "error"`) | 全 story × light dark     | `violations` のみ                          | story を書いた部品       |
| `expectNoA11yViolations`       | ブラウザテスト 3 ファイル | `violations` + `incomplete` + `passes > 0` | テストに書いたケースだけ |

後者は 2026-09-21 時点で緑だが、それは 3 ファイルがたまたま `incomplete` を出さないためである。**この基準には既に噛まれている。** ADR-0018 は、確認ダイアログを閉じた直後の検査が Base UI の focus guard を `aria-hidden-focus` の `incomplete` として拾い、CI でだけ落ちた事故の記録である。そのとき基準を見直さず、animation を無効にする回避策を足して緑へ戻した。

story 側へ同じ基準を当てると落ちる。出るルールは 3 つで、いずれも部品の構造から来る。

| ルール                  | 原因                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `aria-hidden-focus`     | ダイアログが開いている間の構造 (axe の `focusable-modal-open`) |
| `aria-valid-attr-value` | `aria-haspopup` と `aria-controls` を併せ持つ trigger          |
| `color-contrast`        | 要素の重なりと擬似要素で背景を決められない                     |

件数は部品と story が増えれば動く。数え直すときは `.storybook/preview.tsx` の `afterEach` で `axe.run(canvasElement)` を回し、`incomplete` のルール ID を集計する。

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

### 1. `incomplete` は既定で落とし、外すものを名指しする

`violations` に加えて `incomplete` も落とす。そのうえで、部品の構造から恒常的に出るものだけを名指しで外す。

**逆向き (落とすものを名指しする) にしない。** axe のメタデータには「この incomplete は判定不能を意味する」を表すフラグが無い (`audit.data.checks[*]` のキーは `impact` と `messages` の 2 つだけ。`getRules()` にも出ない。2026-09-21 実測)。落とすものを列挙する形にすると、axe が同じ性質のルールを増やしたときも、UI 基盤を差し替えて新しい構造的な `incomplete` が出たときも、**CI は無音のまま緑を出す**。外すものを列挙する形なら、同じ事象が余計な赤として出て人が判断する。判別材料が無い以上、この無音はツール側の改善では埋まらない。

外すものは (ルール, `messageKey`) の粒度で書く。ルールごと外すのは、そのルールの `incomplete` が `messageKey` を持たないときに限る。

| 外すもの                                        | 理由                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `aria-hidden-focus` (ルールごと)                | ダイアログが開いている間の構造。`messageKey` を持たないので粒度を下げられない                                       |
| `aria-valid-attr-value` / `controlsWithinPopup` | `aria-haspopup` と `aria-controls` を併せ持つ trigger。axe-core#4418 の設計で、参照先が実在しても出る (#4861、open) |

`aria-valid-attr-value` をルールごと外さないのは、同じルールの `noId` (参照先が DOM に無い) が実バグだからである。キーで外せば実バグは落ち続ける。

外れたものが一度も出なくなったら、その行を消す。当たらない除外を残すと、なぜ外したかを誰も再現できなくなる。

### 2. `color-contrast` の `incomplete` は外さない

このルールの `incomplete` は 3 通りで、どれも「比が通っていることを確認できていない」側である (`axe.js` の `color-contrast` evaluate、2026-09-21 に `axe-core@4.13.0` で確認)。

| 分岐                             | 意味                               |
| -------------------------------- | ---------------------------------- |
| `fgColor` か `bgColor` が `null` | 背景か前景を解決できず測れていない |
| `equalRatio`                     | 測れて比が 1:1                     |
| `shortTextContent` かつ閾値未満  | 測れて閾値未満。1 字なので保留     |

「測ったうえで問題なし」の分岐が無い。1 字でも比が足りていれば `passes` に入る (実測)。

`contrastRatio` や色の有無で「測ったもの」を選り分ける形は採らない。`equalRatio` と `shortTextContent` は色も比も揃っているので「測った」側に入り、自分で閾値判定をやり直さない限り素通りする。本リポジトリはトークンの値をこの検査に預けているので (ADR-0024)、緩める方向の細分は採らない。

### 3. 層ごとの役割を分ける

同じ axe を回す層が複数あるのは重複ではない。見る対象と、落ちたときに直す場所が違う。

| 層                      | 見るもの                                                                                     | 落ちたら直す場所 |
| ----------------------- | -------------------------------------------------------------------------------------------- | ---------------- |
| `jsx-a11y` (静的 lint)  | JSX の字面。custom 部品の中身は見ない                                                        | その JSX         |
| devtools の a11y パネル | 触った画面。自動実行しない                                                                   | 気付いた人が起票 |
| story の axe            | 部品が取りうる状態。操作の後も `play` で見る                                                 | 部品か story     |
| ブラウザテストの axe    | story を置けないページと文書全体 (`src/routes/`)。ランドマーク構造など部品へ分解できないもの | そのケースの実装 |

境界は「操作の前か後か」ではない。story も `play` で操作の後の状態を見る (ADR-0022 の節 2)。分かれるのは**置ける場所**である。`.storybook/main.ts` の `stories` は `src/components/**` しか見ないので、ページと文書全体は story にできない。`root-document.test.ts` が見ているランドマーク構造は部品へ分解できず、ブラウザテストでしか押さえられない。両方要る。

### 4. 抑制は story の `parameters.a11y` に置き、理由と出口を添える

グローバルに無効化しない。抑制は出た場所へ置き、次の 3 つを書く。

- なぜそのルールがそこで出るのか
- 本体をどう扱うか (上流の issue 番号、または起票先)
- 抑制を外せる条件

実例は `combobox.stories.tsx` の `aria-hidden-focus` (mui/base-ui#5528 が open) と `table-skeleton.stories.tsx` の `empty-table-header`。

### 5. 緑は「測った」を意味しない

`incomplete` を塞いでも、`passes` に入ったことは「測った」の証明にならない。`color-contrast` は画面に出ていない要素を `return true` で合格にする (`axe.js` の `_isVisibleOnScreen` 分岐、`messageKey: 'hidden'`)。検査が空振りしても緑になる形は残る。

この形は axe に固有ではない。前件が成立しないまま成立する assertion は vacuous pass と呼ばれ、定石は「失敗を厳しくする」ではなく「実際に測った件数が 0 でないことを別に要求する」である。`expectNoA11yViolations` の `passes.length > 0` はその粗い版で、ルール単位では見ていない。

緑を静かに壊す設定が 2 つある。どちらも既定では無効で、触るときは本節を読む。

| 設定                                                 | 何が起きるか                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `resultTypes`                                        | 含まれない group の `nodes` を先頭 1 件へ切り詰める。`incomplete` の件数が黙って過少になる |
| `contrastRatio.normal.minThreshold` / `maxThreshold` | 比が範囲外のとき `return true` で**合格**になる (`axe.js` の evaluate 冒頭)                |

## axe が測らない範囲

axe を通したことは「WCAG を満たした」を意味しない。2026-09-21 に `axe-core@4.13.0` で測った担当範囲は 105 ルール / WCAG の 28 SC で、README は「平均 57% を自動検出」と書いている。

色に関わる範囲は特に狭い。

| SC                      | axe のルール              | 代わりに押さえるもの                   |
| ----------------------- | ------------------------- | -------------------------------------- |
| 1.4.3 (文字 4.5:1)      | `color-contrast` 1 つ     | —                                      |
| 1.4.11 (非テキスト 3:1) | **0 ルール**              | トークンの値を人が測る (ADR-0024)      |
| 1.4.1 (色の使用)        | `link-in-text-block` だけ | 本文中のリンク以外は見ない             |
| `::placeholder`         | 誤った前景色で評価する    | 人が見比べる (ADR-0025、axe-core#4260) |

## 検討した選択肢

| 案                                         | 採否 | 理由                                                                              |
| ------------------------------------------ | ---- | --------------------------------------------------------------------------------- |
| **ルールを名指して `incomplete` を入れる** | 採用 | 緑が嘘になるルールだけを塞ぐ。落ちるのは実際に測れていない箇所に限られる          |
| 全ルールの `incomplete` を入れる           | 却下 | 混成のバケツを区別せず、ADR-0018 の事故を全 story へ広げる                        |
| `incomplete` を一切見ない                  | 却下 | `color-contrast` の緑が何も意味しない状態を放置する                               |
| pa11y のように一律で格下げする             | 却下 | 本リポジトリは合否の層を 1 つしか持たず、warning の行き先が無い                   |
| `messageKey` で原因を選り分ける            | 却下 | API.md に出ない内部キー。到達不能なキーも混じり、キーが付かない incomplete もある |
| `data` の形で選り分ける                    | 却下 | 自分で閾値判定をやり直すことになる。`color-contrast` には不要                     |
| check の `after` で incomplete を昇格する  | 却下 | 実測では動くが、API.md が書く `after` の用途 (フレーム跨ぎの集約) の外            |
| CDP の `CSS.getBackgroundColors` で測る    | 保留 | gradient を解ける。コントラストを axe から切り離す案                              |
| baseline ファイルで差分だけ落とす          | 却下 | 件数を固定する台帳が増える。ルール単位の名指しで足りる                            |

## Consequences

- `expectNoA11yViolations` の `incomplete` の扱いを節 2 へ揃える。現状は全ルールを要求しており、ダイアログを開くテストを足すと `aria-hidden-focus` で落ちる。ADR-0018 の回避策はその予防で入っている
- story 側に `color-contrast` の `incomplete` を入れると、既存の story が落ちる。入れる前に仕分けが要る。落ちる story とその理由は実装の PR が持ち、本 ADR には写さない
- `aria-hidden-focus` と `aria-valid-attr-value` は合否に入らない。上流が直したら (axe-core#4861 / #3486) 見直す
- 名指しのリストは axe の出荷物と突き合わせられない。版が上がって `color-contrast` の分岐が変わっても音が鳴らないので、更新時に節 2 の 3 分岐を読み直す
- axe の版が上がるとルールの担当範囲が変わる。「105 ルール / 28 SC」は 2026-09-21 の `axe-core@4.13.0` の値で、更新時に測り直す

## 出典

- `incomplete` は人が見る対象という位置づけ: https://github.com/dequelabs/axe-core/blob/develop/doc/API.md
- Deque の用語集 (Needs Review / Incomplete): https://docs.deque.com/devtools-for-web/4/en/glossary/
- 失敗にするのが怖いものを review へ回す設計: https://github.com/dequelabs/axe-core/issues/3486
- 参照先が実在しても出る誤検出 (open): https://github.com/dequelabs/axe-core/issues/4861
- `aria-haspopup` と `aria-controls` を incomplete にした変更: https://github.com/dequelabs/axe-core/pull/4418
- `::placeholder` を誤った前景色で評価する (open): https://github.com/dequelabs/axe-core/issues/4260
- pa11y が incomplete の格下げレバーを足した PR: https://github.com/pa11y/pa11y/pull/685
- 2 基準の併存を incomplete の格下げで解いた例: https://github.com/AbsaOSS/cps-shared-ui/issues/857
- Storybook の a11y テスト (violations が合否): https://storybook.js.org/docs/writing-tests/accessibility-testing
