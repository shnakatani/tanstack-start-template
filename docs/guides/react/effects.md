# effect

コードを effect に書くかイベントハンドラに書くかを決めるときの手順と、その判定の理由を持つ。

| 決定                                                                                                                              | ADR      |
| --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 状態の通知は常時 mount の live region に集約し、項目の状態は静的テキストと `aria-disabled` で持つ                                 | ADR-0026 |
| ページは URL の変化で作り直さず、取得結果の入れ替わりはページの effect が取得の決着で通知し、直前に通知した条件と同じなら出さない | ADR-0027 |
| ページのデータは Query から読み、欠かせない query だけを loader で待ち、副次的な query は待たずに Suspense の中で読む             | ADR-0033 |

## explanation

### effect とイベントハンドラを分ける理由

コードを effect に書くかイベントハンドラに書くかは、そのコードが走る原因で決まる。[React docs「Separating Events from Effects」][] は、迷ったら "consider _why_ the code needs to run" とする。

| 原因                                            | 置き場                                                                                          | React docs の出典                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 特定の操作 (押した、送った)                     | イベントハンドラ。mutation を伴うなら mutation の callback (`onMutate` / `onSuccess`、ADR-0026) | [React docs「Separating Events from Effects」][] の "Event handlers run in response to specific interactions."                   |
| 表示されたこと (React の外の系を表示に合わせる) | effect                                                                                          | [React docs「Separating Events from Effects」][] の "Effects run whenever synchronization is needed."                            |
| 他の props や state (外の系が無い)              | 描画中に計算する                                                                                | [React docs「You Might Not Need an Effect」][] の "If there is no external system involved (...), you shouldn't need an Effect." |

- 操作が原因のコードを effect に置くと、同じ表示に戻っただけで走る。[React docs「Synchronizing with Effects」][] の「Not an Effect: Buying a product」の例では、購入の POST を effect に置くと、別のページから戻ったときにも購入が走る ("Buying is not caused by rendering; it's caused by a specific interaction.")
- React の外の系には、DOM とブラウザ API、外部 widget、イベントに応じて動く購読 (値を読む購読は `useSyncExternalStore`)、router、announcer の live region が入る。[React docs「Synchronizing with Effects」][] は例として、React でない widget の制御、サーバーへの接続、analytics の送信を挙げる
- 取得結果の件数の通知 (ADR-0027) は、打鍵が契機に見えても原因は表示である。結果の入れ替わりは確定・戻る・進む・Link のどれでも起き、取得の決着は描画の側でしか分からない

### 開発時の二重実行が示すもの

Strict Mode は開発時に、mount の直後に 1 回だけ unmount と mount をやり直す ([React docs「Synchronizing with Effects」][] の「Development-only behaviors」の "React remounts every component once after mount")。effect は setup → cleanup → setup の順に走る。
このとき利用者に見える結果が変わるかで、effect の書き方の誤りを見分けられる。

| 二重実行で見える結果                   | 読み方                                                                                                                                                                                                        | React docs の出典                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 変わらない                             | そのままでよい                                                                                                                                                                                                | [React docs「Synchronizing with Effects」][] の「Sending analytics」の "We recommend keeping this code as is."                                                                                                                                                            |
| 変わるが、後始末を書けば変わらなくなる | 後始末が足りない。effect のまま、effect がしたことを止めるか戻す後始末を書く                                                                                                                                  | [React docs「Synchronizing with Effects」][] の「How to handle the Effect firing twice in development?」の "Usually, the answer is to implement the cleanup function."                                                                                                    |
| 後始末を書いても変わる                 | 原因は描画ではない。特定の操作ならイベントハンドラへ、アプリの読み込みならコンポーネントの外へ移す (「effect に書くかを判定する」の「特定の操作が原因」の行と「アプリの読み込みごとに 1 回だけ走る処理」の行) | [React docs「Synchronizing with Effects」][] の「Not an Effect: Buying a product」の "Sometimes, even if you write a cleanup function, there's no way to prevent user-visible consequences of running the Effect twice."、「Not an Effect: Initializing the application」 |

