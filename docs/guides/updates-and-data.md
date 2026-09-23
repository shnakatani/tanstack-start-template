# React の更新とデータ取得

ユーザー操作で状態を変えるコード (イベントハンドラ、mutation、楽観表示、ダイアログの close) と、server function の周りを書くときの手順と落とし穴を持つ。

| 決定                                                                                                | ADR      |
| --------------------------------------------------------------------------------------------------- | -------- |
| ユーザー操作による更新は Transition を既定にし、query 由来の楽観表示は mutation の variables で出す | ADR-0020 |
| イベントハンドラは同期関数とし、非同期処理は内側へ閉じる                                            | ADR-0021 |
| mutation は Action 層の `action` prop から `useActionMutation` で呼び、二重発火は state だけで塞ぐ  | ADR-0022 |
| ユーザー操作の完了点とブロック範囲は機能ごとに選び、既定は対象の項目だけを止める                    | ADR-0023 |
| server function をデータ境界とし、全 fn 共通の middleware は global に載せる                        | ADR-0017 |
| メモ化は React Compiler に委ね、予防的なメモ化を強制しない                                          | ADR-0019 |

## explanation

### 用語

| 用語       | 意味                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Transition | `startTransition` に渡した関数の中で行う state 更新。割り込み可能で、Suspense の fallback を出さずに待てる           |
| 緊急更新   | Transition でない state 更新。React は即座に描画へ反映する                                                           |
| Action     | `startTransition` に渡す非同期関数。`await` した Promise の決着まで Transition が続く (`useTransition` リファレンス) |
| mutation   | `useMutation` を通して server function を呼ぶ操作 (POST 相当)。GET 相当のデータ取得は含まない                        |

### query のキャッシュとダイアログの close は Transition に乗らない

TanStack Query の `useQuery` / `useMutation`、TanStack Router のストア、Base UI のダイアログの handle は、どれも `useSyncExternalStore` で購読されている。React はこの購読の更新を、Transition の中で起きても緊急更新として描く。
そのため mutation を Action にしても、query の再取得による一覧の描き直しと `handle.close()` によるアンマウントは即座に起き、「古い画面を保ったまま待つ」効果も `<ViewTransition>` のアニメーションも付かない。Transition から得られるのは、pending の管理、Action の順序保証、pending の切り替えを `<ViewTransition>` で装飾できることである (ADR-0020)。
出典と実測は ADR-0020「制約: TanStack Query と Router のストアは Transition に参加しない」が持つ。`useOptimistic` に query の値を渡せない理由もここにある (「楽観表示を出す」)。

### React Compiler が見ない箇所

Compiler はコンポーネントか hook として認識した関数しか最適化しない。テーブルの列定義のように、コンポーネントでも hook でもない定義は最適化されないまま動く。
これは仕様どおりの挙動で、欠陥として扱わない (ADR-0019)。

## how-to

### イベントハンドラを書く

ADR-0021 の形に沿う。

- ハンドラは同期関数として宣言し、非同期処理はその内側の関数へ閉じる。JSX の prop に `async` 関数や `void` 式を直接書かない
- 待たない判断は内側で 1 回だけ書く。呼び先が失敗を自分で通知するなら `void`、呼び出し側で通知や後始末をするなら `.catch()` を付ける
- 実例は `src/components/screens/route-error.tsx` の `handleRetry`
- mutation を伴う操作は、次の「mutation を Action 層から呼ぶ」に従う

### mutation を Action 層から呼ぶ

mutation を伴う操作は、`src/components/action/` の部品 (`ActionButton` / `AlertDialogActionButton` / `ActionForm`) に `action` を渡し、Action の中で `useActionMutation` の `runAction` を呼ぶ (ADR-0022)。

#### Action 層の部品が守る契約

`src/components/action/` に部品を足すときは、次を満たす。

