# ADR-0038: axe の緑を測った証明とせず、測った件数を別に要求する

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0037 (`incomplete` を落とす層) / ADR-0032 (1.4.11 を axe が持たない) / ADR-0033 (`::placeholder` を axe が誤って評価する)

## Context

axe の結果が緑であることを、どこまで「測った」「WCAG を満たした」の根拠にできるかを決める。

## Decision

### 緑は「測った」を意味しない

`incomplete` を塞いでも、`passes` に入ったことは「測った」の証明にならない。`color-contrast` は画面に出ていない要素を `return true` で合格にする (`axe.js` の `_isVisibleOnScreen` 分岐、`messageKey: 'hidden'`)。検査が空振りしても緑になる形は残る。

この形は axe に固有ではない。前件が成立しないまま成立する assertion は vacuous pass と呼ばれ、定石は「失敗を厳しくする」ではなく「実際に測った件数が 0 でないことを別に要求する」である。`expectNoA11yViolations` の `passes.length > 0` はその粗い版で、ルール単位では見ていない。

緑を静かに壊す設定と、axe が担当しない範囲 (1.4.11 など) は `docs/guides/accessibility.md`「axe の緑が意味しないこと」にある。

### 検討した選択肢

| 案                                                       | 評価                                                                                                                                                                                                | 採否     |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `violations` が 0 件なら合格とする (`addon-a11y` の既定) | ルールが 1 つも走らなかった場合 (対象が空、設定で全ルールが外れた) も緑になる                                                                                                                       | 却下     |
| 測った件数 (`passes`) が 0 でないことを別に要求する      | ルールが 1 つも走らなかった場合を落とせる。ルール単位では見ない粗い形で、`expectNoA11yViolations` に 1 行で入る。画面に出ていない要素の合格 (`color-contrast` の `hidden`) は、この形でも捕まえない | **採用** |

## Consequences

- `passes` の件数を要求するのはブラウザテストの `expectNoA11yViolations` (`src/test/a11y.ts`) だけで、story の層 (`src/test/a11y-story.ts`) は `passes` を見ない。story の層で空振りの緑を落とすものは無い
- axe の版が上がるとルールの担当範囲が変わる。数え直しは `docs/guides/accessibility.md`「axe を上げたとき」にある

## 出典

- `::placeholder` を誤った前景色で評価する (open): https://github.com/dequelabs/axe-core/issues/4260
