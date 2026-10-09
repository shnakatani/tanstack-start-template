---
paths:
  - "src/**"
---

# 実装ワークフロー

## useEffect の中で setState しない

lint (`react/set-state-in-effect`、`react/no-deriving-state-in-effects`) が止める。代替のうち lint が案内しないもの:

- 外部ストアの値を読む購読は `useSyncExternalStore`。lint では検出できないのでレビューで見る (`docs/guides/react/effects.md`「effect に書くかを判定する」)
- データ取得は TanStack Query で行い、loader が取得を待つのは、欠かせない query (主要な中身・タイトル・認可・リダイレクト・存在を決める) だけにする。書き方は `queryClient.query({ ...options, staleTime: "static" })` (既存の値を編集するダイアログの route は `staleTime: 0`。ADR-0041)。副次的な query まで待つと、遷移と SSR の応答がそれを待つ (ADR-0033)
- 副次的な query は loader で `void queryClient.query(...).catch(noop)` (`noop` は `@tanstack/react-query` の export) として流し、読む側を `<Suspense>` と Error Boundary で囲む。囲まないと、読み込み中と失敗がページ全体の pending 表示とエラー表示に置き換わる (ADR-0033)

## effect かイベントハンドラかを原因で決める

lint では見ないのでレビューで見る。

- 原因が特定の操作 (保存、送信、操作の開始と完了の通知、親への変化の通知) なら、effect ではなくイベントハンドラか mutation の callback に書く。effect に置くと、同じ表示に戻っただけで走る (`docs/guides/react/effects.md`「effect に書くかを判定する」)
- effect は、表示された結果を React の外の系 (DOM、ブラウザ API、外部 widget、イベントに応じて動く購読、router、announcer) に合わせるときだけ使う (`docs/guides/react/effects.md`「effect とイベントハンドラを分ける理由」)
- 開発時の二重実行で見える結果が変わったら、まず後始末を書く。後始末を書いても変わるときは、操作ならイベントハンドラへ、アプリの読み込みならコンポーネントの外へ移す (`docs/guides/react/effects.md`「開発時の二重実行が示すもの」)
- effect を 1 回しか走らせないための ref を書かない。1 回に抑えても、離れて戻ったときの後始末の欠けは残る。直前に反映した値を ref に持ち、同じなら何もしない形は、何度走っても同じ結果になるのでよい (`docs/guides/react/effects.md`「開発時の二重実行が示すもの」)
- router の外の変化 (認証など) の購読は router の `InnerWrap` の effect に置き、変化時に `router.invalidate()` を呼ぶ。ルートとページの effect は `errorComponent` の表示中に外れる (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)
- 遷移を契機にする副作用 (analytics、外部キャッシュの消去、描画後の DOM 操作) は `InnerWrap` のコンポーネントで `router.subscribe` に置く。ページの effect は他のページの間の遷移を見ない (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)
- `router.subscribe` を張る effect の中で、今のページにも 1 回その処理を行う。SSR で描いた最初のページでは `onResolved` が出ず、`onRendered` は購読より先に出る (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)
- そのページが出ている間だけ要る router との連携は、ページの effect で購読し、後始末で解除する。router の外の変化の購読と遷移を契機にする副作用を `InnerWrap` に置くのは、ページを離れても途切れてはいけないものに限る (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)

## Effect が読む最新値は useEffectEvent へ切り出す

Effect Event を呼ぶ場所と依存配列への混入は lint (`react/rules-of-hooks`、`react/exhaustive-deps`) が止める。次の 2 点はレビューで見る。

- 走ったときに最新の props / state を読めば足りる処理は `useEffectEvent` へ切り出し、依存から外す。依存に置くと、値が変わるたびに購読を外して張り直す (`docs/guides/react/effects.md`「依存に置く値と Effect Event で読む値」)
- 変わったら外の系に合わせ直す契機になる値は依存に置き、Effect Event に隠さない。隠すと、その値が変わっても effect が走らず、依存の漏れを lint も報告しない (`docs/guides/react/effects.md`「依存に置く値と Effect Event で読む値」)

## イベントハンドラは同期に保つ

lint (`typescript/no-misused-promises`) が止める。直し方 (`docs/guides/react/updates.md`「イベントハンドラを書く」):

- ハンドラは同期関数として宣言し、非同期処理はその内側の関数へ閉じる。JSX の prop に `void` やインラインの `async` を書かない
- 待たない判断は内側で 1 回だけ表明する。呼び先が失敗を自分で処理するなら `void`、呼び出し側で通知や後始末をするなら `.catch()`
- 操作の失敗を Error Boundary へ届けない。通知は toast (`src/components/ui/toast.tsx`) か画面内表示で行う。Error Boundary は画面ごと差し替わる (ADR-0016)
- 実例は `src/components/screens/route-error.tsx` の `handleRetry`。mutation を伴う操作は次節に従う