| 契約         | 内容                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`     | `() => Promise<void> \| void`。`startTransition` に直接渡す。同期と非同期のどちらも受け、決着まで pending が続く                                                                                                                                                                                                                                                                                            |
| pending      | `useTransition` の `isPending`。`aria-disabled` と `focusableWhenDisabled` でフォーカスを保つ。名前は `aria-labelledby` で children に固定する。`Spinner` は視覚専用 (`aria-hidden`)。状態は要素自身の `aria-busy` と `aria-disabled` で持ち、通知は feature 側が announcer で出す (ADR-0035)。button の子孫はユーザーエージェントが accessibility API に露出すべきでない (SHOULD NOT。WAI-ARIA 1.2 §5.2.9) |
| 二重発火     | 決着前の再クリックは `isPending` (`aria-disabled`) が塞ぐ。ref や閉包のフラグは持たない (ADR-0022「二重発火は state だけで塞ぐ」)                                                                                                                                                                                                                                                                           |
| 失敗         | 部品は握らない。呼び出し側が Action の中で処理し切る。mutation は `useActionMutation` を通す                                                                                                                                                                                                                                                                                                                |
| 基盤への依存 | 契約は Base UI に依存しない。Base UI (issue 5133) か React Aria (PR 9894) が `action` prop を出荷したら、内部の実装だけを差し替える                                                                                                                                                                                                                                                                         |

#### mutation の書き方

mutation は `src/hooks/use-action-mutation.ts` の `useActionMutation` を通す。`useMutation` の薄い wrapper で、次を持つ。

| 項目                      | 書き方                                                                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 入力                      | `useMutation` の options。`onError` は型で必須。省略すると、reject の吸収が通知の無い失敗になる                                                                                                     |
| 出力                      | `mutate` / `mutateAsync` は型で外してあり、`runAction(variables): Promise<void>` を使う。`runAction` は `mutateAsync` を await して reject を吸収し、通知は `onError` (`toastMutationError`) が出す |
| 呼び出し                  | `action` から `runAction` を呼ぶ。`mutate` は Promise を返さず、reject も `.catch(noop)` で握るので (`@tanstack/react-query` の `useMutation.js`)、Transition が完了も失敗も観測できない            |
| 再取得と close            | `onSuccess` は完了点によらず再取得の Promise を返す。TanStack Query は `onSuccess` の Promise を待つので、その間 `isPending` が続く。閉じる時点は「完了点ごとに Transition を終える」               |
| `await` の後の state 更新 | 書かない。Action の中で `await` の後に set すると Transition から外れる (`useTransition` の既知の制限)。画面の更新は query の再取得に任せる                                                         |

`runAction` を通さない Action の reject は、最寄りの Error Boundary へ届き画面ごと差し替わる。lint では見つからないので、Action を書くときはレビューで「失敗を Action の中で処理し切っているか」を見る。

### 完了点ごとに Transition を終える

完了点 (a) (b) (c) のどれを選ぶかは ADR-0023 の軸で決める。選んだら、次の形で組む。ダイアログの無い操作では、Action が return する時点が close の時点に当たる。

| 完了点             | Transition の終え方                                                                                                                                                                        | Transition の pending                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| (a) 確定操作の直後 | Action は `handle.close()` だけを含み (ダイアログが無ければ何もしない)、mutation は Transition の外で `void runAction(...)` として走らせる。失敗は `onError` の toast と項目の復帰で伝える | 確定操作で終わる                                            |
| (b) サーバー応答   | `onSuccess` の先頭で `handle.close()` を呼び、その後に再取得の Promise を返す (ダイアログが無ければ `mutateAsync` を await して return)                                                    | 再取得の完了まで続くが、閉じた後は見えない                  |
| (c) 再取得の完了   | `onSuccess` で再取得を await した後に `handle.close()` を呼ぶ                                                                                                                              | 再取得の完了まで続き、ダイアログの pending 表示として見える |

- (a) では Transition が確定の直後に終わるので、close の animate-out の間やダイアログの無い操作では `isPending` の dedupe が効かない。同じ対象の mutation が pending なら action を no-op にする。判定は `queryClient.isMutating` か `useMutationState` で取る。実例は `src/routes/notes/-components/notes-page.tsx` の `confirmDelete`
- (b) で handle を複数の対象で共有するときは、閉じる前に、開いている対象がこの mutation の対象と同じかを確かめる。先行する操作の `onSuccess` が、別の対象で開き直したダイアログを閉じてしまう
- (b) で入力フォームのように対象を比べられないダイアログは、応答が届くまでユーザー起点の close を止める。判定は mutation の pending と一覧の再取得中かどうかから取る。実例は `src/routes/notes/-components/note-create-dialog.tsx`
- 再取得の完了より前に閉じるなら、対象の項目にその pending から busy の表現を付ける。付け忘れると、古い一覧が pending の表示なしで見える

並行実行を許す操作では `mutationKey` を付ける。

- `variables` / `useMutationState` で UI 側に描く方式では、各 mutation が自分の再取得の Promise を返して待つ。再取得は重なりうるが、巻き戻される楽観状態が無い
- `onMutate` でキャッシュを書き換える方式で並行実行を許すときだけ、`onSettled` で `queryClient.isMutating({ mutationKey }) === 1` のときに再取得する。先に終わった mutation の再取得が、後の楽観表示を巻き戻すのを防ぐ (TkDodo「Concurrent Optimistic Updates」)

### mutation の pending を読む

| 場面                               | 読み方                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1 件ずつ                           | `mutation.isPending && mutation.variables === id`。`variables` は決着後も残るので `isPending` でゲートする |
| 並行、または別のコンポーネントから | `mutationKey` を付け、`useMutationState` (`status: "pending"`) で読む                                      |

- `mutationKey` は既定で前方一致に当たる。`useMutationState` と `isMutating` の `filters` には `exact: true` を付ける (query-core の `matchMutation`)
- `variables` の型は `unknown` のままなので、行へ渡す前にスキーマで `safeParse` して型へ絞り、失敗は `console.warn` に raw input ごと残して除外する。絞り込みは `src/lib/parse-each.ts` の `parseEach` が持つ
- `useMutationState` の `select` の中で throw しない。`select` は描画中に走るので、throw すると一覧ごと Error Boundary へ落ちる

### 楽観表示を出す

- query が持つデータとその派生値の楽観表示は、mutation の pending (`variables` / `useMutationState`) から描く。複数の表示箇所を同時に更新するなら `onMutate` でキャッシュを書き換え、失敗時に rollback する (ADR-0020、ADR-0023)
- `useOptimistic` の第 1 引数に `useQuery` / `useSuspenseQuery` の `data` と、そこから計算した値を渡さない。query のストアは Transition に乗らないので、楽観値と再取得の結果が揺れる (TanStack/query #9742)
- `useOptimistic` を使うのは、query を経由しない部品のローカル値だけにする

### メモ画面の実例

`/notes` の削除と追加は、ADR-0023 の軸を次のように当てている。新しい操作を足すときの見本になる。

| 操作 | 完了点                       | 表現                                                                                                                                                                                                                                               | 理由                                                                                                                 |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 削除 | (a) 確定でダイアログを閉じる | 行を `aria-busy` と半透明にし、行のトリガーだけを無効にする。mutation に `mutationKey` を付け、一覧側で `useMutationState` (`status: "pending"`) の `variables` を配列で読み、行ごとに判定する。同時の削除を許し、各 mutation は自分の再取得を待つ | 失敗は toast と行の復帰で戻せる。確定で閉じるので、共有の handle を先行する削除の `onSuccess` が閉じる問題も起きない |
| 追加 | (b) サーバー応答で閉じる     | `onSuccess` の先頭で閉じ、再取得の Promise を返す。mutation はダイアログ側にあるので `mutationKey` を付け、一覧側で `useMutationState` の `variables` を読んで新しい行を半透明で出し、再取得の完了で実データに置き換える                           | 楽観で閉じると、失敗したときに入力を戻す先が無い                                                                     |

- 半透明は `src/components/parts/busy-opacity.ts` の `BUSY_OPACITY_CLASS` を使う。値の理由と、当たる対の測り方は同じ定数の docstring が持つ
- 半透明と `aria-busy` は読み上げに出ない。通知は announcer で出し、行には仮想カーソル用の静的テキスト (「削除中」「保存中」) を置く (ADR-0035)
- `variables` を行へ絞るスキーマは `src/features/notes/deleting-ids.ts` と `src/features/notes/creating-rows.ts`、filters は `src/features/notes/mutations.ts` が持つ

### 認可を足す

認証は `src/start.ts` の global middleware に載せ、全 server function に通す (ADR-0017)。認可はその上に、要るようになった時点で次の順で足す。

1. `createServerFn` を包む base builder を作り、認可の middleware を載せる。認証への依存を明示したいなら `.middleware([authMiddleware])` で chain する
2. 認可の付け忘れを lint で止めるなら、`createServerFn` の直接の import を禁じる。適用範囲は `src` 全体 (`.ts` と `.tsx`) にする。server function は route ファイルでも宣言できるので、server function のディレクトリに絞ると、宣言を 1 つ外へ移すだけで迂回できる
3. 一律の禁止は base builder 自身の定義ファイルも落とす。`overrides` の `excludeFiles` でそのファイルだけを外す (2026-09-06 に実測)

### ユーザー入力で部分一致の検索を組む

- 呼び出し側はパターンと `ESCAPE` を手で組まず、`src/server/db/like-pattern.ts` の `likeContains` を使う。エスケープと `ESCAPE` 句を対で渡すことを忘れた検索は、`%` が効き `\` が消えて黙って壊れる
- 検証は実 SQLite (`:memory:`) で行う。実例は `src/features/notes/handlers.test.ts` で、`%` / `_` / `\` を含む検索語、ASCII の大文字小文字、日本語を見る。エスケープの純粋関数だけを単体で見ると、`ESCAPE` 句との対応が抜けても通る

### 手動メモ化を書く

新しいコードで予防的に `useMemo` / `useCallback` を書かない。性能の問題として実際に現れた箇所だけを手でメモ化する (ADR-0019)。

### 手動メモ化を外すか判定する

既存の `useMemo` / `useCallback` は、撤去の前後でコンパイル出力が悪化しないことを測れた箇所だけ外す (ADR-0019 の決定 4)。
Compiler がメモ化のスコープを作るのは、値の identity を同じコンパイル単位の中で観測できるときに限られる。カスタム hook の返り値へ入るだけの導出は消費側が見えず、スコープが粗くなる。一括で外すと依存のガードを失い、劣化が下流へ連鎖する。ガードの数が同じでもスコープが融合して依存の集合が広がることがあり、どちらも外形からは読み取れない。

撤去の前後でコンパイルし、次の 3 つを比べる。1 つでも悪化したら外さない。

| 指標           | 悪化の条件 |
| -------------- | ---------- |
| 依存ガードの数 | 減った     |
| 依存比較の総数 | 増えた     |
| mount 時の固定 | 減った     |

```js
import { transformSync } from "oxc-transform-react";
const { code } = transformSync(filename, source, {
  lang: filename.endsWith(".tsx") ? "tsx" : "ts",
});
const guards = (code.match(/if \(\$\[\d+\] !==/g) ?? []).length;
const deps = (code.match(/\$\[\d+\] !==/g) ?? []).length;
const sentinels = (code.match(/memo_cache_sentinel/g) ?? []).length;
```

- 依存比較の総数を見るのは、スコープが融合して依存の集合が広がる劣化を捕まえるためである。ガードの数だけでは取りこぼす
- コンパイル出力の diff は判定に使えない。メモ化が保たれていても、出力は必ず変わる
- `useEffect` の依存へ流れる値は、指標とは別に確かめる。識別子ではなく正しさに関わる
- `src/components/ui/` は ADR-0027 の統制下なので、判定の対象にせず改変しない

### React Compiler の診断を読む

- bail out は `vp build` のログに出る (`compiler.logDiagnostics`)。ログの行は `[plugin vite:react-compiler]` で始まり、`error` / `warn` を含まない。`react-compiler` で grep する
- `vp lint -D react/todo` は同じ bail out を file:line つきで報告する (2026-09-02 に同じツリーで件数が一致)。`oxc-transform-react` が非 fatal の診断をビルドログへ出さなくなったときは、こちらをその場で叩く。`react/todo` は設定で有効にしない (ADR-0019 の決定 3)
- Compiler の適用が壊れたら、`@vitejs/plugin-react` と `oxc-transform-react` を前の版へ揃えて下げる。babel の経路へは戻さない (ADR-0019)
