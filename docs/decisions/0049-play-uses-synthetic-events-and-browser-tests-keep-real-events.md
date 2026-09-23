# ADR-0049: play は合成イベントで書き、実イベントの規律と移せない検証はブラウザテストに残す

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0048 (play を書く部品の軸) / ADR-0040 (待機) / ADR-0041 (実イベント) / ADR-0042 (animation)

## Context

play は Storybook の UI 上でも実行されるため CDP を使えない。story と既存のブラウザテストは同じ部品の振る舞いを固定しうる。

## Decision

### play へ移した検証はブラウザテストから削る

play で書いた検証は既存のブラウザテストから削る。同じ振る舞いを 2 箇所で固定しない。

移す手順 (ファイルごとの実測、test ファイルと helper の扱い) は `docs/guides/storybook.md`「ブラウザテストから play へ移す」にある。移行は story を書く部品に限り、一律移行はしない。

### play の操作は合成イベントとし、実イベントの規律はブラウザテストが持つ

play は Storybook の UI 上でも実行されるため CDP を使えず、`storybook/test` の合成イベントで操作する。ADR-0041 が定めた実イベントでの発火の規律はブラウザテスト側がそのまま持ち、play へは移さない。

ADR-0041 が禁じた同期 2 連射は play では起きない。`storybook/test` の操作が各手順を await するためである。

どのブラウザテストが実イベントの規律を持つかは、そのテストファイルの JSDoc に書く。story へ移した結果、実イベントの検証がリポジトリから消えることを防ぐ。

画面のテストは Action 層の guard を代替しない。`confirmDelete` は `close()` のあと `void runAction(...)` と同期に返るので Transition が即終了し、2 発目の時点で `isPending` は false になる。`disabled={isPending}` を外しても browser project は 1 件も落ちない (2026-09-20 実測)。経路が薄いラッパーを通ることは、その guard を通ることを意味しない。

story を書かない部品のテストは触らない。story を書いた部品でも、移せない case はブラウザテストに残し、残す理由をそのファイルの JSDoc に書く。理由を書かないと、次に読む人が「移し忘れ」と読んで消す。

移せないのはレイアウトと配色の実測 (`getComputedStyle` / `getBoundingClientRect`)、型契約 (`expectTypeOf`)、CDP 経由の実イベントの 3 つである。`src/components/ui/` の既存テスト 26 case のうち 25 case がこれに当たる (2026-09-20 実測)。

この 3 つは play を書く部品の話である。ADR-0048 で play を書かないと決めた部品 (args だけで状態が決まるもの) では、story が描画と axe しか走らせず何も検証しない。構造の契約もブラウザテストに残り、残す根拠は下の役割分担になる。JSDoc にはどちらの根拠で残したかを書く。

play の書き方 (閉じる play は unmount を待つ、`waitFor` で待つ、animation の無効化を入れる先) は `docs/guides/storybook.md`「play を書く」にある。

### story とブラウザテストの役割分担

| 対象                 | 役割                                                   |
| -------------------- | ------------------------------------------------------ |
| story                | どんな状態があるか。目で見るカタログ                   |
| 既存のブラウザテスト | その状態が壊れていないか。寸法と色を固定する回帰の防止 |

役割が違うため両方残す。ADR-0040 / ADR-0041 / ADR-0042 が固めた待機・実イベント・animation 無効化の規律は既存のテストが持ち続ける。

### 検討した選択肢

| 案                                                                | 評価                                                                                                           | 採否     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| 既存のブラウザテストを丸ごと story へ移す                         | portable stories は state 更新を伴う再描画を支援しない。待機・実イベント・animation の規律を移植する動機も無い | 却下     |
| play は合成イベントで書き、実イベントの規律はブラウザテストに残す | Storybook の UI 上でも play が動き、実イベントの検証もリポジトリから消えない                                   | **採用** |

## Consequences

- 検証が一部 CDP の実イベントから合成イベントへ移り、backdrop の遮りを含む pointer の忠実さは下がる。一方イベント間に描画が挟まる点は既存のブラウザテストと同じ性質になる
- `storybook/test` の `expect` は vitest の matcher をすべて持つわけではない。ブラウザテストの assertion を story へ機械的に写せない箇所が出る (`docs/guides/storybook.md`「play を書く」)

## 出典

- Storybook: Interaction testing — https://storybook.js.org/docs/writing-tests/interaction-testing
