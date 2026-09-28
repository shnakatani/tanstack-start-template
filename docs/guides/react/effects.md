# effect

コードを effect に書くかイベントハンドラに書くかを決めるときの手順と、その判定の理由を持つ。

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

- 操作が原因のコードを effect に置くと、同じ表示に戻っただけで走る。React docs「Synchronizing with Effects」の購入の例では、購入の POST を effect に置くと、別のページから戻ったときにも購入が走る ("Buying is not caused by rendering; it's caused by a specific interaction.")
- React の外の系には、DOM とブラウザ API、外部 widget、イベントの購読、router、announcer の live region が入る。React docs は例として、React でない widget の制御、サーバーへの接続、analytics の送信を挙げる
- 取得結果の件数の通知 (ADR-0027) は、打鍵が契機に見えても原因は表示である。結果の入れ替わりは確定・戻る・進む・Link のどれでも起き、取得の決着は描画の側でしか分からない

### 開発時の二重実行が示すもの

Strict Mode は開発時に、mount の直後に 1 回だけ unmount と mount をやり直す ("React remounts every component once after mount")。effect は setup → cleanup → setup の順に走る。
このとき利用者に見える結果が変わるかで、effect の書き方の誤りを見分けられる。

| 二重実行で見える結果                   | 読み方                                                                       | React docs「Synchronizing with Effects」                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 変わらない                             | そのままでよい                                                               | 「Sending analytics」の "We recommend keeping this code as is."                                                                                                           |
| 変わるが、後始末を書けば変わらなくなる | 後始末が足りない。effect のまま、effect がしたことを止めるか戻す後始末を書く | "Usually, the answer is to implement the cleanup function."                                                                                                               |
| 後始末を書いても変わる                 | 原因は操作である。イベントハンドラへ移す                                     | 「Not an Effect: Buying a product」の "Sometimes, even if you write a cleanup function, there's no way to prevent user-visible consequences of running the Effect twice." |

- effect を 1 回しか走らせないための ref は書かない。再 mount の後にも正しく動く必要があり、1 回に抑えても直らない (Pitfall「Don't use refs to prevent Effects from firing」の "To fix the bug, it is not enough to just make the Effect run once.")
- ref で直前に反映した値を持ち、外の系がその値をすでに反映していれば何もしない形は、これと別物である。effect は何度走っても同じ結果になる (ADR-0027 の件数の通知)

出典:

- React docs「Separating Events from Effects」: <https://react.dev/learn/separating-events-from-effects>
- React docs「Synchronizing with Effects」(「How to handle the Effect firing twice in development?」「Sending analytics」「Not an Effect: Buying a product」): <https://react.dev/learn/synchronizing-with-effects>
- React docs「You Might Not Need an Effect」: <https://react.dev/learn/you-might-not-need-an-effect>

## how-to

### effect に書くかを判定する

上の行から順に当て、最初に当たった行の書き方にする。理由は「effect とイベントハンドラを分ける理由」が持つ。

| 順  | 当てはまるもの                                                          | 書き方                                                                                                                                                                                                                                                                      |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 特定の操作が原因 (保存、送信、操作の開始と完了の通知、親への変化の通知) | イベントハンドラ (`docs/guides/react/updates.md`「イベントハンドラを書く」)。mutation の開始と完了の通知は `onMutate` / `onSuccess` に書く (ADR-0026)。親への変化の通知も、変化を起こしたハンドラの中で呼ぶ (React docs「Notifying parent components about state changes」) |
| 2   | 他の props や state から決まる値 (state の更新が連鎖するものを含む)     | 描画中に計算する。prop の変化に state を揃えるなら、描画中に更新するか `key` で作り直す (React docs「Adjusting some state when a prop changes」「Resetting all state when a prop changes」「Chains of computations」)                                                       |
| 3   | アプリの読み込みごとに 1 回だけ走る処理                                 | コンポーネントの外に置く。モジュールの最上位で走らせるか、モジュールの変数で 1 回に抑える。サーバーでも読まれるモジュールなら、ブラウザでだけ走らせる条件を付ける (React docs「Initializing the application」)                                                              |
| 4   | 外部ストアの値を読む                                                    | `useSyncExternalStore`                                                                                                                                                                                                                                                      |
| 5   | データ取得                                                              | TanStack Query (ADR-0033)                                                                                                                                                                                                                                                   |
| 6   | 表示された結果を React の外の系に合わせる                               | effect。止めるか戻すものがあれば後始末を返す。購読を張り直さずに最新の props や state を読むなら `useEffectEvent` へ出す (React docs `useEffectEvent`)                                                                                                                      |

- 6 の effect は、開発時の二重実行で利用者に見える結果が変わらないことを確かめる。変わったときの読み方は「開発時の二重実行が示すもの」
- 6 に当たる例: `src/components/ui/calendar.tsx` の focus、`src/components/ui/sidebar.tsx` の keydown の購読、取得の決着後の件数の通知 (ADR-0027)
