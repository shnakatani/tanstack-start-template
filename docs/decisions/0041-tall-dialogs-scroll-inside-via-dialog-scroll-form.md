# ADR-0041: viewport 高を超えるダイアログは本体だけを内部スクロールさせ、`DialogScrollForm` で組む

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0006 (Dialog の Viewport と `popupOverflowBackstop` の乖離)、ADR-0014 (`ActionForm`)

## Context

入力項目の多いダイアログは viewport の高さを超える。
超えたときに何をスクロールさせるかで、見出しと閉じるボタンとフッターの見え方が決まる。

公式の例は次のとおり。

| 出典                                                 | 形                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI Dialog「Inside scroll dialog」               | Popup は画面に収めたまま、Header と Actions の間に `ScrollArea` を置いて本体だけをスクロールさせる。Popup の直下に Header / ScrollArea.Root / Actions を並べる               |
| Base UI Dialog「Outside scroll dialog」              | Viewport 側をスクロールさせ、Popup が画面の下端を越えて伸びる                                                                                                                |
| shadcn Dialog「Scrollable Content」「Sticky Footer」 | Header と Footer の間の本文を `-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4` の div でスクロールさせる。Header / Footer は sticky ではなく、本文の外に置いて固定する |

shadcn の例は本文の高さを `50vh` で打ち切る。フォームを包む `form` 要素の置き場は、どちらの公式例にも無い。

registry の Dialog には、内部スクロールを組み忘れたダイアログでも内容が読めるよう、Popup を `max-h-full overflow-y-auto` で溢れさせる backstop (`popupOverflowBackstop`) を足してある (ADR-0006)。backstop が効くと Popup ごとスクロールし、見出しと X ボタンも流れる。

## Decision

**恒常的に viewport 高を超えるダイアログは、`DialogScrollForm` + `DialogScrollBody` (`src/components/parts/dialog-scroll-body.tsx`) で本体だけを内部スクロールさせる。** Base UI の Inside scroll の形に、送信を持つ中間コンテナ (`form`) を足したもの。

| 規範                                                                                            | 守らないと何が壊れるか                                                                                          |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Header と Footer の間の中間コンテナを `DialogScrollForm` にし、本体を `DialogScrollBody` にする | 中間コンテナが縦の flex container で `min-h-0` を持たないと、内容高を下限にして縮まず内部スクロールが成立しない |
| 見出しと X ボタンを sticky にしない。backstop で流れる挙動は組み忘れの防御層として許容する      | sticky と内部スクロールの 2 つの固定機構が重なり、どちらが効いているか実測しないと分からなくなる                |
| 本文の余白は `DialogScrollBody` が持つ (`px-6` / `py-4`)。消費側で padding を足さない           | スクロール領域の内側に余白が無いと、端の要素の `ring` / `box-shadow` が境界で切れる                             |

各 className の実測の根拠は `dialog-scroll-body.tsx` の docstring が持つ。余白の見え方は `dialog-scroll-body.stories.tsx` の `Overflowing` で見る (寸法は測らない。ADR-0007)。

### 検討した選択肢

| 案                                                | 評価                                                                                       | 採否     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| 本体だけを内部スクロール (`DialogScrollForm`)     | 見出し・X ボタン・フッターが常に見える。Base UI の Inside scroll と同じ形                  | **採用** |
| shadcn の例のまま本文を `max-h-[50vh]` で打ち切る | 高さの打ち切りが viewport と Dialog の余白に追随しない。ダイアログごとに値を持つことになる | 却下     |
| Outside scroll (Viewport をスクロール)            | 見出しと X ボタンが流れる。backstop が効いた状態と同じ見え方を正規の形にすることになる     | 却下     |
| backstop に任せて Header を sticky にする         | 固定機構が 2 つになる                                                                      | 却下     |

## Consequences

- 送信を伴わない `div` の中間コンテナが要るときは、`dialogScrollLayout` を層の外へ配らず、同じファイルへ部品を足す (ADR-0021)
- `DialogContent` の padding を変えたら `DialogScrollBody` の `-mx-6` / `px-6` も変える
- フッターの配置 (中間コンテナの内か外か) は `.claude/rules/styling.md`「内部スクロールを持つダイアログの組み方」の表が持つ

## 出典

- Base UI Dialog「Inside scroll dialog」「Outside scroll dialog」: https://base-ui.com/react/components/dialog
- shadcn/ui Dialog (Base)「Scrollable Content」「Sticky Footer」: https://ui.shadcn.com/docs/components/base/dialog
- shadcn/ui の例のソース: https://github.com/shadcn-ui/ui/blob/main/apps/v4/examples/base/dialog-scrollable-content.tsx
