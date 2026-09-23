# ADR-0053: ADR にするのは構造・主要な品質特性・戻しにくさに効く選択に限り、部品をまたぐ作法はガイド、部品に閉じた注意は docstring に置く

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0000 (1 本 1 決定と改訂の扱い) / ADR-0005 (設計ガイドの置き場所) / ADR-0004 (コメントが指す先) / ADR-0001 (文書の層)

## Context

ADR の単位と改訂の扱いは ADR-0000 が決めるが、何を ADR にするかは持たない。範囲を決めずに書くと、部品をまたいで守る作法の説明と、その作法で組む手順・落とし穴への対処が ADR に積み重なり、決定だけを読めなくなる (ADR-0005)。

| 出典                       | ADR にする範囲                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Microsoft Well-Architected | "Only include choices that affect the system's structure, key quality attributes, or are difficult to reverse." |
| arc42 §9                   | "Important, expensive, large scale or risky architecture decisions including rationales."                       |

## Decision

**ADR にするのは、構造・主要な品質特性・戻しにくさのいずれかに効く選択に限る。当たらないものは、効く範囲で置き場所を決める。**

| 中身                                                                 | 置き場所                               |
| -------------------------------------------------------------------- | -------------------------------------- |
| 構造・主要な品質特性・戻しにくさに効く選択と、比較した案、却下の理由 | ADR                                    |
| 部品をまたいで守る作法の説明と、その作法で組む手順・落とし穴への対処 | `docs/guides/` の設計ガイド (ADR-0005) |
| 1 つの関数や部品に閉じた注意                                         | そのファイルの docstring (ADR-0004)    |

- ADR の中に手順や規範の表が育ったら、ガイドへ出す。ADR には決定と、それを支える比較と観測を残す
- ADR はガイドを補足として指してよい。ただし決定はガイドを読まなくても成り立つように書く (Microsoft の "the decision must be clear and stand alone without that material")

### 検討した選択肢

| 案                                               | 評価                                                                                                                          | 採否     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 構造・主要な品質特性・戻しにくさに効く選択に限る | Microsoft と arc42 §9 が示す範囲と一致する。作法の説明と手順はガイドへ、部品の注意は docstring へ分かれ、ADR は決定だけを持つ | **採用** |
| 迷ったら全部 ADR にする                          | 取りこぼしは無いが、作法の説明・手順・部品の注意が ADR に混ざり、決定を読むには全文を読むことになる                           | 却下     |
| 規模 (変更の行数やファイル数) で決める           | 規模は効き方と対応しない。設定の 1 行でも戻しにくい選択 (依存の待機日数など) は漏れ、手順だけの大きな変更が ADR になる        | 却下     |

## Consequences

- 当たるかどうかの線引きは機械で判定できない。レビューで見る
- 既存の ADR に手順や規範の表が残っていたら、ガイドへ出す。出した先は ADR から補足として指してよい

## 出典

- Microsoft Azure Well-Architected Framework「Maintain an architecture decision record (ADR)」: https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record
- arc42 §9 Architecture Decisions: https://docs.arc42.org/section-9/
