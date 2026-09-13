# ADR-0014: ユーザー操作による更新は Transition を既定にし、pending は Transition から取る

- Status: Proposed
- Date: 2026-09-13
- 関連: ADR-0004 (ハンドラを同期関数にする理由。「`no-misused-promises` が要求する実装の形」の `startTransition` に関する段落をこの ADR が覆す)、ADR-0006 (registry コードは触らない。Action 層は registry の外に置く)、ADR-0012 (配置の原則)

## Context

### 用語

- **Transition**: `startTransition` に渡した関数の中で行う state 更新。割り込み可能で、Suspense の fallback を出さずに待てる
- **緊急更新**: Transition でない state 更新。React は即座に描画へ反映する
- **Action**: `startTransition` に渡す非同期関数。`await` した Promise の決着まで Transition が続く (`useTransition` リファレンス)
- **mutation**: `useMutation` を通して server function を呼ぶ操作 (POST 相当)。GET 相当のデータ取得は含まない

### 現状

pending 表示は TanStack Query の mutation が持つ `isPending` から取っている (`.claude/rules/implementation.md`「イベントハンドラは同期に保つ」の 2026-09-13 改訂前の記述)。
`startTransition` / `useTransition` / `useDeferredValue` / `useOptimistic` を使う箇所は `src/` に無い。

```bash
grep -rn "useTransition\|startTransition\|useDeferredValue\|useOptimistic" src/   # 2026-09-13: 0 件
grep -rln "useMutation(" src/ --include='*.tsx'                                   # 2026-09-13: 2 ファイル
```

mutation を持つのは `src/routes/notes/-components/note-create-dialog.tsx` (追加) と `src/routes/notes/index.tsx` (削除) の 2 箇所である。
どちらも `onSuccess` の中で `invalidateQueries` を `void` した直後にダイアログを `close()` する。
削除の二重発火は `src/components/delete-confirm-dialog.tsx` の `deleteConfirmMutationProps` が閉包のフラグで塞いでいる。`isPending` は再レンダー後にしか立たず、それより前に届く再クリックを `disabled` では止められないためである。

mutation 以外のユーザー操作由来の更新は、`src/components/route-error.tsx` の `handleRetry` (Error Boundary の `reset()` と `router.invalidate()`) と、ダイアログの開閉 (Base UI の handle) がある。

ルート遷移は既に Transition である。
`@tanstack/router-core` は match の commit を `router.startTransition` へ渡し (`load-client.js`)、`@tanstack/react-router` の `Transitioner` がそれを `React.startTransition` で包む。
2026-09-13 に router-core 1.171.27 と react-router 1.170.32 の dist で確認した。

### React 側の方針

React チームは React 18 の設計時点から、大半の更新を Transition として扱う前提を置いている。

