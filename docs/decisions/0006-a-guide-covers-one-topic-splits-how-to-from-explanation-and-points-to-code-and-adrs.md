# ADR-0006: 設計ガイドは 1 本に 1 主題を持ち、手順と説明を節で分け、コードと決定は参照で指す

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0005 (設計ガイドの置き場所) / ADR-0001 (文書の層と数値の扱い)

## Context

`docs/guides/` のガイドは、部品をまたぐ作法の説明と、その作法で組む手順を持つ (ADR-0005)。
書き方を決めずにガイドを書くと、次のことが揃わない。

| 揃わないもの         | 壊れ方                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| 1 本に入れる主題     | 手順を探す人が、どのファイルを開けばよいか決められない                                         |
| 手順と説明の混ざり方 | 手順だけを追いたい人が理由の段落を読み飛ばせない。理由を知りたい人は手順の中から拾うことになる |
| コードの載せ方       | 抜き書きしたコードが実装と食い違っても、ガイド側では気付けない                                 |
| ADR との関係         | 決定をガイドで言い換えると、ADR を改訂したときにガイドだけが古い決定を言い続ける               |
| 改訂の扱い           | 書き換えず、変えたら新しい版を足していくと決めると、古い手順が現在の手順と並ぶ                 |

参考にした枠組みと先行例は次のとおり。

| 出典          | 中身                                                                                                                                                                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diátaxis      | 文書を 4 種に分ける。how-to guide は "directions that guide the reader through a problem or towards a result. How-to guides are goal-oriented."、explanation は "a discursive treatment of a subject, that permits reflection. Explanation is understanding-oriented." |
| arc42 Tip 8-4 | "Explain, how these concepts are applied in reality, how they are implemented in source code. You can refer to existing code, or include code examples in the documentation."                                                                                          |
| arc42 Tip 8-8 | コード片をコピーして文書に貼らない。自動で取り込めないなら、場所でコードを指す                                                                                                                                                                                         |
| Catio         | "Design documents are kept up to date as the system evolves; ADRs are immutable once accepted and are superseded by new ADRs rather than edited." 引くのは設計文書の側だけで、このリポジトリの ADR の扱いは ADR-0000 が決める (枠内なら書き換える)                     |

Tip 8-4 はコードを文書に載せることも認めるが、このリポジトリでは貼らずに場所で指す。貼る形を採らない根拠は Tip 8-8 (コード片をコピーして貼らない) である。

## Decision

**ガイドは 1 本に 1 主題を持ち、主題の中を how-to (手順と落とし穴への対処) の節と explanation (なぜその形か) の節に分ける。コードはパスで、決定は ADR 番号で指し、どちらも写さない。経緯は書かず、コードと決定に合わせて書き換える。**

| 対象   | 書き方                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 主題   | 1 本に 1 主題。ファイル名は主題の英語名を小文字と dash にしたもの (`lists-and-search.md`)。一覧は `docs/guides/README.md` |
| 節     | 見出しの下で how-to と explanation を分け、1 つの節に手順と理由を混ぜない                                                 |
| コード | ファイルパスで指す。コードを貼らず、行番号を書かない。行番号は編集でずれ、ずれても気付けない                              |
| ADR    | 決定を言い換えず `ADR-NNNN` で指す。ガイドが持つのは、決定に沿って組む手順と、決定の前提になる仕組みの説明                |
| 経緯   | 書かない。以前の手順と変えた理由は git 履歴が持つ                                                                         |
| 数値   | ADR-0001 の数値の扱いに従う。上流の挙動の観測には日付と版を添える                                                         |

### 検討した選択肢

| 案                                                           | 評価                                                                                                         | 採否     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------- |
| 1 本 1 主題、中を how-to と explanation の節に分ける         | 同じ主題の手順と理由が 1 ファイルに並び、節で読み分けられる                                                  | **採用** |
| Diátaxis に合わせて how-to と explanation を別ファイルにする | 同じ作法の手順と理由が別ファイルに離れ、片方だけが直される。主題の数だけファイルが倍になる                   | 却下     |
| コードを抜き書きして載せる                                   | 読み手は開かずに済むが、実装が変わっても抜き書きは変わらない (Tip 8-8)                                       | 却下     |
| ADR の決定を要約して載せる                                   | ガイドだけで読めるが、ADR を改訂すると要約が古い決定を言い続ける                                             | 却下     |
| 書き換えず、変えたら新しい版を足す                           | 古い手順が現在の手順と並び、どれに従うかを読み手が判別する必要がある。Catio は設計文書を更新し続ける側に置く | 却下     |

## Consequences

- ガイドを読む人は、決定の理由を知るために ADR を開く。ガイドは ADR の番号を持つので辿れる
- ガイドの手順が指すファイルを rename したら、`git grep -n '<旧パス>' docs/guides` で直す。パスの参照は機械で検査しない
- 1 本が長くなり主題が 2 つ混ざったら、ファイルを分けて `docs/guides/README.md` の一覧を直す

## 出典

- Diátaxis (how-to guides、explanation の定義): https://diataxis.fr/ / https://diataxis.fr/how-to-guides/ / https://diataxis.fr/explanation/
- arc42 Tip 8-4「In concepts, explain HOW it works!」: https://docs.arc42.org/tips/8-4/
- arc42 Tip 8-8「Document concepts with source code!」: https://docs.arc42.org/tips/8-8/
- Catio「Architecture Decision Records (ADRs): The 2026 Guide」: https://www.catio.tech/blog/architecture-decision-record
