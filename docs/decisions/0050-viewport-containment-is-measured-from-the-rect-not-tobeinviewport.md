# ADR-0050: viewport 内に収まることは `toBeInViewport` ではなく矩形の poll で見る

- Status: Accepted
- Date: 2026-09-22
- 関連: ADR-0026 (Dialog / AlertDialog の viewport 溢れ backstop はブラウザテストが守る)、ADR-0044 (待機は retry API に委ねる)、ADR-0047 (matcher の無い実測は `expect.poll` の中で読む)、ADR-0049 (肯定形で書く)

## Context

`src/components/ui/dialog.test.tsx` と `src/components/ui/alert-dialog.test.tsx` の 3 箇所が「長身コンテンツでも popup 全体が viewport 内に収まる」を固定する (ADR-0026 の backstop)。

公式の `toBeInViewport({ ratio })` は IntersectionObserver で測り、`ratio` を「the minimal ratio of the element should be in viewport」と定める (vitest browser の assertions docs)。「全体が収まる」は `ratio: 1` にあたる。

同梱の `@vitest/browser` 4.1.11 (`dist/expect-element.js`) は `pass = ratio > 0 && ratio > options.ratio - 1e-9` で判定し、`ratio: 1` は intersectionRatio が 1 − 1e-9 を超えることを要求する。

3 箇所を `toBeInViewport({ ratio: 1 })` に置き換え、同じ 2 ファイルを 3 回走らせた (2026-09-22):

| run | 結果                | 落ちたテスト                                                                                       | 失敗文                                                  |
| --- | ------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 1 failed / 5 passed | alert-dialog「Popup は Viewport の中で flex-col に組まれ、長身コンテンツでも viewport 内に収まる」 | `is not in viewport with ratio 1 (actual ratio: 1.000)` |
| 2   | 6 passed            | –                                                                                                  | –                                                       |
| 3   | 1 failed / 5 passed | dialog「基準 viewport で長身コンテンツでも popup 全体が viewport 内に収まる」                      | 同上                                                    |

収まっている popup でも intersectionRatio が 1 に届かない実行があり、失敗文は小数 3 桁で 1.000 と出る。どの実行で落ちるかは決まらない。閾値を 0.999 に下げると通るが「全体が」の主張を失う (高さ 800px の popup なら 0.8px までのはみ出しを見逃す)。

もう 1 つ、IntersectionObserver は面積 0 の target に「交差していれば 1」を返す (仕様「Run the Update Intersection Observations Steps」の step 12: "If targetArea is non-zero, let intersectionRatio be intersectionArea divided by targetArea. Otherwise, let intersectionRatio be 1 if isIntersecting is true")。高さ 0 に潰れた popup は `ratio: 1` を自明に満たす。

### 上流の既知問題

落ちる原因は IntersectionObserver の仕様側にある。w3c/IntersectionObserver#477「Sub-pixel layout can cause intersectionRatio to be <1, even though target is entirely visible」(2021-07-22 起票、2026-09-22 時点で OPEN。初出は Chromium bug 1020466) が、sub-pixel layout の要素では全体が見えていても比が 1 に届かないと記録している。上の実測の `actual ratio: 1.000` はこの形で、コミュニティの回避策は閾値 0.99 である。

