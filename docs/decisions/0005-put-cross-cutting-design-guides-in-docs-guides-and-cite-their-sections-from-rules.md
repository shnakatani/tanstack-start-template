# ADR-0005: 部品をまたぐ作法の説明と手順は docs/guides に置き、rules は出典としてその節を指す

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0001 (文書の層と参照の向き) / ADR-0003 (読み込まれる契機で置き場所を決める) / ADR-0006 (設計ガイドの書き方)

## Context

ADR には、決定のほかに、部品をまたいで守る作法の考え方 (なぜその形か) と、その作法で組む手順や落とし穴への対処が混ざっていた。
後者は選択肢から 1 つを選んだ記録ではないので、ADR の決定を読む妨げになる。

| 出典                       | ADR と、その外に置く文書の分け方                                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microsoft Well-Architected | ADR に載せるのは "choices that affect the system's structure, key quality attributes, or are difficult to reverse" に限る。"Avoid making decision records design guides." とし、補足は別の文書へリンクして、決定はそれ無しで読めるようにする                                                          |
| arc42                      | §9 Architecture Decisions と §8 Crosscutting Concepts を分ける。§8 は "practices, patterns, regulations or solution ideas" を持ち、"relate to or influence several of your building blocks" ものを 1 か所に集める。境界は Tip 8-9 の "if (extensive-explanation-required) then concept else decision" |

置き場所を決めるには、その文書が Claude の作業中に読まれるかを知る必要があった。
`.claude/rules/` は作業中に読まれる規範の置き場所で (ADR-0003)、別の文書へ Claude を届ける方法は 3 つ考えられる。
2026-09-24 に Claude Code 2.1.280 で、検証用のリポジトリを使い各 2 回測った。

| 届け方                                                       | 結果                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `paths` つきの rules から `@docs/guides/x.md` を import する | `paths` に一致するファイルを触らなくても、起動時に読み込まれた。どのツールも使わせない問いで、import 先に書いた合言葉を答えた                                                                                            |
| rules に「作業の前に `docs/guides/x.md` を読む」と書く       | 2 回とも読まれなかった。memory docs の "Claude sees `AGENTS.md` only if it decides to open the file" (CLAUDE.md から言葉で AGENTS.md を読むよう指示した場合の記述) と同じ振る舞い                                        |
| skill に置き、`paths` を付ける                               | 自分では測っていない。上流の issue 49835 (open) は、`paths` を付けた skill が一覧にも `/name` の呼び出しにも出ないと報告している。2.1.233 での再現の報告では、一致するファイルを読むまで隠れ、読んだ後に使えるようになる |

memory docs は import について "Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them." と書いており、1 行目の結果と一致する。

## Decision

**部品をまたぐ作法の説明と手順は `docs/guides/` に主題ごとに置く。rules はガイドを import せず、読むようにも書かない。rules は規範そのものを持ち、出典としてガイドの節を指す。**

- ガイドの節は `docs/guides/<file>.md「<見出し>」` の形で指す。rules からもコードからも同じ形で書く
- 層の分け方と参照の向きは ADR-0001、ガイドの中の書き方は ADR-0006 が持つ
- ガイドを読まなくても rules の規範は効く。rules は規範の 1 文と理由を持ち、ガイドは説明と手順を持つ

### 検討した選択肢

| 案                                                        | 評価                                                                                                                                                 | 採否     |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `docs/guides/` に置き、rules は出典としてガイドの節を指す | 人間が主題ごとに読める。rules は規範を自分で持つので、Claude がガイドまで辿らなくても規範は効く                                                      | **採用** |
| ADR に残す                                                | 決定が説明と手順に埋もれ、決定だけを読めない。Microsoft は ADR を design guide にしないよう求める                                                    | 却下     |
| rules から `@` で import する                             | `paths` つきの rules からでも起動時に読み込まれた (上の測定)。全ガイドが毎セッションの context に載る                                                | 却下     |
| rules を道案内にし、ガイドを読むよう書く                  | 2 回とも読まれなかった (上の測定)。規範がガイドにしか無いと効かない                                                                                  | 却下     |
| skill に置く                                              | `paths` を付けると、一致するファイルを読むまで見つからない (issue 49835)。rules と同じ契機でしか読まれず、rules に規範を置くのと比べて得るものが無い | 却下     |
| Storybook の docs (MDX) に置く                            | UI 部品に付く文書で、lint・テスト・依存の主題を置けない。agent 向けの機能は "Storybook's AI capabilities are currently in preview."                  | 却下     |

先行例として fallow-rs/fallow の `docs/development/knowledge-architecture.md` がある。"Auto-loaded routers and rules must contain only high-value constraints and routing. Stable explanations belong here so they are read on demand and shared by every host." とし、説明を `docs/` に、Claude 向けの制約を `.claude/rules/` に分けている。

## Consequences

- rules の項目がガイドの節を出典に指しても、Claude がガイドまで辿るかは確かめていない。rules が規範そのものを持つので、辿らなくても規範は効く
- ガイドの見出しを変えたら、`git grep -n 'docs/guides/<file>.md「'` で指している rules とコメントを直す。見出しへの参照は機械で検査しない
- 主題の一覧は `docs/guides/README.md` が持つ

## 出典

- Microsoft Azure Well-Architected Framework「Maintain an architecture decision record (ADR)」: https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record
- arc42 §8 Crosscutting Concepts: https://docs.arc42.org/section-8/
- arc42 §9 Architecture Decisions: https://docs.arc42.org/section-9/
- arc42 Tip 8-9「Document decisions instead of concepts!」: https://docs.arc42.org/tips/8-9/
- Claude Code: How Claude remembers your project (import が起動時に読み込まれること、言葉で指示した AGENTS.md は Claude が開くと決めたときだけ読まれること): https://code.claude.com/docs/en/memory
- anthropics/claude-code の issue 49835「Skill with paths frontmatter is completely undiscoverable」: https://github.com/anthropics/claude-code/issues/49835
- Storybook「AI」(preview であること): https://storybook.js.org/docs/ai
- fallow-rs/fallow「Knowledge architecture」: https://github.com/fallow-rs/fallow/blob/main/docs/development/knowledge-architecture.md
