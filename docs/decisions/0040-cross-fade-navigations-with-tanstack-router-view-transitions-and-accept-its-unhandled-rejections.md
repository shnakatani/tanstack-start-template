# ADR-0040: ナビゲーションは TanStack Router の View Transitions でクロスフェードにし、拾われない reject を受け入れる

- Status: Accepted
- Date: 2026-10-09
- 関連: ADR-0015 (Transition と `<ViewTransition>`)、ADR-0035 (遷移の後の focus と title)

## Context

TanStack Router は `defaultViewTransition` で、ナビゲーションを `document.startViewTransition()` に通す (TanStack Router docs の `RouterOptionsType`「defaultViewTransition property」)。ブラウザの API を直接呼ぶので、React の `<ViewTransition>` とは別物である (ADR-0015)。2026-10-09 に `gh search prs "ViewTransition" --repo TanStack/router` で、React の `<ViewTransition>` に対応する PR が無いことを確かめた。

- 既定のアニメーションは新旧の画面のクロスフェードで、opacity の変化である。WCAG 2.3.3 の motion animation は "does not include changes of color, blurring, or opacity which do not change the perceived size, shape, or position" とする (Understanding 2.3.3。同じページの errata で、ぼかしは除外から外れた)
- View Transitions の擬似要素は accessibility tree に出ない (CSS View Transitions Level 1)。focus と読み上げは変わらない
- router は `ViewTransition` の `updateCallbackDone` だけを待ち、`ready` の reject を拾わない (router-core 1.171.34 の `src/router.ts` の `startViewTransition`)。`ready` は、新しい遷移に置き換わったとき、タブが隠れていたとき、更新が時間切れになったときに reject する (CSS View Transitions Level 1)。直す TanStack/router#7907 は 2026-10-09 時点で未 merge で、レビューも付いていない

## Decision

**ナビゲーションは `defaultViewTransition: true` でクロスフェードにし、拾われない `ready` の reject は受け入れる。**

`src/router.tsx` に置く。効くのは、リンクと `navigate` (search だけを変える `replace` を含む)、redirect、戻る・進むである。`router.invalidate()` (Error Boundary の再試行)、preload、SSR、hydration の直後には効かない (router-core 1.171.34 の `src/load-client.ts` と `src/router.ts`。`router.invalidate()` は TanStack/router#4345 で外れた)。

| 案                                    | 評価                                                                                                                                                      | 採否     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `defaultViewTransition: true`         | 設定 1 行で全部のナビゲーションに効く。拾われない reject が console に出る                                                                                | **採用** |
| 入れない                              | reject は出ない。直す PR が動いておらず、見直す時機が来ない                                                                                               | 却下     |
| Link ごとに `viewTransition` を付ける | 付け忘れたナビゲーションだけ切り替わり方が違う。reject の扱いは同じ                                                                                       | 却下     |
| `ready` の reject を自前で拾う        | TanStack/router#7907 と同じ修正を router の外で持つことになる。router は `ViewTransition` を返さないので、`document.startViewTransition` を包む必要がある | 却下     |

## Consequences

- 前の遷移の `ready` が resolve する前に次の遷移が始まると、`AbortError: Transition was skipped. New ViewTransition started` が unhandled rejection になる。遷移は完了し、`src/` には `unhandledrejection` を受ける処理が無いので、本番では console とエラー監視に出るだけである。実測は下の「調査結果」にある
- Vitest のブラウザテストは unhandled rejection で run を失敗させる。`defaultViewTransition: true` の router でナビゲーションを間を空けずに続けるテストは、テストが通っても `vp test run` が失敗する
- タブが隠れた状態のナビゲーションでも、`ready` が `InvalidStateError` で reject する (TanStack/router#7906 の再現。手元では未実測)
- Safari でスワイプして戻る・進むと、ブラウザの遷移のアニメーションと二重に動く (TanStack/router#6754。手元では未実測)。issue に、Navigation API の `hasUAVisualTransition` を見て `types` の関数から `false` を返す回避の形がある
- 移動・拡大縮小・ぼかしを足すときは、reduced motion の扱いと合わせて決める
- 遷移の後の focus と title は、`src/components/route-announcer.test.tsx` が同じ設定の router で確かめる (ADR-0035)

## 調査結果

2026-10-09 に dev server と Playwright 1.63.0 の Chromium で、トップから `/notes` へのリンクと戻るを繰り返し、unhandled rejection を数えた。

| 操作                                                           | unhandled rejection |
| -------------------------------------------------------------- | ------------------- |
| 遷移を待ってから戻る (30 往復)                                 | 0                   |
| リンクを押した直後に戻る (10 回)                               | 9                   |
| 押してから 100 / 200 / 300 / 400 / 600ms 空けて戻る (各 10 回) | 0                   |
| リンクのダブルクリック (10 回)                                 | 0                   |

## 出典

- `defaultViewTransition` (TanStack Router docs の `RouterOptionsType`): https://tanstack.com/router/latest/docs/api/router/RouterOptionsType#defaultviewtransition-property
- WCAG 2.3.3 の motion animation の定義と errata (Understanding 2.3.3): https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- `ready` が reject する条件と accessibility tree (CSS View Transitions Level 1): https://www.w3.org/TR/css-view-transitions-1/
- router が `ready` の reject を拾わない件と、直す PR: https://github.com/TanStack/router/issues/7906、https://github.com/TanStack/router/pull/7907
- Safari のスワイプで二重に動く件: https://github.com/TanStack/router/issues/6754
- `router.invalidate()` で View Transitions を始めないようにした PR: https://github.com/TanStack/router/pull/4345
