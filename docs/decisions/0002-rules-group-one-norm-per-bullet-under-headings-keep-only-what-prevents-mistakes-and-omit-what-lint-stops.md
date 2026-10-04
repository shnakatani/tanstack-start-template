# ADR-0002: rules は見出しと箇条書きで 1 項目 1 規範に分け、消したら誤る規範だけを書き、lint が止めるものは書かない

- Status: Accepted
- Date: 2026-10-04
- 関連: ADR-0001 (文書の層と参照の向き) / ADR-0003 (読み込まれる契機で置き場所を決める)

## Context

rules は frontmatter の `paths:` で条件ロードされ、`paths` に一致するファイルを読んだときに Claude の文脈に載る (ADR-0003)。`src/**` のような広い glob を持つファイルはほぼ毎回載り、`docs.md`・`oxlint.md`・`vite-plus.md` のように `src` 以外のパスを持つファイルは、そのパスを読んだときだけ載る。

決定の根拠と改訂履歴を規範の行へ足していくと、規範 1 個に出典と派生規範と履歴が同居した長い項目に育つ。
実装時に必要なのは規範だけだが、取り出すには全文を読むしかない。

rules の書き方を ADR に置くのは、rules が `paths` に一致したときに文脈に載り、長いほど規範が見落とされるためである。memory docs は "Longer files consume more context and reduce adherence." と書く。これは CLAUDE.md についての記述だが、文脈に載る点は rules も同じである。膨らんだ rules の整理は、全項目について要否と出典を読み直す作業になる。

lint・型検査・build は、違反を決定的に止め、エラーメッセージで違反の箇所を示す。
同じ規範を rules にも書くと、止まる前に読む文と止まった後に読むメッセージの 2 か所が同じことを言う。

## Decision

### rules の 1 項目に書くもの

- 規範 (何をするか、何を禁じるか)。禁止を書くときは正解を対で書く
- 理由 1 文。下の「書くか削るかの判定」に残るときだけ書く
- 出典キー 1 つ。その規範を持つ ADR の番号か、ガイドの節を `docs/guides/<file>.md「<見出し>」` の形で指す (ADR-0001)。ライブラリの公式や上流 issue は、その ADR かガイドが引く。Claude Code のツール・skill・MCP の使い方だけを決める規範は rules か AGENTS.md にだけ置くので (ADR-0001)、上流の docs を直接指してよい
- 選択肢に順序があるならその順序 (先に試すもの、最終手段)
- 打ち消し不能または検出不能な落とし穴 (破っても静かに壊れるもの)

実測値の詳細、選択肢の比較と却下理由、改訂履歴、出典の解説文、作法の説明 (なぜその形か) は書かない。決定の比較は ADR、作法の説明と手順と作法の選び方の比較はガイドの explanation と how-to が持つ。

### 書かないもの

lint・型検査・build が止めるものは書かない。書くのは、lint が案内しない直し方だけにする。
違反は止まった時点でエラーメッセージが示す。同じ規範を rules にも書くと、その行のぶん他の規範が埋もれる。
直し方がメッセージから読み取れない (禁止だけを告げて正解の形を示さない) ときは、その正解の形を規範として書く。

### 書くか削るかの判定

規範の文にも理由の文にも、1 文ずつ「これを削除したら実装者が誤った選択をするか」を問う。
答えが No なら削る。Yes なら残す。

理由の文は、規範の文に無い事実を伝えるときだけ判定に残る。事実とは、ツール・描画・ファイルシステムの挙動と、破っても検査されずに黙ってずれることである。読み手に起きる不便 (探せない、読めない、判別できない) だけを述べる理由と、規範を裏返しただけの理由 (「X しないと X にならない」の形) は、規範から推し量れるので削る。prompting best practices の「Add context to improve performance」は、指示の背景を伝えると Claude が目的を理解しやすくなるとし、読み上げエンジンの例のあとに "Claude is smart enough to generalize from the explanation." と書く。規範の文に無い事実は、規範が名指ししない場面へ Claude が広げて当てる材料になる。どの理由を削るかは、この ADR の判定 (Best practices の "Would removing this cause Claude to make mistakes?") で決める。