## ユーザー操作による更新は Transition の中で行う

lint では見ないのでレビューで見る (ADR-0015、Action 層と `useActionMutation` は ADR-0016、完了点とブロック範囲は ADR-0017)。

| 更新の種類                        | 書き方                                                                                                                                                                                                                                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mutation を伴う操作               | `src/components/action/` の部品に `action` を渡す。Action の中で `useActionMutation` の `runAction` を呼ぶ                                                                                                                                                                                                                    |
| mutation 成功後のダイアログ close | 閉じる時点は ADR-0017 の完了点の軸で選び、理由を実装近傍に書く。選択肢は ADR-0017                                                                                                                                                                                                                                             |
| ナビゲーション                    | Router に任せる。`startTransition` を自分で書かない (`docs/guides/react/updates.md`「ナビゲーションを Router に任せる」)                                                                                                                                                                                                      |
| Error Boundary からの再試行       | `router.invalidate()` だけを呼び、`startTransition` を自分で書かない。Query の error boundary は errorComponent の表示時の effect で `useQueryErrorResetBoundary().reset()` する。しないと loader が取得しない query の失敗が残り、再試行で回復しない (`docs/guides/data-loading.md`「読み込みに失敗した画面から再試行する」) |
| 制御コンポーネントの入力値        | 緊急更新のまま。Transition は割り込まれるので入力値の反映が遅れる                                                                                                                                                                                                                                                             |
| 検索条件の変更                    | URL の `navigate`。打鍵中は debounce した値を `useDeferredValue` に通して `useSuspenseQuery` の key にする (`docs/guides/lists-and-search.md`「検索の入力欄を組む」)                                                                                                                                                          |

- pending 表示は Action 層の `isPending` から取る。例外は項目の busy・楽観表示・close 阻止で、mutation の pending から取る (ADR-0017)
- mutation は `src/hooks/use-action-mutation.ts` の `useActionMutation` を通す。`onError` は型で必須。`runAction` が reject を吸収するので、無いと失敗が無通知になる (`docs/guides/react/updates.md`「mutation の書き方」)
- Action の reject は最寄りの Error Boundary へ届く。`runAction` を通さない Action は、失敗を Action の中で処理し切る (ADR-0016)
- `onSuccess` は再取得の Promise を返す。再取得完了前に close するなら、対象の項目にその pending から busy 表現を付ける (`docs/guides/react/updates.md`「完了点ごとに Transition を終える」)
- 止めるのは対象の項目だけにする。並行操作が整合を壊すときだけ全体を止め、理由を実装近傍に書く (ADR-0017)
- Action の中の `await` の後の state 更新は、上から順に当てる: サーバーの値は set せず query の再取得に任せる / Action の結果を state に持つなら `useActionState` / それ以外は set を `startTransition` で包む。`await` の後の更新は Transition にならず、Transition の中の Action は実行順も保証されない (`docs/guides/react/updates.md`「mutation の書き方」)
- `useOptimistic` に query の `data` と派生値を渡さない。query 由来の楽観表示と項目の busy は mutation の pending から取る (`docs/guides/react/updates.md`「楽観表示を出す」)
- mutation の pending は、1 件ずつなら `isPending && variables === id`、並行か別コンポーネントなら `mutationKey` + `useMutationState` で読む (`docs/guides/react/updates.md`「mutation の pending を読む」)
- `useMutationState` と `isMutating` の `filters` に `exact: true` を付ける。`variables` は `parseEach` (`src/lib/parse-each.ts`) で絞る (`docs/guides/react/updates.md`「mutation の pending を読む」)
- `useMutationState` の `select` の中で throw しない。描画中に走るので一覧ごと Error Boundary へ落ちる (`docs/guides/react/updates.md`「mutation の pending を読む」)
- 操作の開始の announce は `onMutate`、完了は `onSuccess` に書く (`src/lib/live-announcer.ts` の `announce()`、ADR-0026)
- 決着前の二重発火は Action 層の `isPending` (`aria-disabled`) が塞ぐ。閉包や ref のフラグを足さない (ADR-0016)

## ページは title と見出しを持つ

lint では見ないのでレビューで見る。

- ルートを足したら `head()` で `pageTitle(ctx, <ページ名>)` の title を持たせる。無いと親の title になり、遷移の読み上げでページを区別できない (ADR-0035)
- title は `pageTitle` を通し、文字列を直接書かない。直接書くと not found の画面でもそのページの名前になる (ADR-0035)
- ページの見出しは `PageHeader` の `h1` で持つ。遷移の後の focus は h1 へ移り、無いと body に落ちて利用者がページの先頭から探し直す (ADR-0035)

