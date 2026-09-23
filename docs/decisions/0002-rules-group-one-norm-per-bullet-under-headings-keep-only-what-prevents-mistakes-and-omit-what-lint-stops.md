# ADR-0002: rules は見出しと箇条書きで 1 項目 1 規範に分け、消したら誤る規範だけを書き、lint が止めるものは書かない

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0001 (文書の層と参照の向き)

## Context

rules は frontmatter の `paths:` で条件ロードされる。
`src/**` のような広い glob を持つファイルは、肥大した本文がほぼ毎回 context に載る。

決定の根拠と改訂履歴を規範の行へ足していくと、規範 1 個に出典と派生規範と履歴が同居した長い項目に育つ。
実装時に必要なのは規範だけだが、取り出すには全文を読むしかない。

lint・型検査・build は、違反を決定的に止め、エラーメッセージで違反の箇所を示す。
同じ規範を rules にも書くと、止まる前に読む文と止まった後に読むメッセージの 2 か所が同じことを言う。

## Decision

### rules の 1 項目に書くもの

- 規範 (何をするか、何を禁じるか)。禁止を書くときは正解を対で書く
- 理由 1 文 (守らないと何が壊れるか)
- 出典キー 1 つ (ADR 番号、仕様の条項番号、上流 issue 番号のいずれか)
- 選択肢に順序があるならその順序 (先に試すもの、最終手段)
- 打ち消し不能または検出不能な落とし穴 (破っても静かに壊れるもの)

実測値の詳細、選択肢の比較と却下理由、改訂履歴、出典の解説文は書かない。ADR が持つ。

### 書かないもの

lint・型検査・build が止めるものは書かない。書くのは、lint が案内しない直し方だけにする。
違反は止まった時点でエラーメッセージが示す。同じ規範を rules にも書くと、その行のぶん他の規範が埋もれる。
直し方がメッセージから読み取れない (禁止だけを告げて正解の形を示さない) ときは、その正解の形を規範として書く。

### 書くか削るかの判定

1 行ずつ「これを削除したら実装者が誤った選択をするか」を問う。
答えが No なら削る。Yes ならそれは理由ではなく規範なので残す。

規範は見出しでまとめ、1 項目 (箇条書き 1 つ、または表の 1 セル) に 1 規範を置く。
公式の memory docs は "Specific, concise, well-structured instructions work best." とし、"**Structure**: use markdown headers and bullets to group related instructions" を挙げている。この指針は CLAUDE.md について書かれているが、同じ節 (Write effective instructions) の Consistency は `.claude/rules/` も CLAUDE.md と並べて見直す対象に挙げており、rules も context として読み込まれるので、rules の項目にも当てる。

1 項目の長さに上限は設けない。長くなったら、根拠の展開 (実測値、選択肢の比較、出典の解説) が混ざっている兆候として扱い、ADR へ移して出典キーだけを残す。
ファイル全体の行数にも上限は設けない。
規約があるのに繰り返し破られるなら、ファイルが長すぎて規則が埋もれている兆候として扱い、主題が複数混ざっていれば分割する。

行数を基準にしないのは、Claude Code 公式の Best practices が行数を示さず、1 行ずつの削除可否と「長すぎると規則が埋もれる」症状を基準にしているためである。
行数の目安は memory docs の "target under 200 lines per CLAUDE.md file" にあるが、これは毎セッション読み込まれる CLAUDE.md 1 ファイルの目安で、`paths` で条件ロードされる rules の項目の基準としては示されていない。
表を採ると行数は増えるがトークンはさほど増えない。行数を基準に据えると表を避ける動機が生まれ、引きやすさを損なう。

### 検討した選択肢

| 案                               | 評価                                                                             | 採否     |
| -------------------------------- | -------------------------------------------------------------------------------- | -------- |
| 規範 + 理由 1 文                 | 失敗の記録は残り、詳細は出典キーで辿れる                                         | **採用** |
| 規範のみ残す                     | 最も短いが、規約を破る場面で理由が 1 クリック先になり形骸化を招く                | 却下     |
| 構造だけ変える                   | 長い行を分割して表を入れる。引きやすさは改善するが二重管理が残る                 | 却下     |
| lint が止めるものも rules に書く | 止まる前にも読めるが、lint のメッセージと 2 か所で同じことを持ち、項目が埋もれる | 却下     |
| 1 項目の字数に上限を置く         | 字数の上限には出典が無く、見出しと箇条書きで 1 項目 1 規範に分ければ足りる       | 却下     |

## Consequences

- rules から根拠を削るぶん、規約の理由を知るには ADR を開く手間が増える。理由 1 文を残すことで日常の判断はカバーする
- 基準は機械強制できない。レビューで見る
- lint のルールを外したり緩めたりしたら、そのルールが止めていた規範を rules に書くかを見直す

## 出典

- Claude Code Best practices (CLAUDE.md の判定基準 "Would removing this cause Claude to make mistakes?" と、長すぎると規則が埋もれる失敗パターン): https://code.claude.com/docs/en/best-practices
- Claude Code: How Claude remembers your project ("Specific, concise, well-structured instructions work best."、"**Structure**: use markdown headers and bullets to group related instructions"、CLAUDE.md の "target under 200 lines per CLAUDE.md file"): https://code.claude.com/docs/en/memory
- Lost in the Middle: How Language Models Use Long Contexts (context 中間での利用率低下): https://aclanthology.org/2024.tacl-1.9/
- Context Rot: How Increasing Input Tokens Impacts LLM Performance (入力長に伴う劣化): https://research.trychroma.com/context-rot
