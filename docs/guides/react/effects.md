# effect

effect に書くかイベントハンドラに書くかを決めるときの手順と、その判定の理由を持つ。

| 決定                                                                                                                              | ADR      |
| --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 状態の通知は常時 mount の live region に集約し、項目の状態は静的テキストと `aria-busy` で持つ                                     | ADR-0026 |
| ページは URL の変化で作り直さず、取得結果の入れ替わりはページの effect が取得の決着で通知し、直前に通知した条件と同じなら出さない | ADR-0027 |
| ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む             | ADR-0033 |

## explanation

### effect とイベントハンドラを分ける理由

コードを effect に書くかイベントハンドラに書くかは、そのコードが走る原因で決まる。React docs「Separating Events from Effects」は、迷ったら "consider _why_ the code needs to run" とする。

| 原因                                            | 置き場                                                                                          | React docs                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 特定の操作 (押した、送った)                     | イベントハンドラ。mutation を伴うなら mutation の callback (`onMutate` / `onSuccess`、ADR-0026) | "Event handlers run in response to specific interactions."                     |
| 表示されたこと (React の外の系を表示に合わせる) | effect                                                                                          | "Effects run whenever synchronization is needed."                              |
| 他の props や state (外の系が無い)              | 描画中に計算する                                                                                | "If there is no external system involved (...), you shouldn't need an Effect." |

- 操作が原因のコードを effect に置くと、同じ表示に戻っただけで走る。React docs「Synchronizing with Effects」の購入の例では、購入の POST を effect に置くと別のページから戻ったときにも購入が走る ("Buying is not caused by rendering; it's caused by a specific interaction.")
- 見分けには開発時の二重実行が使える。Strict Mode は開発時に effect を 2 回走らせる。2 回走ると利用者に見える結果が変わるなら、原因は描画ではなく操作である。見える結果が変わらない effect は、そのままでよい (同ページ「Sending analytics」の "We recommend keeping this code as is.")
- React の外の系には、DOM とブラウザ API、外部 widget、イベントの購読、router、announcer の live region が入る。React docs は例として、React でない widget の制御、サーバーへの接続、analytics の送信を挙げる

出典:

- React docs「Separating Events from Effects」: <https://react.dev/learn/separating-events-from-effects>
- React docs「Synchronizing with Effects」(「Sending analytics」「Not an Effect: Buying a product」): <https://react.dev/learn/synchronizing-with-effects>
- React docs「You Might Not Need an Effect」: <https://react.dev/learn/you-might-not-need-an-effect>

## how-to

### effect に書くかを判定する

上の行から順に当て、最初に当たった行の書き方にする。理由は「effect とイベントハンドラを分ける理由」が持つ。

| 順  | 当てはまるもの                                        | 書き方                                                                                                                                                                                      |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 特定の操作が原因 (保存、送信、操作の開始と完了の通知) | イベントハンドラ (`docs/guides/react/updates.md`「イベントハンドラを書く」)。mutation の開始と完了の通知は `onMutate` / `onSuccess` に書く (ADR-0026)                                       |
| 2   | 他の props や state から決まる値                      | 描画中に計算する。prop の変化に state を揃えるなら、描画中に更新するか `key` で作り直す (React docs「Adjusting some state when a prop changes」「Resetting all state when a prop changes」) |
| 3   | 外部ストアの値を読む                                  | `useSyncExternalStore`                                                                                                                                                                      |
| 4   | データ取得                                            | TanStack Query (ADR-0033)                                                                                                                                                                   |
| 5   | 表示された結果を React の外の系に合わせる             | effect。購読を張り直さずに最新の props や state を読むなら `useEffectEvent` へ出す (React docs `useEffectEvent`)                                                                            |

- 5 の effect は、開発時の二重実行で見える結果が変わらない形にする。後始末を返すか、同じ内容を 2 回出さないように直前の値を ref で持つ (ADR-0027 の件数の通知)
- 5 に当たる例: `src/components/ui/calendar.tsx` の focus、`src/components/ui/sidebar.tsx` の keydown の購読、取得の決着後の件数の通知 (ADR-0027)
