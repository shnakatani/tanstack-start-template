# ADR-0026: axe の緑を測った証明とせず、測った件数を別に要求する

- Status: Accepted
- Date: 2026-09-21
- 関連: ADR-0056 (`incomplete` を落とす層) / ADR-0024 (1.4.11 を axe が持たない) / ADR-0025 (`::placeholder` を axe が誤って評価する)

## Context

axe の結果が緑であることを、どこまで「測った」「WCAG を満たした」の根拠にできるかを決める。

## Decision

### 緑は「測った」を意味しない

`incomplete` を塞いでも、`passes` に入ったことは「測った」の証明にならない。`color-contrast` は画面に出ていない要素を `return true` で合格にする (`axe.js` の `_isVisibleOnScreen` 分岐、`messageKey: 'hidden'`)。検査が空振りしても緑になる形は残る。

この形は axe に固有ではない。前件が成立しないまま成立する assertion は vacuous pass と呼ばれ、定石は「失敗を厳しくする」ではなく「実際に測った件数が 0 でないことを別に要求する」である。`expectNoA11yViolations` の `passes.length > 0` はその粗い版で、ルール単位では見ていない。

緑を静かに壊す設定が 2 つある。どちらも既定では無効で、触るときはこの ADR を読む。

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

## Consequences

- axe の版が上がるとルールの担当範囲が変わる。「105 ルール / 28 SC」は 2026-09-21 の `axe-core@4.13.0` の値で、更新時に測り直す

## 出典

- `::placeholder` を誤った前景色で評価する (open): https://github.com/dequelabs/axe-core/issues/4260