vitest の `toBeInViewport` は Playwright の port で (vitest-dev/vitest#7650 を閉じた PR #8234 の本文「this is port to vitest」)、判定式の `- 1e-9` も Playwright の `packages/injected/src/injectedScript.ts` (`ratio > (options.expectedNumber ?? 0) - 1e-9`) と同じである。sub-pixel の誤差は 1e-9 より大きいので、この許容では吸収できない。`ratio: 1` が sub-pixel で落ちる報告は、vitest (`gh search issues --repo vitest-dev/vitest toBeInViewport`: 2 件、いずれも別件) にも Playwright (`gh search issues --repo microsoft/playwright "toBeInViewport ratio"` / `"toBeInViewport flaky"`: 該当なし) にも無い (2026-09-22 検索)。

## Decision

**popup が viewport に収まることは、矩形の 4 辺と寸法を `expect.poll` の中で読んで判定する。`toBeInViewport({ ratio: 1 })` は使わない。**

| 規範                                                                                                                         | 守らないと何が壊れるか                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 全体が収まることは `src/test/viewport.ts` の `expectWithinViewport(locator)` で見る                                          | `toBeInViewport({ ratio: 1 })` は収まっていても落ちる実行がある                                  |
| 判定は `src/test/viewport-overflows.ts` の純粋関数が持ち、はみ出した辺と px を文字列で返す。helper は `toEqual([])` で比べる | 真偽値にすると失敗文から原因が読めない。文字列なら `bottom +40px` が残る                         |
| 高さ・幅が 0 の要素は「収まっている」と見なさない                                                                            | 潰れた要素ははみ出しを自明に満たす。`toBeInViewport` も面積 0 の要素に ratio 1 を返す            |
| 一部が見えていること (`ratio` 0) は公式の `toBeInViewport()` のまま使う                                                      | 本 ADR が退けるのは `ratio: 1` の判定だけ。End キーで最下部へ到達する検証は公式 matcher で足りる |

## Consequences

- 要素が無いときは `element()` が throw し、`expect.poll` が予算ぶん retry してから落ちる (vitest の expect.poll docs「If an error is thrown inside the `expect.poll` callback, Vitest will retry again until the timeout runs out」)。空配列を期待する形でも、要素の不在で通ることはない
- helper の自己テスト `src/test/viewport.test.tsx` は locator から矩形を読む配線だけを 3 件で見る (通過 / 辺が失敗文に出る / 要素が無い)。落ちる 2 件は `vi.setConfig({ expect: { poll: { timeout: 0 } } })` で予算 (ADR-0048) を待たない。docs の `vi.setConfig` の例に `expect` は無いが、受け取る `RuntimeConfig` 型 (vitest 4.1.11 `config.d.ts`) が `expect` を持つ。辺ごとの判定は unit の `src/test/viewport-overflows.test.ts` が持つ
- 呼び出し側は先に mount を待たなくてよい。helper 自身が poll し、要素が無ければ `element()` の throw (`Cannot find element with locator: …`) がそのまま失敗文になる (自己テスト「要素が無ければ locator 名で落ちる」)

### 再評価の条件

- w3c/IntersectionObserver#477 が閉じて比が pixel-snapped で計算されるようになるか、Playwright / vitest が sub-pixel を吸収する許容を持ったら、上の表の手順 (3 箇所を `{ ratio: 1 }` にして 3 回走らせる) で測り直す。3 回とも通れば helper を消して公式 matcher へ戻す

## 検討した選択肢

| 案                                                                       | 評価                                                                                                 | 採否     |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| 矩形の 4 辺と寸法を `expect.poll` の中で読む                             | 「全体が」をそのまま表せ、失敗文に辺と px が残る。読みは helper 1 箇所に閉じる                       | **採用** |
| `toBeInViewport({ ratio: 1 })`                                           | 収まっていても落ちる実行がある (3 回中 2 回)。面積 0 の要素を通す                                    | 却下     |
| `toBeInViewport({ ratio: 0.999 })` (w3c#477 のコミュニティ回避策は 0.99) | 通るが「全体が」の主張を失う。閾値の根拠を popup の高さごとに持つことになる                          | 却下     |
| `max-height` を `toHaveStyle` で見る                                     | Tailwind の class を写す同語反復。収まるかは内容の高さと viewport で決まり、宣言値だけでは分からない | 却下     |

## 出典

- vitest browser の assertions (`toBeInViewport`): <https://vitest.dev/api/browser/assertions#tobeinviewport>
- vitest の `expect.poll`: <https://vitest.dev/api/expect#expect-poll>
- 同梱の `@vitest/browser` 4.1.11 `dist/expect-element.js` (`toBeInViewport` の判定式)
- IntersectionObserver 仕様「Run the Update Intersection Observations Steps」: <https://w3c.github.io/IntersectionObserver/#update-intersection-observations-algo>
- w3c/IntersectionObserver#477 (OPEN。sub-pixel layout で比が 1 に届かない): <https://github.com/w3c/IntersectionObserver/issues/477>
- vitest-dev/vitest#7650 と PR #8234 (`toBeInViewport` は Playwright の port): <https://github.com/vitest-dev/vitest/pull/8234>
- Playwright の判定式: <https://github.com/microsoft/playwright/blob/main/packages/injected/src/injectedScript.ts> (`to.be.in.viewport`)
