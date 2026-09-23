---
paths:
  - "src/**"
---

# 実装ワークフロー

## useEffect の中で setState しない

lint (`react/set-state-in-effect`、`react/no-deriving-state-in-effects`) が止める。代替のうち lint が案内しないもの:

- 外部ストアへの購読は `useSyncExternalStore`。lint では検出できないのでレビューで見る
- データ取得は TanStack Query。route loader で `queryClient.query({ ...options, staleTime: "static" })` を温め、`useSuspenseQuery` で読む (`src/routes/notes/index.tsx`)
- useEffect が正当なのは DOM 副作用 (focus / scroll / 外部 widget 初期化) と、router へ変化を伝える副作用 (`router.invalidate()` 等) だけ
- router へ伝える副作用は、mount 中だけ成立すれば足りるなら effect、画面遷移中や `errorComponent` 表示中も要るなら router 層で購読する

## Effect が読む最新値は useEffectEvent へ切り出す

lint では見ないのでレビューで見る。

- 購読を張り直さずに最新の props / state を読む箇所は `useEffectEvent` へ切り出し、依存から外す (`src/components/ui/sidebar.tsx` の keydown 購読)
- 依存配列を埋める逃げ道に使わない。再実行の契機そのものである値を隠すとバグが見えなくなる (`calendar.tsx` の `modifiers.focused`)
- Effect Event は Effect か他の Effect Event の中からしか呼ばない。ハンドラ・レンダー中・他コンポーネントへの受け渡し・依存配列は不可

## イベントハンドラは同期に保つ

lint (`typescript/no-misused-promises`) が止める。直し方 (`docs/guides/updates-and-data.md`「イベントハンドラを書く」):

- ハンドラは同期関数として宣言し、非同期処理はその内側の関数へ閉じる。JSX の prop に `void` やインラインの `async` を書かない
- 待たない判断は内側で 1 回だけ表明する。呼び先が失敗を自分で処理するなら `void`、呼び出し側で通知や後始末をするなら `.catch()`
- 操作の失敗を Error Boundary へ届けない。通知は toast (`src/components/ui/toast.tsx`) か画面内表示で行う。Error Boundary は画面ごと差し替わる (ADR-0016)
- 実例は `src/components/screens/route-error.tsx` の `handleRetry`。mutation を伴う操作は次節に従う

## ユーザー操作による更新は Transition の中で行う

lint では見ないのでレビューで見る (ADR-0015、Action 層と `useActionMutation` は ADR-0016、完了点とブロック範囲は ADR-0017)。

| 更新の種類                        | 書き方                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mutation を伴う操作               | `src/components/action/` の部品に `action` を渡す。Action の中で `useActionMutation` の `runAction` を呼ぶ                                                                             |
| mutation 成功後のダイアログ close | 閉じる時点は ADR-0017 の完了点の軸で選び、理由を実装近傍に書く。選択肢は ADR-0017                                                                                                      |
| ナビゲーション                    | Router に任せる。`startTransition` を自分で書かない                                                                                                                                    |
| Error Boundary の reset と再読込  | 前節の `handleRetry` の形のまま。`router.invalidate()` の描画は Router が Transition 化する                                                                                            |
| 制御コンポーネントの入力値        | 緊急更新のまま。Transition は割り込まれるので入力値の反映が遅れる                                                                                                                      |
| 検索条件の変更                    | URL の `navigate`。打鍵中は debounce した値を `useDeferredValue` に通して `useSuspenseQuery` の key にする (`notes-page.tsx`、`docs/guides/lists-and-search.md`「検索の入力欄を組む」) |

