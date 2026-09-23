# ADR-0000: 決定は 1 本に 1 つずつ ADR に記録し、枠内の調整は書き換え、決定が変わったら新しい ADR で置き換える

- Status: Accepted
- Date: 2026-09-23

## Context

ツールチェーン・lint 方針・型の作り方・UI 基盤のような構造的な判断は、後から「なぜこうしたのか」を問われる。
コードと git 履歴には何を選んだかは残るが、何と比べて何を捨てたかは残らない。

記録の形式を決めずに書き始めると、次のことが揃わない。

| 揃わないもの       | 壊れ方                                                                    |
| ------------------ | ------------------------------------------------------------------------- |
| 1 本に入れる決定数 | 一部の決定だけが置き換わったとき、Status で表せず、どの節が有効か読めない |
| 決定が変わったとき | 書き換えと新設が混ざり、どちらが現在の決定かを本文から判別できない        |
| 番号               | 番号を使い回すと、古い参照が別の決定を指す                                |

## Decision

**決定ごとに ADR を 1 本書き、`docs/decisions/NNNN-title-with-dashes.md` に連番で置く。同じ決定の枠内の調整は書き換えて `Revised` に残し、決定が変わったら新しい ADR を起こして旧 ADR を `Superseded` にする。**

### 決定の単位

- 1 本の ADR は 1 つの決定を持つ。複数の決定が同居したら分ける。一部だけが置き換わったとき、Status が本全体にしか掛からないため
- 番号は連番で振り、使い回さない。古い参照が別の決定を指さないようにするため
- タイトルは、解いた問題と選んだ解を表す短い文にし、決定を言い切る。一覧のタイトルだけで何を選んだかが分かる (MADR のテンプレートの `# {short title, representative of solved problem and found solution}`)
- ファイル名は `NNNN-<タイトルの英訳を小文字と dash にしたもの>.md` にする。題目の形 (`toolchain`、`criteria`) にしない。ファイル名だけで決定が読める (MADR の `NNNN-title-with-dashes.md`。adr-tools もタイトルからファイル名を作る)
- `Date` は決定を下した日にする。枠内の改訂の日は `Revised` が持つ。MADR の `date` は最終更新日を持つので、そこは MADR と違う

### Status

| Status     | 意味                                            |
| ---------- | ----------------------------------------------- |
| Proposed   | 提案中（レビュー待ち）                          |
| Accepted   | 採用・有効                                      |
| Deprecated | 非推奨（代替なしで使わなくなった）              |
| Superseded | 別 ADR に置き換えられた（`Superseded-by` 併記） |

### 決定が変わったとき

| 変わり方                                        | 扱い                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 決定そのものが別の決定に置き換わる              | 新しい ADR を起こし、旧 ADR と一覧の行の Status を `Superseded` にする。`Supersedes` / `Superseded-by` の行に互いの `ADR-NNNN` を書く。markdown リンクを添えるのは `Superseded-by` だけ (`.claude/rules/docs.md`「ドキュメントの間」) |
| 同じ決定の枠内で内容を改める (範囲・条件の調整) | その ADR を書き換え、`Revised` に日付と要約を書く。一覧の Date 欄も `YYYY-MM-DD（YYYY-MM-DD 改訂）`                                                                                                                                   |
| 用語・表現の補足、実測値の追記                  | 書き換えるだけで `Revised` に載せない。決定の内容は変わっていない                                                                                                                                                                     |
| 代替なしで使わなくなる                          | `Deprecated` にする                                                                                                                                                                                                                   |

- 置き換えで旧 ADR を残すのは、旧い決定の Context と却下理由が、置き換えた理由を読む前提になるためである。旧 ADR を指す参照が残っても、`Superseded-by` が次の ADR へ誘導する (Nygard、adr-tools)
- 枠内の改訂を新しい ADR にしないのは、1 つの決定が複数の ADR に散り、どの ADR がまだ効いているかが一覧から読めなくなるためである。書き換えた内容は `Revised` に日付と要約で残す (joelparkerhenderson/architecture-decision-record は、既存の ADR へ日付つきで追記する運用のほうがチームでうまく回ったと書いている)

### 形式

メタデータの書き方は `docs/decisions/README.md` の手順が持つ。節は最低限次の 3 つにし、題材に応じて調査・設定の節を足す。

