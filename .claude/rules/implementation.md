---
paths:
  - "src/**"
---

# 実装ワークフロー

## useEffect の中で setState しない

lint (`react/set-state-in-effect`、`react/no-deriving-state-in-effects`) が止める。代替のうち lint が案内しないもの:

- 外部ストアへの購読は `useSyncExternalStore`。lint では検出できないのでレビューで見る
- データ取得は TanStack Query で行い、loader が取得を待つのは、欠かせない query (主要な中身・タイトル・認可・リダイレクト・存在を決める) だけにする。書き方は `queryClient.query({ ...options, staleTime: "static" })`。副次的な query まで待つと、遷移と SSR の応答がそれを待つ (ADR-0033)
- 副次的な query は loader で `void queryClient.query(...).catch(noop)` (`noop` は `@tanstack/react-query` の export) として流し、読む側を `<Suspense>` と Error Boundary で囲む。囲まないと、読み込み中と失敗がページ全体の pending 表示とエラー表示に置き換わる (ADR-0033)

## effect かイベントハンドラかを原因で決める

lint では見ないのでレビューで見る。

- 原因が特定の操作 (保存、送信、操作の開始と完了の通知、親への変化の通知) なら、effect ではなくイベントハンドラか mutation の callback に書く。effect に置くと、同じ表示に戻っただけで走る (`docs/guides/react/effects.md`「effect に書くかを判定する」)
- effect は、表示された結果を React の外の系 (DOM、ブラウザ API、外部 widget、イベントに応じて動く購読、router、announcer) に合わせるときだけ使う。要らない effect はコードを追いにくく、誤りやすくする (`docs/guides/react/effects.md`「effect とイベントハンドラを分ける理由」)
- 開発時の二重実行で見える結果が変わったら、まず後始末を書く。多くは後始末の欠けで、effect が正しい置き場のまま直る。後始末を書いても変わるときは、操作ならイベントハンドラへ、アプリの読み込みならコンポーネントの外へ移す (`docs/guides/react/effects.md`「開発時の二重実行が示すもの」)
- effect を 1 回しか走らせないための ref を書かない。1 回に抑えても、離れて戻ったときの後始末の欠けは残る。直前に反映した値を ref に持ち、同じなら何もしない形は、何度走っても同じ結果になるのでよい (`docs/guides/react/effects.md`「開発時の二重実行が示すもの」)
- router の外の変化 (認証など) の購読は router の `InnerWrap` の effect に置き、変化時に `router.invalidate()` を呼ぶ。ルートとページの effect は `errorComponent` の表示中に外れる (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)
- 遷移を契機にする副作用 (analytics、外部キャッシュの消去、描画後の DOM 操作) は `InnerWrap` のコンポーネントで `router.subscribe` に置く。ページの effect は他のページの間の遷移を見ない (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)
- `router.subscribe` を張る effect の中で、今のページにも 1 回その処理を行う。SSR で描いた最初のページでは `onResolved` が出ず、`onRendered` は購読より先に出る (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)
- そのページが出ている間だけ要る router との連携は、ページの effect で購読し、後始末で解除する。上の 2 つはページを離れても途切れてはいけない副作用に限る (`docs/guides/react/effects.md`「router との間の副作用の置き場所」)

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

| 更新の種類                        | 書き方                                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mutation を伴う操作               | `src/components/action/` の部品に `action` を渡す。Action の中で `useActionMutation` の `runAction` を呼ぶ                                                           |
| mutation 成功後のダイアログ close | 閉じる時点は ADR-0017 の完了点の軸で選び、理由を実装近傍に書く。選択肢は ADR-0017                                                                                    |
| ナビゲーション                    | Router に任せる。`startTransition` を自分で書かない                                                                                                                  |
| Error Boundary の reset と再読込  | 前節の `handleRetry` の形のまま。`router.invalidate()` の描画は Router が Transition 化する                                                                          |
| 制御コンポーネントの入力値        | 緊急更新のまま。Transition は割り込まれるので入力値の反映が遅れる                                                                                                    |
| 検索条件の変更                    | URL の `navigate`。打鍵中は debounce した値を `useDeferredValue` に通して `useSuspenseQuery` の key にする (`docs/guides/lists-and-search.md`「検索の入力欄を組む」) |