## 既存の値を編集するダイアログは子 route にする

lint では見ないのでレビューで見る。

- 既存の値を初期値にする編集のダイアログは、開く元のページの route の子 route にし、loader で `queryClient.query({ ...options, staleTime: 0 })` を `staleReloadMode: "blocking"` で待つ。キャッシュや前に取った値で開くと、別のタブや別の利用者の変更より古い値でフォームが始まる (ADR-0041)
- 1 件の query は一覧の query の先頭キーの下に置かない。保存後の一覧の invalidate が、閉じかけのダイアログの 1 件まで取り直す (ADR-0041)
- 1 件の query は `staleTime: Infinity` にし、開いている間は取り直さない。取り直すと、触れていないフォームは利用者の目の前で値が替わる (ADR-0041)
- ダイアログの route に `staticData: { dialogRoute: true }` を付ける。付けないと、閉じたあとリンクへ戻した focus を遷移の読み上げが見出しへ奪う (ADR-0035)
- ダイアログの route に `remountDeps: ({ params }) => params` を付ける。付けないと、開いたまま別の値の URL へ移ったとき、打ち始めたフォームが前の値のまま残り、移った先の値へ保存する (ADR-0041)
- 閉じる操作では `open` を false にするだけにし、route を離れるのは `onOpenChangeComplete` で行う。先に離れると閉じるアニメーションが出ない。例外は読み込み中のダイアログ (`pendingComponent`) で、閉じる操作の時点で離れる。アニメーションを待つ間に取得が終わると、本物のダイアログが開く (ADR-0041)
- `finalFocus` は、利用者が閉じたときだけでなく、戻る・進むで開いたまま unmount したときにも開いた行のリンクを返す。閉じる操作のときだけ返すと、戻るで一覧へ移ったときに focus が body に落ちる。ページとダイアログの行き来では、遷移の読み上げも見出しへ移さない (ADR-0041)
- `useMatchRoute` で pending を照合するとき、`params.parse` で変換した値を `params` に渡さない。URL の文字列と比べて一致しない。route だけで照合し、返った params を文字列で比べる (ADR-0041)
- 開くリンクに `preload={false}` を渡す。開くたびに取り直すので、preload は捨てる取得になる (ADR-0041)
- 操作中の行のリンクは `disabled` に `tabIndex={0}` を添える。`disabled` の Link は href を外して focus できなくなり、閉じたときに focus を戻せない (ADR-0041)

## 日付と日時の値は意味で分類して持つ

lint では見ないのでレビューで見る。

- 日付や日時の値を足すときは、瞬間、暦の日付、場所に結びつく日付・日時のどれかに分類し、分類の持ち方にする。取り違えると、日付が TZ で前後にずれる (ADR-0031)
- 暦の日付は `YYYY-MM-DD` の文字列で持ち、`Date` を経由しない。`toISOString()` も `new Date("YYYY-MM-DD")` も UTC を挟み、1 日ずれる (`docs/guides/dates-and-time-zones.md`「日付の入力を扱う」)
- 暦の日付の列には `CHECK (<列> IS date(<列>) AND length(<列>) = 10)` を付ける。入力スキーマの検証は、それを通らない書き込み (手書きの SQL など) に効かない (`docs/guides/dates-and-time-zones.md`「日付の入力を扱う」)
- 場所に結びつく日付・日時は、TZ が 1 つでも IANA の TZ 名を列に持ち、オフセットでは持たない。値だけで意味が決まり、TZ の定義の変更に追従する (ADR-0031)
- 「今日」や期限を判定するときは、どの TZ の今日かを明示する (今は `APP_TIME_ZONE`)。明示しないと、サーバーとブラウザで判定が割れる (ADR-0031)
- Calendar が見せる今日はブラウザの TZ に任せ、Calendar はサーバーで描かない。初めに閉じていて `keepMounted` を付けない Popover の中に置くか、`<ClientOnly>` で囲む。サーバーで描くと、サーバーの TZ の今日が hydration の後も残る (ADR-0031)

## 日時はタイムゾーンを明示して整形する

lint では見ないのでレビューで見る。

