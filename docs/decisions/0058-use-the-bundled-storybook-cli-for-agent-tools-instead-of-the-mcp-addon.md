# ADR-0058: Storybook の agent 向けツールは同梱の CLI を使い、MCP addon は入れない

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0005 (ツールチェーン) / ADR-0052 (Storybook の導入と framework) / ADR-0053 (story を状態のカタログにする)

## Context

`storybook@10.6.0` は agent 向けの機構を 2 経路で配っている。本体同梱の CLI (`storybook skills` / `storybook tools`) と、別パッケージの `@storybook/addon-mcp` である。どちらも同じツール群 (`docs list` / `docs show` / `stories changed` / `stories find-by-component` / `stories preview` / `review create` / `test run`) を公開する。

公式ドキュメントに載っているのは MCP だけで、CLI は記載がない。一方で CLI は `storybook --help` のコマンド一覧にも出ない。どちらも探さないと見つからない。

このリポジトリはテンプレートとして配布され、Storybook の port は worktree ごとに変わる (`.mise.toml` の `storybook` タスクが `derive-dev-port.sh 6006` から導出する)。

## Decision

**同梱の CLI を使い、`@storybook/addon-mcp` は入れない。**

| #   | 決定                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------- |
| 1   | UI と story を触る前に `storybook skills` を読む。`stories` skill が定める手順を起点にする                 |
| 2   | 部品の props・API・使い方は `storybook tools docs list` / `docs show` で答える。ソースや型定義から答えない |
| 3   | `@storybook/addon-mcp` は入れない。MCP の登録が持てる URL は 1 つで、worktree ごとに変わる port へ配れない |
| 4   | CLI の存在と落とし穴は `AGENTS.md` に置く。決定の根拠と実測はこの ADR が持つ                               |

### 判断の根拠

| 観点             | CLI                                  | MCP                                                               |
| ---------------- | ------------------------------------ | ----------------------------------------------------------------- |
| 追加パッケージ   | 不要 (本体同梱)                      | `@storybook/addon-mcp`                                            |
| Storybook の起動 | 多くのツールで不要 (下表)            | 全ツールで必要 (HTTP endpoint 経由)                               |
| 設定             | 不要                                 | `main.ts` に `componentsManifest: true` + エージェントへ URL 登録 |
| 配布             | clone すれば誰でも同じコマンドが動く | 登録はエージェント側の個人設定                                    |

決め手は 3 つ目である。MCP の登録はエージェント側の設定に URL を 1 つ持つ。この repo の Storybook の port は worktree ごとに変わるので、同じ登録を collaborator へ配れない。CLI は `--cwd` / `-c` でプロジェクトを指すため影響を受けない。

MCP が優るのは、ツールの説明がエージェントに常時見える点である。CLI は `AGENTS.md` に書いても読み飛ばせば使われない。2026-09-20 のセッションで、一度調べた `storybook skills` の存在を書き残さずに失い、同じ調査を繰り返した。決定 4 はその対策である。

### 起動の要否 (2026-09-20 実測)

port 6006 の Storybook を停止し、`--no-attach` を付けて 1 つずつ実行した。

| ツール                                                     | 起動         | 備考                             |
| ---------------------------------------------------------- | ------------ | -------------------------------- |
| `docs list` / `docs show` / `stories changed` / `test run` | 不要         |                                  |
| `stories preview` / `review create`                        | 必要         | preview URL と review の発行     |
| `stories find-by-component`                                | **実質必要** | 起動なしでも走るが結果が空で返る |

`stories find-by-component` は逆依存グラフを dev server が持つ。未起動だと `no stories found` が返り、story が無いのと区別が付かない。tool の help 自身が「If a component has no matches here, it has no stories yet (say so, don't fabricate)」と書いているため、読んだ側は「story が無い」と報告する。起動して `--port` で指すと距離つきで返る (`page-title.tsx` → `tokens` の 3 story が distance 1)。grep では出せない情報である。

## Consequences

- `storybook --help` に `skills` と `tools` が出ないため、`AGENTS.md` から外れた瞬間に見落とされる。AGENTS.md の「Storybook の skill と tools」節を残し続ける必要がある。AGENTS.md を削るときに消さない
- `write-story` skill は上流の規約で、このリポジトリの決定と食い違う箇所がある (「ALWAYS write a Storybook story for any component written」「Simulate key user flows」)。上限は ADR-0053 / ADR-0054 が持つ。ADR に上限が書かれていない項目は上流の既定値が入る
- `find-by-component` を使うには Storybook を起動する。起動を省くと silent に空が返る
- MCP へ移るなら、port を固定するか、worktree ごとに登録し直す運用が要る

## 出典

- Storybook: AI — https://storybook.js.org/docs/ai
- `storybook skills` / `storybook tools` の出力 (storybook@10.6.0)