- effect を 1 回しか走らせないための ref は書かない。再 mount の後にも正しく動く必要があり、1 回に抑えても直らない ([React docs「Synchronizing with Effects」][] の Pitfall「Don't use refs to prevent Effects from firing」の "To fix the bug, it is not enough to just make the Effect run once.")
- ref で直前に反映した値を持ち、外の系がその値をすでに反映していれば何もしない形は、これと別物である。effect は何度走っても同じ結果になる (ADR-0027 の件数の通知)

### 依存に置く値と Effect Event で読む値

effect が読む値は、変わったら外の系に合わせ直す契機になる値と、走ったときに最新の値を読めば足りる値に分かれる。後者を読む処理は Effect Event (`useEffectEvent`) に切り出す。[React docs「Separating Events from Effects」][] の「Extracting non-reactive logic out of Effects」は、Effect Event の中の処理を "not reactive, and it always "sees" the latest values of your props and state." とする。

| 値の役割                               | 置き場                  | React docs の出典                                                                                                                                                                                                                           |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 変わったら外の系に合わせ直す契機になる | 依存配列                | [React docs「useEffectEvent」][] の Pitfall「Don't use Effect Events to skip dependencies」の "If a value should cause your Effect to re-run, keep it as a dependency."                                                                     |
| 走ったときに最新の値を読めば足りる     | Effect Event の中で読む | [React docs「useEffectEvent」][] の「Using an event listener with latest values」の "Without `useEffectEvent`, you would need to include the values in your dependencies, causing the listener to be removed and re-added on every change." |

- 契機になる値を Effect Event に隠すと、その値が変わっても effect が走らず、外の系が古い値のまま残る。依存の漏れは lint (`react/exhaustive-deps`) も報告しない (2026-09-28、oxlint 1.82.0 で確認)。[React docs「useEffectEvent」][] の Pitfall「Don't use Effect Events to skip dependencies」の例では、`pageUrl` を Effect Event に隠すと、ページが変わってもログが出ない ("Missing pageUrl means you miss logs")。[React docs「useEffectEvent」][] の Caveats も "Do not use `useEffectEvent` to avoid specifying dependencies in your Effect's dependency array. This hides bugs and makes your code harder to understand." とする
- 例: `src/components/ui/sidebar.tsx` の keydown の購読は、ショートカットで呼ぶ `toggleSidebar` を Effect Event の中で読み、listener を張り直さない。`src/components/ui/calendar.tsx` の日付ボタンの effect は、`modifiers.focused` が focus を移す契機なので依存に置く
- Effect Event を Effect と Effect Event の外で呼ぶことと、依存配列に入れることは、lint (`react/rules-of-hooks`、`react/exhaustive-deps`) が止める (2026-09-28、oxlint 1.82.0 で確認)。[React docs「useEffectEvent」][] が強制を保証するのは eslint-plugin-react-hooks で、Caveats の "Effect Events can only be called from inside Effects or other Effect Events." に当たる

### router との間の副作用の置き場所

router との間の副作用は、契機が router の外の変化か、router の遷移かで置き場所が分かれる。

| 契機                                                               | 置き場                                                                                                                           | TanStack Router docs の出典                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| router の外の変化 (認証の状態など)                                 | `createRouter` の `InnerWrap` に渡すコンポーネントの effect で外の系を購読し、変化の callback で `router.invalidate()` を呼ぶ    | [TanStack Router docs「Router Context」][] の「Invalidating the Router Context」の例は、購読の effect と `router.invalidate()` を `useAuth` という hook にまとめる。その hook を呼べる場所は [TanStack Router docs「RouterOptions」][] の「`InnerWrap` property」の "useful for providing a context to the inner contents of the router where you also need access to the router context and hooks" |
| 利用者の操作 (Error Boundary からの再試行)                         | イベントハンドラの中で `router.invalidate()` を呼ぶ (「effect に書くかを判定する」の「特定の操作が原因」の行)                    | [TanStack Router docs「Data Loading」][] の「Handling Errors with `routeOptions.errorComponent`」の "If the error was the result of a route load, you should instead call `router.invalidate()`, which will coordinate both a router reload and an error boundary reset"                                                                                                                            |
| router の遷移 (analytics、外部キャッシュの消去、描画後の DOM 操作) | `InnerWrap` のコンポーネントで `router.subscribe` のイベントに置く。完了後の処理は `onResolved`、DOM に触れる処理は `onRendered` | [TanStack Router docs「Router Events」][] の "`router.subscribe` is best for imperative integrations that need to observe navigation without driving rendering" と "Use `onResolved` for analytics and cleanup after navigation finishes"                                                                                                                                                           |

- `InnerWrap` は root route の error boundary の外側にある。root の `errorComponent` に置き換わっても `InnerWrap` の effect は後始末されず、root route のコンポーネントの effect は後始末される (2026-09-28、@tanstack/react-router 1.170.32 のブラウザテストで確認)。TanStack Start では `RouterProvider` を描くのはフレームワークで、client entry を書いても `<StartClient />` を包むだけになり、router の hooks が使えない ([TanStack Start docs「Client Entry Point」][] の "If not provided, TanStack Start will automatically handle the client entry point for you")。router の hooks が使え、root route の外にある置き場は `InnerWrap` になる。`InnerWrap` は DOM を描かないコンポーネントにする ([TanStack Router docs「RouterOptions」][] の「`InnerWrap` property」の "Only non-DOM-rendering components like providers should be used, anything else will cause a hydration error.")
- ページのコンポーネントの effect に置くと、購読はそのページが描画されている間しか続かない。`errorComponent` が出ている間は境界より下が描画されず ([React docs「Component」][] の「Catching rendering errors with an Error Boundary」の "display some fallback UI instead of the part that crashed")、別のページへ移れば unmount される。ページの effect は mount と依存の変化で走るだけで、他のページの間の遷移は見ない
- そのページが出ている間だけ要る連携は、ページの effect で購読してよい。表の「router の外の変化」の行と「router の遷移」の行は、ページの外でも途切れてはいけない副作用の置き場である
- SSR で描いた最初のページでは、`onResolved` を待っても来ない。hydration では読み込みが走らないためで、上流のメンテナも "there is no load happening upon hydration" と答えている ([TanStack/router#3810][]「hydrate doesn't emit events initially」)。`onRendered` は最初のページでも出るが、`InnerWrap` の effect より先に出るので購読が間に合わない (2026-09-28、1.170.32 の [`@tanstack/react-router` の `Transitioner.tsx`][] で確認。実行はしていない)。最初のページも数える処理は、購読を張る effect の中で今のページに対して 1 回行う。この effect は最初のページが DOM に入った後に走る
- 遷移の状態を画面に出すなら、購読ではなく `useRouterState` などの hook で読む ([TanStack Router docs「Router Events」][] の "If you need reactive UI updates, prefer framework hooks like `useRouterState`, `useSearch`, and `useParams` instead of subscribing manually.")
- `router.subscribe` をコンポーネントの effect の中で呼ぶなら、返り値の解除関数を後始末で返す ([TanStack Router docs「Router Events」][] の "always return the unsubscribe function from your cleanup so the listener is removed when the component unmounts.")

## how-to

### effect に書くかを判定する

上の行から順に当て、最初に当たった行の書き方にする。理由は「effect とイベントハンドラを分ける理由」が持つ。

| 順  | 当てはまるもの                                                          | 書き方                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 特定の操作が原因 (保存、送信、操作の開始と完了の通知、親への変化の通知) | イベントハンドラ (`docs/guides/react/updates.md`「イベントハンドラを書く」)。mutation の開始と完了の通知は `onMutate` / `onSuccess` に書く (ADR-0026)。親への変化の通知も、変化を起こしたハンドラの中で呼ぶ ([React docs「You Might Not Need an Effect」][] の「Notifying parent components about state changes」)                                                                                                                                                                                         |
| 2   | 他の props や state から決まる値 (state の更新が連鎖するものを含む)     | 描画中に計算する。prop が変わったら state を揃えるなら、まず `key` で作り直すか描画中の計算で済むかを確かめ、済まないときだけ描画中に更新する。state の更新が連鎖するなら、計算できるものは描画中に、残りは起点のイベントハンドラでまとめて更新する。前の選択でネットワークから次の選択肢を取るような連鎖は「データ取得」の行に当たる ([React docs「You Might Not Need an Effect」][] の「Resetting all state when a prop changes」「Adjusting some state when a prop changes」「Chains of computations」) |
| 3   | アプリの読み込みごとに 1 回だけ走る処理                                 | コンポーネントの外、アプリのエントリかルートのモジュールの最上位で走らせる。サーバーでも読まれるモジュールなら、ブラウザでだけ走らせる条件を付ける。effect の中に書くなら、モジュールの変数を見て読み込みごとに 1 回に抑える ([React docs「You Might Not Need an Effect」][] の「Initializing the application」)                                                                                                                                                                                           |
| 4   | 外部ストアの値を読む                                                    | `useSyncExternalStore`。effect で購読して state へ写さない ([React docs「You Might Not Need an Effect」][] の「Subscribing to an external store」の "Although it's common to use Effects for this, React has a purpose-built Hook for subscribing to an external store that is preferred instead.")                                                                                                                                                                                                        |
| 5   | データ取得                                                              | TanStack Query (ADR-0033)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 6   | 表示された結果を React の外の系に合わせる                               | effect。止めるか戻すものがあれば後始末を返す。購読を張り直さずに最新の props や state を読むなら `useEffectEvent` へ出す (「依存に置く値と Effect Event で読む値」)                                                                                                                                                                                                                                                                                                                                        |

- 「表示された結果を React の外の系に合わせる」の行の effect は、開発時の二重実行で利用者に見える結果が変わらないことを確かめる。変わったときの読み方は「開発時の二重実行が示すもの」
- その行に当たる例: `src/components/ui/calendar.tsx` の focus、`src/components/ui/sidebar.tsx` の keydown の購読、取得の決着後の件数の通知 (ADR-0027)

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。「effect に書くかを判定する」の 4 の行が引く [React docs「You Might Not Need an Effect」][] の文は、2026-10-06 に原文と照らした。

[React docs「Separating Events from Effects」]: https://react.dev/learn/separating-events-from-effects
[React docs「You Might Not Need an Effect」]: https://react.dev/learn/you-might-not-need-an-effect
[React docs「Synchronizing with Effects」]: https://react.dev/learn/synchronizing-with-effects
[React docs「useEffectEvent」]: https://react.dev/reference/react/useEffectEvent
[TanStack Router docs「Router Context」]: https://tanstack.com/router/latest/docs/guide/router-context
[TanStack Router docs「RouterOptions」]: https://tanstack.com/router/latest/docs/api/router/RouterOptionsType
[TanStack Router docs「Data Loading」]: https://tanstack.com/router/latest/docs/guide/data-loading
[TanStack Router docs「Router Events」]: https://tanstack.com/router/latest/docs/guide/router-events
[TanStack Start docs「Client Entry Point」]: https://tanstack.com/start/latest/docs/framework/react/guide/client-entry-point
[React docs「Component」]: https://react.dev/reference/react/Component
[TanStack/router#3810]: https://github.com/TanStack/router/issues/3810
[`@tanstack/react-router` の `Transitioner.tsx`]: https://github.com/TanStack/router/blob/@tanstack/react-router@1.170.32/packages/react-router/src/Transitioner.tsx