- pending 表示は Action 層の `isPending` から取る。例外は項目の busy・楽観表示・close 阻止で、mutation の pending から取る (ADR-0017)
- mutation は `src/hooks/use-action-mutation.ts` の `useActionMutation` を通す。`onError` は型で必須。`runAction` が reject を吸収するので、無いと失敗が無通知になる (`docs/guides/updates-and-data.md`「mutation の書き方」)
- Action の reject は最寄りの Error Boundary へ届く。`runAction` を通さない Action は、失敗を Action の中で処理し切る (ADR-0016)
- `onSuccess` は再取得の Promise を返す。再取得完了前に close するなら、対象の項目にその pending から busy 表現を付ける (`docs/guides/updates-and-data.md`「完了点ごとに Transition を終える」)
- 止めるのは対象の項目だけにする。並行操作が整合を壊すときだけ全体を止め、理由を実装近傍に書く (ADR-0017)
- Action の中で `await` の後に `setState` を書かない。Transition から外れる。画面の更新は query の再取得に任せる (`docs/guides/updates-and-data.md`「mutation の書き方」)
- `useOptimistic` に query の `data` と派生値を渡さない。query 由来の楽観表示と項目の busy は mutation の pending から取る (`docs/guides/updates-and-data.md`「楽観表示を出す」)
- mutation の pending は、1 件ずつなら `isPending && variables === id`、並行か別コンポーネントなら `mutationKey` + `useMutationState` で読む (`docs/guides/updates-and-data.md`「mutation の pending を読む」)
- `useMutationState` と `isMutating` の `filters` に `exact: true` を付ける。`variables` は `parseEach` (`src/lib/parse-each.ts`) で絞る (`docs/guides/updates-and-data.md`「mutation の pending を読む」)
- `useMutationState` の `select` の中で throw しない。描画中に走るので一覧ごと Error Boundary へ落ちる (`docs/guides/updates-and-data.md`「mutation の pending を読む」)
- 操作の開始の announce は `onMutate`、完了は `onSuccess` に書く (`src/lib/live-announcer.ts` の `announce()`、ADR-0026)
- 決着前の二重発火は Action 層の `isPending` (`aria-disabled`) が塞ぐ。閉包や ref のフラグを足さない (ADR-0016)

## 手動メモ化の増減

`useMemo` / `useCallback` は足すのも外すのも実測してから。判定手順は `docs/guides/updates-and-data.md`「手動メモ化を外すか判定する」。`src/components/ui/` は ADR-0020 の統制下なので触らない。

## コンポーネントは function 宣言で定義する

- トップレベルのコンポーネントとコンポーネント内の名前付きヘルパーは `function` 宣言で書く。型注釈が要るヘルパーだけ arrow const
- インラインのコールバック (`onClick` の中身など) は arrow で書く。shadcn 生成コード (`src/components/ui/`) は生成された形のまま置く

Why: 巻き上げでページ本体を上、ヘルパーを下に置ける。`.tsx` で generics を `<T,>` ハックなしに書ける。

## Item は Group の中に置く

`SelectItem` / `DropdownMenuItem` を `SelectContent` / `DropdownMenuContent` の直下に置かない (shadcn skill の `rules/composition.md`)。機械強制は無いのでレビューで見る。

## lint の抑制

- 行単位の抑制 (`oxlint-disable-next-line`) は違反が報告される行の直前に置く。`.map()` の行に置いても `key` の行には効かない (`docs/guides/lint.md`「行単位で抑制する」)
- `no-await-in-loop` は順序依存のループにも鳴る。逐次でないと壊れるループは `Promise.all` へ倒さず、抑制して順序が要る理由を書く (`docs/guides/lint.md`「行単位で抑制する」)

## dead code を発見したら即決 3 択

1. **削除** (呼び出し元なし)
2. **同等修正** (呼ばれている)
3. **スコープ外** → 別 PR へ切り出す

削除の前に git blame で導入コミットを確認する。行単位で「効かない」だけを根拠に消すと、別実装で置き換えるべき意図を落とす。

## 技術選択は plan 提示 → 反応待ち

3 案以上の技術選択や DB スキーマ変更を伴う判断は plan を提示してユーザーの反応を待つ。
