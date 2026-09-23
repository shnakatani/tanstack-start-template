# ADR-0029: Select の値の解決は消費側が持ち、Base UI の自己リセットに依存しない

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0026 (registry への改変の統制)

## Context

Base UI の `Select` は、候補が変わって現在値が候補から消えたとき、自分で値を戻して `onValueChange` を呼ぶことがある。
この挙動は公式 docs の Select に書かれていない。同梱の `node_modules/@base-ui/react/docs/react/components/select.md` を `reset` / `onValueChange` で検索しても、`onValueChange` の型の行と、placeholder の外に置く reset ボタンの話しか出ない (2026-09-23、1.8.0)。

実装は `@base-ui/react` 1.8.0 の `select/positioner/SelectPositioner.mjs` の `onMapChange` にある (ソースの読み取り。挙動の実測はしていない)。

| 条件                                                             | ソース上の扱い                        |
| ---------------------------------------------------------------- | ------------------------------------- |
| 項目が 1 件も登録されていない (`valuesRef.current.length === 0`) | 何もしない                            |
| 初回の登録 (`prevSize === 0`)                                    | 何もしない                            |
| 単一選択で現在値が `null`                                        | 何もしない                            |
| 現在値が候補に無く、マウント時の値が候補にある                   | マウント時の値へ戻す。`null` は来ない |
| 現在値もマウント時の値も候補に無い                               | `null` で `setValue` する             |

項目の登録の変化を拾う `CompositeList` は、件数に加えて要素の同一性も比べる。
件数が変わらないときに何もしない分岐は 1.8.0 より前の版にあり、1.8.0 で撤去された (CHANGELOG の v1.8.0「Remove redundant size check in `<Select.Positioner>`」、mui/base-ui の PR 5469)。
上流が版ごとにこの経路を変えていることは、依存する側から見て安定した契約ではないことを示す。

項目がいつ登録されるか (トリガーを一度もフォーカスしていない間は登録されないか) は、ソースからも docs からも確かめていない。未確認として扱う。

## Decision

**「選択中の値が候補から消えた」の検出を `onValueChange` の `null` 通知に頼らない。値の解決は消費側で引き取る。** 実例は `src/components/parts/form-fields.tsx` の `FormSelectField`。

| 規範                                                                                            | 守らないと何が壊れるか                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `onValueChange` で `null` を受けても form の値を消さない。`console.warn` に現在値と突合元を残す | 候補の入れ替えで form の値が黙って消える                                                               |
| `options` に無い値を受けたら、表示を保ったまま `console.warn` に値と突合元を残す                | Base UI との配線の不整合が誰にも見えない                                                               |
| 候補から消えた値の扱い (保持・再選択の促し) は消費側で決める                                    | 通知が来ない条件 (未登録・`null`・マウント時の値へ戻る) で、解決できない値がトリガーに内部値のまま残る |

### 検討した選択肢

| 案                                             | 評価                                                                       | 採否     |
| ---------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| 消費側で値を解決し、Base UI の通知は警告に使う | 通知の有無に依らず form の値が決まる                                       | **採用** |
| Base UI の自己リセットに任せる                 | 公式 docs に無い挙動で、通知されない条件があり、版で経路が変わる (PR 5469) | 却下     |

## Consequences

- `FormSelectField` を包まずに `Select` を使う箇所は、同じ引き取りを自分で書く
- Base UI を更新したら `SelectPositioner` の `onMapChange` と CHANGELOG の Select の項を見直し、上の表を実物に合わせて書き換える

## 出典

- Base UI Select: https://base-ui.com/react/components/select
- Base UI CHANGELOG v1.8.0: https://github.com/mui/base-ui/blob/master/CHANGELOG.md
- mui/base-ui PR 5469「[select] Remove redundant size check in SelectPositioner」: https://github.com/mui/base-ui/pull/5469
- `SelectPositioner` の実装: https://github.com/mui/base-ui/blob/master/packages/react/src/select/positioner/SelectPositioner.tsx