規範は見出しでまとめ、1 項目 (箇条書き 1 つ、または表の 1 セル) に 1 規範を置く。
公式の memory docs は「CLAUDE.md vs auto memory」の節で "The more specific and concise your instructions, the more consistently Claude follows them." とし、「Write effective instructions」の節で "**Structure**: group related instructions under markdown headers and bullets." を挙げている。この指針は CLAUDE.md について書かれているが、後者の節の Consistency は `.claude/rules/` も CLAUDE.md と並べて見直す対象に挙げており、rules も context として読み込まれるので、rules の項目にも当てる。

1 項目の長さに上限は設けない。長くなったら、根拠の展開 (実測値、選択肢の比較、出典の解説、作法の説明) が混ざっている兆候として扱い、ADR かガイドへ移して出典キーだけを残す。
ファイル全体の行数にも上限は設けない。
規約があるのに繰り返し破られるなら、ファイルが長すぎて規則が埋もれている兆候として扱い、主題が複数混ざっていれば分割する。

行数を基準にしないのは、Claude Code 公式の Best practices が行数を示さず、1 行ずつの削除可否と「長すぎると規則が埋もれる」症状を基準にしているためである。
行数の目安は memory docs の "target under 200 lines per CLAUDE.md file" にあるが、これは毎セッション読み込まれる CLAUDE.md 1 ファイルの目安で、`paths` で条件ロードされる rules の項目の基準としては示されていない。
表を採ると行数は増えるがトークンはさほど増えない。行数を基準に据えると表を避ける動機が生まれ、引きやすさを損なう。

### 検討した選択肢

| 案                                                              | 評価                                                                                                                                       | 採否     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 規範を書き、規範の文に無い事実を伝えるときだけ理由 1 文を添える | 理由の文も削除の判定を通るので、残る理由は規範が名指ししない場面へ広げて当てる材料になる (prompting best practices の読み上げエンジンの例) | **採用** |
| すべての項目に規範 + 理由 1 文を書く                            | 規範を裏返しただけの理由が項目ごとに並び、Best practices の "Would removing this cause Claude to make mistakes?" に通らない行が残る        | 却下     |
| 規範のみ残す                                                    | 最も短いが、規範から読み取れない事情 (ファイルシステムの挙動、機械で検査していないこと) が 1 クリック先になり、規範の外の場面で誤る        | 却下     |
| 構造だけ変える                                                  | 長い行を分割して表を入れる。引きやすさは改善するが二重管理が残る                                                                           | 却下     |
| lint が止めるものも rules に書く                                | 止まる前にも読めるが、lint のメッセージと 2 か所で同じことを持ち、項目が埋もれる                                                           | 却下     |
| 1 項目の字数に上限を置く                                        | 字数の上限には出典が無く、見出しと箇条書きで 1 項目 1 規範に分ければ足りる                                                                 | 却下     |
| 出典に仕様の条項や上流 issue を直接書く                         | 一次情報へ 1 段で届くが、規範をガイドか ADR に書かずに済んでしまい、rules を差し替えると規範が残らない (ADR-0001)                          | 却下     |

## Consequences

- rules から根拠を削るぶん、規約の理由を知るには ADR かガイドを開く手間が増える。規範から読み取れない事情だけを理由 1 文で残し、日常の判断はそれで足りるようにする
- 基準は機械強制できない。レビューで見る
- lint のルールを外したり緩めたりしたら、そのルールが止めていた規範をガイドに書き、rules に写すかを見直す

## 出典

- Claude Code Best practices (CLAUDE.md の判定基準 "Would removing this cause Claude to make mistakes?" と、長すぎると規則が埋もれる失敗パターン): https://code.claude.com/docs/en/best-practices
- Claude API docs: Prompting best practices「Add context to improve performance」("Claude is smart enough to generalize from the explanation."): https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices
- Claude Code: How Claude remembers your project ("Longer files consume more context and reduce adherence."、"The more specific and concise your instructions, the more consistently Claude follows them."、"**Structure**: group related instructions under markdown headers and bullets."、CLAUDE.md の "target under 200 lines per CLAUDE.md file"): https://code.claude.com/docs/en/memory
- Lost in the Middle: How Language Models Use Long Contexts (context 中間での利用率低下): https://aclanthology.org/2024.tacl-1.9/
- Context Rot: How Increasing Input Tokens Impacts LLM Performance (入力長に伴う劣化): https://research.trychroma.com/context-rot
