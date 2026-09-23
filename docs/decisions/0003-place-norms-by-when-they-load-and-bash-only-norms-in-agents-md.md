# ADR-0003: 規範の置き場所は読み込まれる契機で決め、Bash で打つだけの操作の規範は AGENTS.md に置く

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0001 (文書の層と参照の向き) / ADR-0002 (rules の 1 項目に書くもの)

## Context

規範は、読み込まれて初めて効く。Claude Code が規範を読み込む契機は置き場所ごとに違う。

| 置き場所                                             | 読み込まれる契機                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `AGENTS.md` (`CLAUDE.md` はこのファイルへの symlink) | セッションの開始時                                                         |
| `.claude/rules/` (`paths` なし)                      | セッションの開始時 (AGENTS.md と同じ)                                      |
| `.claude/rules/` (`paths` あり)                      | `paths` に一致するファイルを Claude が読んだとき。ツールを使うたびではない |

`vp test run` やパッケージ操作のように Bash でコマンドを打つだけの操作は、ファイルを読まずに始まる。
その操作の規範を `paths` つきの rules に置くと、操作の途中で一致するファイルを読まない限り読み込まれない。

rules の外にある文書 (`docs/guides/` の設計ガイド。ADR-0001) へ Claude を届ける方法も、読み込まれる契機で決まる。2026-09-24 に Claude Code 2.1.280 で、検証用のリポジトリを使い各 2 回測った。

| 届け方                                                       | 結果                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `paths` つきの rules から `@docs/guides/x.md` を import する | `paths` に一致するファイルを触らなくても、起動時に読み込まれた。どのツールも使わせない問いで、import 先に書いた合言葉を答えた                                                                                            |
| rules に「作業の前に `docs/guides/x.md` を読む」と書く       | 2 回とも読まれなかった。memory docs の "Claude sees `AGENTS.md` only if it decides to open the file" (CLAUDE.md から言葉で AGENTS.md を読むよう指示した場合の記述) と同じ振る舞い                                        |
| skill に置き、`paths` を付ける                               | 自分では測っていない。上流の issue 49835 (open) は、`paths` を付けた skill が一覧にも `/name` の呼び出しにも出ないと報告している。2.1.233 での再現の報告では、一致するファイルを読むまで隠れ、読んだ後に使えるようになる |

memory docs は import について "Imported files are expanded and loaded into context at launch alongside the CLAUDE.md that references them." と書いており、1 行目の結果と一致する。

## Decision

**規範は、それが要る場面で読み込まれる置き場所に置く。Bash で打つだけの操作の規範は `AGENTS.md` に置く。rules は設計ガイドを import せず、読むようにも書かない。規範は rules 自身が持ち、ガイドの節は出典として指すだけにする。**

| 規範が要る場面                                                 | 置き場所                        |
| -------------------------------------------------------------- | ------------------------------- |
| 特定のファイルを読んで編集するとき                             | `paths` つきの `.claude/rules/` |
| Bash でコマンドを打つだけの操作 (テストの実行、依存の操作など) | `AGENTS.md`                     |

- `AGENTS.md` が大きくなりすぎたら、ファイルを読む場面の規範を `paths` つきの rules へ分ける
- ファイルを読む前に要る規範 (新しいファイルを書き始める前の手順) と、Bash で打つだけの操作に要る規範は、`AGENTS.md` 自身に書く。`AGENTS.md` から rules やガイドを「読む」と言葉で誘導しても、読まれる保証は無い。根拠は、rules から言葉で誘導した場合に 2 回とも読まれなかった上の測定と、CLAUDE.md から言葉で AGENTS.md を読むよう指示した場合について memory docs が書く "Claude sees `AGENTS.md` only if it decides to open the file" である。AGENTS.md からの誘導そのものは測っていない。新しいファイルを書くだけでは `paths` の rules は読み込まれない

### 検討した選択肢

| 案                                 | 評価                                                                                       | 採否     |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| 読み込まれる契機で置き場所を決める | Bash だけの操作にも規範が届き、ファイルを読む場面の規範は必要なときだけ context に載る     | **採用** |
| すべて `AGENTS.md` に置く          | 取りこぼしは無いが、毎セッション全文が載る。公式 docs は長いファイルほど遵守が下がるとする | 却下     |
| すべて `paths` つきの rules に置く | context は節約できるが、ファイルを読まない操作の規範が読み込まれない                       | 却下     |
| `paths` なしの rules に分ける      | 開始時に読み込まれるので `AGENTS.md` と同じ量が載り、読み手が見る場所だけが増える          | 却下     |

設計ガイドへの届け方で比べた案は次のとおり。

| 案                                                       | 評価                                                                                                                                                 | 採否     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| rules が規範を自分で持ち、ガイドの節は出典として指すだけ | ガイドまで辿らなくても規範が効く                                                                                                                     | **採用** |
| rules から `@` で import する                            | `paths` つきの rules からでも起動時に読み込まれた (上の測定)。全ガイドが毎セッションの context に載る                                                | 却下     |
| rules を道案内にし、ガイドを読むよう書く                 | 2 回とも読まれなかった (上の測定)。規範がガイドにしか無いと効かない                                                                                  | 却下     |
| skill に置く                                             | `paths` を付けると、一致するファイルを読むまで見つからない (issue 49835)。rules と同じ契機でしか読まれず、rules に規範を置くのと比べて得るものが無い | 却下     |
| Storybook の docs (MDX) に置く                           | UI 部品に付く文書で、lint・テスト・依存の主題を置けない。agent 向けの機能は "Storybook's AI capabilities are currently in preview."                  | 却下     |

## Consequences

- 規範を足すときは、内容より先に「それが要る場面でファイルを読むか」を決める
- `paths` の rules に置いた規範は、一致するファイルを読まない限り効かない。効いていないことはセッションの中からは見えない

## 出典

- anthropics/claude-code の issue 49835「Skill with paths frontmatter is completely undiscoverable」: https://github.com/anthropics/claude-code/issues/49835
- Storybook「AI」(preview であること): https://storybook.js.org/docs/ai
- Claude Code: How Claude remembers your project ("Path-scoped rules trigger when Claude reads files matching the pattern, not on every tool use." / "Rules without `paths` frontmatter are loaded at launch with the same priority as `.claude/CLAUDE.md`." / import が起動時に読み込まれること、言葉で指示した AGENTS.md は Claude が開くと決めたときだけ読まれること): https://code.claude.com/docs/en/memory