- pending 表示は Action 層の `isPending` から取る。例外は項目の busy・楽観表示・close 阻止で、mutation の pending から取る (ADR-0017)
- mutation は `src/hooks/use-action-mutation.ts` の `useActionMutation` を通す。`onError` は型で必須。`runAction` が reject を吸収するので、無いと失敗が無通知になる (`docs/guides/react/updates.md`「mutation の書き方」)
- Action の reject は最寄りの Error Boundary へ届く。`runAction` を通さない Action は、失敗を Action の中で処理し切る (ADR-0016)
- `onSuccess` は再取得の Promise を返す。再取得完了前に close するなら、対象の項目にその pending から busy 表現を付ける (`docs/guides/react/updates.md`「完了点ごとに Transition を終える」)
- 止めるのは対象の項目だけにする。並行操作が整合を壊すときだけ全体を止め、理由を実装近傍に書く (ADR-0017)
- Action の中で `await` の後に `setState` を書かない。Transition から外れる。画面の更新は query の再取得に任せる (`docs/guides/react/updates.md`「mutation の書き方」)
- `useOptimistic` に query の `data` と派生値を渡さない。query 由来の楽観表示と項目の busy は mutation の pending から取る (`docs/guides/react/updates.md`「楽観表示を出す」)
- mutation の pending は、1 件ずつなら `isPending && variables === id`、並行か別コンポーネントなら `mutationKey` + `useMutationState` で読む (`docs/guides/react/updates.md`「mutation の pending を読む」)
- `useMutationState` と `isMutating` の `filters` に `exact: true` を付ける。`variables` は `parseEach` (`src/lib/parse-each.ts`) で絞る (`docs/guides/react/updates.md`「mutation の pending を読む」)
- `useMutationState` の `select` の中で throw しない。描画中に走るので一覧ごと Error Boundary へ落ちる (`docs/guides/react/updates.md`「mutation の pending を読む」)
- 操作の開始の announce は `onMutate`、完了は `onSuccess` に書く (`src/lib/live-announcer.ts` の `announce()`、ADR-0026)
- 決着前の二重発火は Action 層の `isPending` (`aria-disabled`) が塞ぐ。閉包や ref のフラグを足さない (ADR-0016)

## 日付と日時の値は意味で分類して持つ

lint では見ないのでレビューで見る。

- 日付や日時の値を足すときは、瞬間・暦の日付・場所に結びつく値のどれかに分類し、分類の持ち方にする。取り違えると、日付が TZ で前後にずれる (ADR-0031)
- 暦の日付は `YYYY-MM-DD` の文字列で持ち、`Date` を経由しない。`toISOString()` も `new Date("YYYY-MM-DD")` も UTC を挟み、1 日ずれる (`docs/guides/dates-and-time-zones.md`「日付の入力を扱う」)
- 暦の日付の列には `CHECK (<列> IS date(<列>) AND length(<列>) = 10)` を付ける。入力スキーマの検証は、それを通らない書き込み (手書きの SQL など) に効かない (`docs/guides/dates-and-time-zones.md`「日付の入力を扱う」)
- 場所に結びつく値は、TZ が 1 つでも IANA の TZ 名を列に持ち、オフセットでは持たない。値だけで意味が決まり、TZ の定義の変更に追従する (ADR-0031)
- 「今日」や期限を判定するときは、どの TZ の今日かを明示する (今は `APP_TIME_ZONE`)。明示しないと、サーバーとブラウザで判定が割れる (ADR-0031)
- Calendar が見せる今日はブラウザの TZ に任せ、Calendar はサーバーで描かない。初めに閉じていて `keepMounted` を付けない Popover の中に置くか、`<ClientOnly>` で囲む。サーバーで描くと、サーバーの TZ の今日が hydration の後も残る (ADR-0031)

## 日時はタイムゾーンを明示して整形する

lint では見ないのでレビューで見る。