- 画面に出す日時は `formatDateTime` (`src/lib/format-date-time.ts`) で整形する。ローカル TZ で整形すると、サーバーとブラウザの TZ が違う環境でだけ hydration mismatch になる (`docs/guides/dates-and-time-zones.md`「タイムゾーンを明示して整形する理由」)
- 描画する値に `toLocaleString` 系・`getHours` 系・`timeZone` なしの `Intl.DateTimeFormat` を使わない。どれも実行環境のローカル TZ で組む (`docs/guides/dates-and-time-zones.md`「画面に日時を出す」)
- 並びや区切りを得るために、画面の言語と違うロケール (`sv-SE` など) を指定しない。表示言語でないロケールのデータに依存し、その並びも保証されない。並びはオプションで選び、無い並びは `formatToParts()` で組む (`docs/guides/dates-and-time-zones.md`「書式をロケールに任せる理由」)
- 瞬間 (ADR-0031) を date-fns で整形するときは `in: tz(APP_TIME_ZONE)` を渡すか値を `TZDate` にし、`@date-fns/tz` を直接の依存に足す。渡さないとシステムの TZ で計算する (`docs/guides/dates-and-time-zones.md`「画面に日時を出す」)
- 暦の日付 (ADR-0031) の変換は `src/lib/calendar-date.ts`、表示は `src/lib/format-calendar-date-label.ts` の関数を通す。`YYYY-MM-DD` とローカルの 0 時の `Date` を往復させるので、TZ に依存しない (`docs/guides/dates-and-time-zones.md`「画面に暦の日付を出す」)
- 食い違いを `suppressHydrationWarning` で抑えない。食い違った文字列がそのまま出る (`docs/guides/dates-and-time-zones.md`「タイムゾーンを明示して整形する理由」)

## 依存はバレルから引かない

- 依存を import するときは、個別エントリポイント (`exports` のサブパス) があればそちらから引く。バレルは使わない周辺まで読み込み、テストの実行時間を伸ばす。lint が止めるのは `RESTRICTED_BARREL_IMPORTS` に名指しした依存だけ (ADR-0032)

## メモ化と React Compiler

`src/components/ui/` は ADR-0020 の統制下なので触らない。

- 新しいコードで `useMemo` / `useCallback` を予防的に書かない。手で書くのは、性能の問題が実際に出た箇所と、effect の依存のように値の同一性を精密に制御する箇所だけ。ほかは Compiler がメモ化する (`docs/guides/react/memoization.md`「手動メモ化を書く」)
- `react-compiler(Todo)` の診断を消すためにコードを書き換えない。Compiler の未対応の構文で、コードの誤りではない。手を入れるのは、その関数で性能の問題が実際に出たときに限る (`docs/guides/react/memoization.md`「React Compiler の診断を読む」)
- effect の依存は、まず関数や object を effect の中へ移すか `useEffectEvent` へ切り出して依存から外し、外せないときだけ最後の手段としてメモ化する。`useMemo` は値が保たれることを保証せず、React がキャッシュを捨てると effect が走り直す (`docs/guides/react/memoization.md`「effect の依存をメモ化より先に外す理由」)
- キャッシュが捨てられると壊れる値は `useMemo` に持たず、state か ref に持つ。React は `useMemo` のキャッシュを捨てうる (`docs/guides/react/memoization.md`「手動メモ化を書く」)
- Compiler の自動メモ化にも正しさを頼らず、再計算や effect の再実行が増えても結果が正しいように書く。Compiler が諦めた部品と、`"use no memo"` で外した部品はメモ化されない (`docs/guides/react/memoization.md`「手動メモ化を書く」)
- 既存の `useMemo` / `useCallback` は、撤去の前後でコンパイル出力が悪化しないことを測れた箇所だけ外す。外形からは劣化が読み取れない (`docs/guides/react/memoization.md`「手動メモ化を外すか判定する」)

## コンポーネントは function 宣言で定義する

- トップレベルのコンポーネントとコンポーネント内の名前付きヘルパーは `function` 宣言で書く。関数の型を丸ごと注釈するヘルパーだけ arrow の `const` にする (`docs/guides/react/components.md`「コンポーネントを定義する」)
- その場で prop や引数に渡すコールバック (`onClick` の中身、`map` の引数など) は arrow で書く (`docs/guides/react/components.md`「コンポーネントを定義する」)
- shadcn 生成コード (`src/components/ui/`) は生成された形のまま置き、この節に合わせて書き換えない (ADR-0020)

## Item は Group の中に置く

lint では見ないのでレビューで見る。

- Group を持つ部品の項目は content の直下に置かず、対応する Group の中に置く。`SelectItem` / `SelectLabel` は `SelectGroup`、`DropdownMenuItem` / `DropdownMenuLabel` / `DropdownMenuSub` は `DropdownMenuGroup` に入れる (`docs/guides/registry.md`「項目を Group の中に置く」)

## lint の抑制

- 行単位の抑制 (`oxlint-disable-next-line`) は違反が報告される行の直前に置く。`.map()` の行に置いても `key` の行には効かない (`docs/guides/lint/configuration.md`「行単位で抑制する」)
- `no-await-in-loop` は順序依存のループにも鳴る。逐次でないと壊れるループは `Promise.all` へ倒さず、抑制して順序が要る理由を書く (`docs/guides/lint/configuration.md`「行単位で抑制する」)