| 出典                                                 | 発言                                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reactwg/react-18 #41 (Rick Hanlon、2021)             | "In a typical React app, most updates are conceptually transition updates. But for backwards compatibility reasons, transitions are opt-in."                                                   |
| reactwg/react-18 #63 (Sebastian Markbåge、2021)      | "Ideally almost every update should be wrapped in a transition somehow." 同時に、段階的移行と衝突するので全面適用はまだ推さない、と留保                                                        |
| reactwg/react-18 #100 (Dan Abramov、2021)            | `startTransition` は長期的には router やデータ取得ライブラリが主に使い、ローカルの非緊急化には `useDeferredValue` を使う                                                                       |
| reactwg/async-react #5 (Rick Hanlon、2025-11)        | "sync transitions: navigations, GET in render / async transitions: mutations, POST in action"                                                                                                  |
| React Conf 2025 デモ (rickhanlonii/async-react)      | shadcn の `components/ui/button.tsx` をそのまま置き、`src/design/Button.jsx` が `action` prop を受けて `useTransition` で包む。Router は Transition を既定、データ取得は Suspense を既定にする |
| React 19.3 リリース (2026-09-09、react/react #37290) | 複数の Transition を独立して描画する。それまでは 1 つの描画に entangle していた (`useTransition` リファレンスの Caveats は 2026-09-13 閲覧時点でも batch すると書いたまま)                     |
| `useTransition` リファレンス (2026-09-13 閲覧)       | "If you're building a React framework or a router, we recommend marking page navigations as Transitions."                                                                                      |

### 制約 1: TanStack Query と Router のストアは Transition に参加しない

`@tanstack/react-query` の `useBaseQuery.js` / `useMutation.js` は `React.useSyncExternalStore` を使う。
`@tanstack/react-store` 0.9.3 の `useStore.js` は `use-sync-external-store/shim/with-selector` を使い、shim は React 18 以降で `React.useSyncExternalStore` へ委譲する (2026-09-13、node_modules を grep)。
React の `useSyncExternalStore` リファレンスは次を明記する。

> If the store is mutated during a non-blocking Transition update, React will fall back to performing that update as blocking.

> It's not recommended to suspend a render based on a store value returned by `useSyncExternalStore`. The reason is that mutations to the external store cannot be marked as non-blocking Transition updates.

この制約が `useOptimistic` と衝突する。
TanStack/query #9742 (2025-10-09) は「楽観値 2 → refetch 完了で 3 → Action 完了で 2」と揺れる再現を示し、メンテナ (TkDodo) は 2026-08-17 に "nothing we can do here without concurrent stores" と書いて close した。
concurrent stores は react/react #35449 (2026-01-05、`useStore` / `createStore` の RFC、PoC) の段階で、19.3 には入っていない。

```bash
gh search issues "concurrent stores" --repo TanStack/query     # 2026-09-13: #9742 と無関係の 1 件のみ
gh search issues "useStore createStore concurrent" --repo TanStack/router   # 2026-09-13: 0 件
```

Router はこの制約を自前で回避している。`Transitioner` が Transition の描画完了を acknowledgement として受け取り、それが settle するまで `resolvedLocation` を進めない (`packages/router-core/INTERNALS.md` の `resolvedLocation` の説明)。

Base UI のダイアログも同じ種類のストアである。
`handle.close()` は `@base-ui/utils` の store を更新する (`node_modules/@base-ui/react/utils/popups/popupHandle.js`)。
Root はその store を `use-sync-external-store/shim` で購読する (`node_modules/@base-ui/utils/store/useStore.js`)。
そのため close は緊急更新として即座にアンマウントを起こす。

### 制約 2: registry の Button に action prop は無い

`src/components/ui/button.tsx` は shadcn registry の出力で、改変は ADR-0006 の許容リストに限る。
包んでいる `@base-ui/react` 1.8.0 の Button の props は `NativeButtonProps` と `focusableWhenDisabled` だけで、`action` / pending 相当の prop は無い (`node_modules/@base-ui/react/button/Button.d.ts`)。

| ライブラリ | 状況 (2026-09-13)                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base UI    | mui/base-ui #5133 (2026-06-27) が `action` / `on*ChangeAction` を提案。ラベル「waiting for 👍」、メンテナ返信なし                                                        |
| React Aria | adobe/react-spectrum #9894 (2026-04-08) が `action` / `changeAction` / `isPending` / `actionError` の RFC。2026-07-17 に実装を別 PR へ分割すると表明、merge 済み実装なし |
| shadcn/ui  | issue なし。Button のドキュメントは disabled + Spinner の例だけ                                                                                                          |

### 制約 3: Action の reject は Error Boundary へ届く

`useTransition` リファレンスは、`startTransition` に渡した関数が throw または reject すると最寄りの Error Boundary が fallback を出すと書く。
`.claude/rules/implementation.md`「イベントハンドラは同期に保つ」は、操作の失敗を Error Boundary へ届けず toast か画面内表示で通知すると定める。両立させるには、Action の中で失敗を処理し切る必要がある。

### 制約 4: `<ViewTransition>` は Transition 内の React state 更新でしか発火しない

React 19.3 で stable になった `<ViewTransition>` は、`startTransition` 内の更新・Suspense の reveal・`useDeferredValue` 由来の更新でだけアニメーションする。緊急更新は対象外である (19.3 リリース記事)。
query のキャッシュ更新は制約 1 により緊急更新に落ちるので、mutation を Action 化しても一覧の行の増減は `<ViewTransition>` の対象にならない。
対象になるのは Transition の中で set した React state (pending の切り替え、`useOptimistic` のローカル値) だけである。

## Decision

**ユーザー操作に起因する更新は Transition の中で行い、pending は Transition から取る。**

| 更新の種類                                   | 扱い                                                                                             | 担う場所                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| ナビゲーション、GET                          | 同期 Transition。データは Suspense で読む                                                        | TanStack Router (既存)                  |
| mutation                                     | 非同期 Transition (Action)。`mutateAsync` を await する                                          | `src/components/action/`                |
| query の再取得 (`invalidateQueries`)         | Action の中で待つ。描画は緊急更新に落ちる (制約 1)                                               | mutation の `onSuccess`                 |
| ダイアログの開閉                             | 緊急更新のまま (Base UI の store、制約 1)。mutation 成功後の close は再取得を await した後に呼ぶ | mutation の `onSuccess`                 |
| Error Boundary の `reset()` と loader 再実行 | 緊急更新のまま。`router.invalidate()` の描画は Router が Transition 化する                       | `src/components/route-error.tsx` (既存) |
| 制御コンポーネントの入力値                   | 緊急更新のまま。Transition は他の更新に割り込まれるため、入力値の反映が遅れる                    | 各部品                                  |

### Action 層 `src/components/action/`

`src/components/ui/` を包み、`action` prop を受ける部品を置く。ファイル名は包む先と同名にする (`button.tsx` → `ActionButton`)。
最初に置くのは `button.tsx`、`alert-dialog.tsx`、`form.tsx` の 3 つで、メモ画面の 2 経路が使う最小集合である。`form.tsx` だけは `ui/` に対応部品が無く、素の `<form>` を包む。

| 契約     | 内容                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `action` | `() => Promise<void> \| void`。`startTransition` の中で await する                                                                                                                                                             |
| pending  | `useTransition` の `isPending`。`aria-disabled` と `focusableWhenDisabled` でフォーカスを保つ。名前は `aria-labelledby` で children に固定し、状態は `<output>` (暗黙ロール status) + `aria-label` の sr-only テキストで伝える |
| 二重発火 | Action の Promise が決着するまでの再クリックを ref のフラグで塞ぐ。`isPending` が立つ前に届く分も含む。この dedupe の実装は Action 層だけが持つ                                                                                |
| 失敗     | 部品は握らない。呼び出し側が Action の中で処理し切る (制約 3)。mutation は次項の `useActionMutation` を通す                                                                                                                    |
| 基盤依存 | 契約は Base UI に依存しない。Base UI #5133 か React Aria #9894 が出荷したら内部実装だけ差し替える                                                                                                                              |

### mutation の書き方

mutation は `src/hooks/use-action-mutation.ts` の `useActionMutation` を通す。`useMutation` の薄い wrapper で、次を持つ。

| 項目                    | 規範                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 入力                    | `useMutation` の options。型で `onError` を必須にする。省略すると reject の吸収が無通知の失敗になるため、型で止める                                                                                        |
| 出力                    | `useMutation` の戻り値に `runAction(variables): Promise<void>` を足す。`runAction` は `mutateAsync` を await し、reject を吸収する。通知は `onError` (`toastMutationError`) が担う                         |
| 呼び出し                | `action` prop から `runAction` を呼ぶ。`mutate` は Promise を返さず reject も `.catch(noop)` で握るため、Transition が完了も失敗も観測できない (`useMutation.js`)                                          |
| 再取得と close          | `onSuccess` を async にし、`await queryClient.invalidateQueries(...)` の後に `handle.close()` を呼ぶ。TanStack Query は `onSuccess` の Promise を待つので、再取得完了まで `isPending` と Transition が続く |
| `await` 後の state 更新 | 書かない。Action の中で `await` の後に set すると Transition から外れる (`useTransition` の既知の制限)。画面の更新は query の再取得に任せる                                                                |

### 楽観表示の使い分け

| 表示したい値                       | 方式                                                        | 理由                                                                     |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| query が持つデータとその派生値     | TanStack Query の `mutation.variables` / `useMutationState` | query と同じストアで更新され、Transition との rebase が起きない (制約 1) |
| query を経由しない部品のローカル値 | `useOptimistic` を Action の中で set する                   | React の想定どおりの経路。React Aria #9894 が同じ設計を採る              |
| Router の state                    | Router に任せる                                             | 自前の acknowledgement で整合を取っている (制約 1)                       |

判定は `useOptimistic` の第 1 引数で行う。`useQuery` / `useSuspenseQuery` の `data` とそこから計算した値を渡さない。

### 検討した選択肢

| 案                                                            | 評価                                                                                                                                                                | 採否     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| app 層に `src/components/action/` を置き `action` prop で包む | React Conf 2025 デモと同じ構造。registry を触らず (ADR-0006)、基盤にも依存しない。dedupe と pending の実装が 1 箇所に集まる                                         | **採用** |
| 呼び出し側ごとに `useTransition` を書く                       | 決着前の dedupe と a11y の状態伝達を毎回書き直す。`deleteConfirmMutationProps` の閉包と同じ形が箇所ごとに散る                                                       | 却下     |
| Base UI #5133 か React Aria #9894 の出荷を待つ                | どちらも 2026-09-13 時点で merge 済み実装が無く、時期も未定                                                                                                         | 却下     |
| 現状維持 (mutation の `isPending`)                            | Transition の意味論 (割り込み、Action の順序保証) を持たず、pending の切り替えが `<ViewTransition>` の対象にならない。React チームの区分 (Context) から外れ続ける   | 却下     |
| `useOptimistic` を一覧の行にも使う                            | TanStack/query #9742 の揺れが起きる。concurrent stores (react/react #35449) が出荷するまで成立しない                                                                | 却下     |
| 基盤を React Aria へ替えて action prop を待つ                 | shadcn CLI は `--base aria` を持つが、shadcn-ui/ui #11724 (2026-09-01) の実測で API parity が無く porting になる。Action 層は基盤非依存なので、この判断と切り離せる | 別 ADR   |

### 既存規範の改訂

| 文書                                   | 改訂                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/rules/implementation.md`      | 「イベントハンドラは同期に保つ」を mutation を伴わない非同期処理に限定し、新節「ユーザー操作による更新は Transition の中で行う」を足す |
| `.claude/rules/directory-structure.md` | コンポーネント配置の表に `src/components/action/` の行を足す                                                                           |
| ADR-0004                               | 「`no-misused-promises` が要求する実装の形」の `startTransition` に関する段落を現在の事実に書き換え、`Revised` に経緯を残す            |

## Consequences

- pending の源が Transition の `isPending` に一本化される。mutation の `isPending` を直接 UI へ渡す形は残さない
- ダイアログは再取得の完了まで pending 表示のまま開いている。古い一覧が pending 表示なしで見える経路が消える代わりに、再取得が遅い環境では閉じるまでが長くなる
- Transition 化で得るのは pending の自動管理、Action の順序保証、部品契約の統一、pending の切り替えを `<ViewTransition>` で装飾できることの 4 つ。「古い画面を保ったまま新しいデータを待つ」効果と一覧の行の増減のアニメーションは、query の再取得には効かない (制約 1、制約 4)
- ルート遷移への `<ViewTransition>` 適用は別途判断する
  - TanStack Router は `document.startViewTransition` を直接呼び (router-core `router.js`)、React の `<ViewTransition>` には未対応
  - 2026-09-13 の `gh search prs "ViewTransition" --repo TanStack/router` は browser API 由来の PR のみ
- `useActionMutation` を通さない Action の reject は Error Boundary へ届く (制約 3)。lint で検出できないため、Action を書くときのレビュー観点に含める
- 後続作業
  - `src/components/action/` の 3 部品と `useActionMutation` の実装、メモ画面 2 経路の移行、`deleteConfirmMutationProps` の閉包フラグの撤去
  - 値を持つ部品の `changeAction` 版 (`checkbox` / `select` / `toggle` / `toggle-group` / `radio-group` / `combobox`)。`useOptimistic` で表示を先に進める設計が要り、Button 系とは別に扱う
  - React Aria への基盤変更の ADR。発火条件は「React Aria #9894 の実装が出荷した」か「a11y 要件で Base UI に不足が出た」のどちらか
- 再評価条件
  - concurrent stores (react/react #35449) が出荷したら、query が持つデータへの `useOptimistic` 適用を再評価する
  - Base UI #5133 か React Aria #9894 が出荷したら、Action 層の内部実装をライブラリの `action` prop へ寄せる

## 出典

- Reactの設計論 (uhyo、フロントエンドカンファレンス福岡 2026、2026-09-12): https://speakerdeck.com/uhyo/react-no-sekkeiron
- reactwg/react-18 #41 New feature: startTransition: https://github.com/reactwg/react-18/discussions/41
- reactwg/react-18 #63 Integrating transitions into design systems: https://github.com/reactwg/react-18/discussions/63#discussioncomment-917187
- reactwg/react-18 #100 Patterns for startTransition: https://github.com/reactwg/react-18/discussions/100#discussioncomment-1382060
- reactwg/async-react #5 Routers and Transitions: https://github.com/reactwg/async-react/discussions/5
- React Conf 2025 Async React デモ: https://github.com/rickhanlonii/async-react
- React 19.3 リリース記事: https://react.dev/blog/2026/09/09/react-19-3
- react/react #35392 (`enableParallelTransitions` の追加) / #37290 (既定で有効化): https://github.com/react/react/pull/35392 / https://github.com/react/react/pull/37290
- `useTransition` リファレンス: https://react.dev/reference/react/useTransition
- `useSyncExternalStore` リファレンス (Caveats): https://react.dev/reference/react/useSyncExternalStore
- `useOptimistic` リファレンス: https://react.dev/reference/react/useOptimistic
- TanStack/query #9742 Is React Query incompatible with React Actions/Transitions/useOptimistic?: https://github.com/TanStack/query/issues/9742
- react/react #35449 [RFC] useStore/createStore APIs: https://github.com/react/react/pull/35449
- TanStack Query「Invalidations from Mutations」: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
- mui/base-ui #5133 First class support for async react primitives: https://github.com/mui/base-ui/issues/5133
- adobe/react-spectrum #9894 RFC: Adopting Async React in React Aria Components: https://github.com/adobe/react-spectrum/pull/9894
- shadcn-ui/ui #11724 Bundle size audit across base / aria / radix: https://github.com/shadcn-ui/ui/issues/11724