- 画面に出す日時は `formatDateTime` (`src/lib/format-date-time.ts`) で整形する。ローカル TZ で整形すると、サーバーとブラウザの TZ が違う環境でだけ hydration mismatch になる (`docs/guides/dates-and-time-zones.md`「タイムゾーンを明示して整形する理由」)
- 描画する値に `toLocaleString` 系・`getHours` 系・`timeZone` なしの `Intl.DateTimeFormat` を使わない。どれも実行環境のローカル TZ で組む (`docs/guides/dates-and-time-zones.md`「画面に日時を出す」)
- 並びや区切りを得るために、画面の言語と違うロケール (`sv-SE` など) を指定しない。表示言語でないロケールのデータに依存し、その並びも保証されない。並びはオプションで選び、無い並びは `formatToParts()` で組む (`docs/guides/dates-and-time-zones.md`「書式をロケールに任せる理由」)
- 瞬間 (ADR-0031 の分類 1) を date-fns で整形するときは `in: tz(APP_TIME_ZONE)` を渡すか値を `TZDate` にし、`@date-fns/tz` を直接の依存に足す。渡さないとシステムの TZ で計算する (`docs/guides/dates-and-time-zones.md`「画面に日時を出す」)
- 暦の日付 (ADR-0031 の分類 2) の変換は `src/lib/calendar-date.ts`、表示は `src/lib/format-calendar-date-label.ts` の関数を通す。`YYYY-MM-DD` とローカルの 0 時の `Date` を往復させるので、TZ に依存しない (`docs/guides/dates-and-time-zones.md`「画面に暦の日付を出す」)
- 食い違いを `suppressHydrationWarning` で抑えない。食い違った文字列がそのまま出る (`docs/guides/dates-and-time-zones.md`「タイムゾーンを明示して整形する理由」)

## 依存はバレルから引かない

- 依存を import するときは、個別エントリポイント (`exports` のサブパス) があればそちらから引く。バレルは使わない周辺まで読み込み、テストの実行時間を伸ばす。lint が止めるのは `RESTRICTED_BARREL_IMPORTS` に名指しした依存だけ (ADR-0032)

## 手動メモ化の増減

`useMemo` / `useCallback` は足すのも外すのも実測してから。判定手順は `docs/guides/react/memoization.md`「手動メモ化を外すか判定する」。`src/components/ui/` は ADR-0020 の統制下なので触らない。

## コンポーネントは function 宣言で定義する

- トップレベルのコンポーネントとコンポーネント内の名前付きヘルパーは `function` 宣言で書く。型注釈が要るヘルパーだけ arrow const
- インラインのコールバック (`onClick` の中身など) は arrow で書く。shadcn 生成コード (`src/components/ui/`) は生成された形のまま置く

Why: 巻き上げでページ本体を上、ヘルパーを下に置ける。`.tsx` で generics を `<T,>` ハックなしに書ける。

## Item は Group の中に置く

`SelectItem` / `DropdownMenuItem` を `SelectContent` / `DropdownMenuContent` の直下に置かない (shadcn skill の `rules/composition.md`)。機械強制は無いのでレビューで見る。

## lint の抑制

- 行単位の抑制 (`oxlint-disable-next-line`) は違反が報告される行の直前に置く。`.map()` の行に置いても `key` の行には効かない (`docs/guides/lint/configuration.md`「行単位で抑制する」)
- `no-await-in-loop` は順序依存のループにも鳴る。逐次でないと壊れるループは `Promise.all` へ倒さず、抑制して順序が要る理由を書く (`docs/guides/lint/configuration.md`「行単位で抑制する」)

## dead code を発見したら即決 3 択

1. **削除** (呼び出し元なし)
2. **同等修正** (呼ばれている)
3. **スコープ外** → 別 PR へ切り出す

削除の前に git blame で導入コミットを確認する。行単位で「効かない」だけを根拠に消すと、別実装で置き換えるべき意図を落とす。

## 技術選択は plan 提示 → 反応待ち

3 案以上の技術選択や DB スキーマ変更を伴う判断は plan を提示してユーザーの反応を待つ。