- **Context**: 背景・制約・要件。判断の前提を書く
- **Decision**: 何を選んだか。検討した選択肢の比較表 (候補 / 評価軸 / 採否) と却下理由を必ず含める
- **Consequences**: 採用結果として起きること (メリット・デメリット・後続作業・再評価条件)

任意の節の例は「調査結果」(実測の根拠)、「設定上の注意 / リスク」、「出典」。

### 記述

- 主張は実コード・実測で裏づける。コード参照は `src/path/to/file.ts` のようにファイルパスで書き、半年後も追える形にする
- 決定の文そのものを個別の部品名に依存させない。部品は改名されるが ADR は改名に追随しないので、決定が宙に浮く。根拠としてのファイルパス参照は書いてよい
- 指示語（「本 PR」「今回の」）・チャット内画像参照（`[Image #N]`）を書かない。相対日付は絶対日付（`YYYY-MM-DD`）に変換する（`.claude/rules/docs.md`）
- 外部料金・ライブラリ仕様など変動する数値は、前提条件と確認時点を明記し、可能なら出典 URL を「出典」節に置く

### 検討した選択肢

| 案                                                 | 評価                                                                                                                                                                                             | 採否     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1 本 1 決定、変わったら Superseded、枠内は Revised | Nygard の形式に沿い、置き換えの前後を両方読める。枠内の調整で ADR が増えない                                                                                                                     | **採用** |
| 変わったら常に既存の ADR を書き換える              | 本数は増えないが、旧い決定の Context と却下理由が git 履歴にしか残らない                                                                                                                         | 却下     |
| immutable (採択後は Status 以外を変えない)         | Fowler、Microsoft Well-Architected、AWS Prescriptive Guidance が採る形。ただし枠内の調整でも本数が増え、どの ADR がまだ効いているかが一覧から読めなくなる (Catio)。廃止した ADR を指す参照も残る | 却下     |
| 1 本に関連する決定をまとめる                       | 1 本で文脈を読めるが、一部だけが置き換わったとき Status で表せない。節の序数で指す参照がずれる                                                                                                   | 却下     |

## Consequences

- 決定を足すたびに ADR が 1 本増える。本数が増えるぶん、`docs/decisions/README.md` の一覧をテーマで引けるように保つ
- 枠内の改訂か置き換えかの線引きは機械で判定できない。レビューで見る
- `scripts/checks/integrity/adr-index.test.ts` が見るのは、ADR ファイルと README の一覧の対応 (追記漏れとリンク切れ)、`Superseded` の ADR の一覧の行と `Superseded-by` の有無、`Supersedes` / `Superseded-by` の対である。本文の `ADR-NNNN` の行き先は見ない

## 出典

- Michael Nygard「Documenting Architecture Decisions」(1 本 1 決定、連番を使い回さない、置き換えた ADR を残して superseded にする): https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- MADR (タイトルの形 `# {short title, representative of solved problem and found solution}`、ファイル名の形 "The filenames are following the pattern `NNNN-title-with-dashes.md`"、Status の値): https://adr.github.io/madr/
- joelparkerhenderson/architecture-decision-record ("In theory, immutability is ideal. In practice, mutability has worked better for our teams. We insert the new info the existing ADR, with a date stamp, and a note that the info arrived after the decision."): https://github.com/joelparkerhenderson/architecture-decision-record
- Martin Fowler「Architecture Decision Record」(immutable の例。"Once an ADR is accepted, it should never be reopened or changed - instead it should be superseded."): https://martinfowler.com/bliki/ArchitectureDecisionRecord.html
- Microsoft Azure Well-Architected Framework「Maintain an architecture decision record (ADR)」(immutable の例。"The ADR serves as an append-only log. Don't go back and edit accepted records."): https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record
- AWS Prescriptive Guidance「Architectural decision record process」(immutable の例。"When the team accepts an ADR, it becomes immutable."): https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html
- Catio「Architecture Decision Records (ADRs): The 2026 Guide」(2026-06-11。"If a future engineer can't tell from a directory listing which ADRs are load-bearing, the format has stopped working."): https://www.catio.tech/blog/architecture-decision-record
- adr-tools (`adr new -s` が新旧の ADR を相互にリンクし、旧 ADR の Status を置き換え済みにする): https://github.com/npryce/adr-tools
