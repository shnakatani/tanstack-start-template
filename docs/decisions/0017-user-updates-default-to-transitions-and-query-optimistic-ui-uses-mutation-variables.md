# ADR-0017: ユーザー操作による更新は Transition を既定にし、query 由来の楽観表示は mutation の variables で出す

- Status: Accepted
- Date: 2026-09-14
- 関連: ADR-0019 (Action 層と `useActionMutation`)、ADR-0018 (ハンドラを同期関数にする理由。mutation を伴う操作の Transition の判断はこの ADR が持つ)、ADR-0024 (registry コードは触らない。Action 層は registry の外に置く)、ADR-0012 (配置の原則)、ADR-0034 (二重発火の検証は実イベントで書く)、ADR-0020 (完了点とブロック範囲の軸)

## Context

### 用語

- **Transition**: `startTransition` に渡した関数の中で行う state 更新。割り込み可能で、Suspense の fallback を出さずに待てる
- **緊急更新**: Transition でない state 更新。React は即座に描画へ反映する
- **Action**: `startTransition` に渡す非同期関数。`await` した Promise の決着まで Transition が続く (`useTransition` リファレンス)
- **mutation**: `useMutation` を通して server function を呼ぶ操作 (POST 相当)。GET 相当のデータ取得は含まない

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

### 制約: TanStack Query と Router のストアは Transition に参加しない

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

### 制約: `<ViewTransition>` は Transition 内の React state 更新でしか発火しない

React 19.3 で stable になった `<ViewTransition>` は、`startTransition` 内の更新・Suspense の reveal・`useDeferredValue` 由来の更新でだけアニメーションする。緊急更新は対象外である (19.3 リリース記事)。
query のキャッシュ更新は「TanStack Query と Router のストアは Transition に参加しない」により緊急更新に落ちるので、mutation を Action 化しても一覧の行の増減は `<ViewTransition>` の対象にならない。
対象になるのは Transition の中で set した React state (pending の切り替え、`useOptimistic` のローカル値) だけである。

## Decision

**ユーザー操作に起因する更新は Transition の中で行い、pending は Transition から取る。**

| 更新の種類                                   | 扱い                                                                                                                                                                                                           | 担う場所                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| ナビゲーション、GET                          | 同期 Transition。データは Suspense で読む                                                                                                                                                                      | TanStack Router (既存)                          |
| mutation                                     | 非同期 Transition (Action)。`mutateAsync` を await する。完了点 (a) (ADR-0020) では Action は close だけを含み、mutation は Transition の外で `void runAction(...)` として走る                                 | `src/components/action/`                        |
| query の再取得 (`invalidateQueries`)         | mutation の `onSuccess` が Promise を返して待つ (pending の源)。ダイアログを閉じる時点は ADR-0020 の完了点の軸で選ぶ。描画は緊急更新に落ちる (「TanStack Query と Router のストアは Transition に参加しない」) | mutation の `onSuccess`                         |
| ダイアログの開閉                             | 緊急更新のまま (Base UI の store。「TanStack Query と Router のストアは Transition に参加しない」)。mutation 成功後に閉じる時点は ADR-0020 の完了点の軸で選ぶ                                                  | mutation の `onSuccess`                         |
| Error Boundary の `reset()` と loader 再実行 | 緊急更新のまま。`router.invalidate()` の描画は Router が Transition 化する                                                                                                                                     | `src/components/screens/route-error.tsx` (既存) |
| 制御コンポーネントの入力値                   | 緊急更新のまま。Transition は他の更新に割り込まれるため、入力値の反映が遅れる                                                                                                                                  | 各部品                                          |

### 楽観表示の使い分け

| 表示したい値                       | 方式                                                                                                                                                                                                                       | 理由                                                                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| query が持つデータとその派生値     | TanStack Query の `mutation.isPending && mutation.variables === id` (複数コンポーネントからは `useMutationState`)。複数の表示箇所を同時に更新するなら `onMutate` でキャッシュを書き換え、失敗時に rollback する (ADR-0020) | query と同じストアで更新され、Transition との rebase が起きない (「TanStack Query と Router のストアは Transition に参加しない」)。`variables` は決着後も残るため `isPending` でゲートする |
| query を経由しない部品のローカル値 | `useOptimistic` を Action の中で set する                                                                                                                                                                                  | React の想定どおりの経路。React Aria #9894 が同じ設計を採る                                                                                                                                |
| Router の state                    | Router に任せる                                                                                                                                                                                                            | 自前の acknowledgement で整合を取っている (「TanStack Query と Router のストアは Transition に参加しない」)                                                                                |

判定は `useOptimistic` の第 1 引数で行う。`useQuery` / `useSuspenseQuery` の `data` とそこから計算した値を渡さない。

### 検討した選択肢

| 案                                                                             | 評価                                                                                                                                                              | 採否     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 現状維持 (mutation の `isPending`)                                             | Transition の意味論 (割り込み、Action の順序保証) を持たず、pending の切り替えが `<ViewTransition>` の対象にならない。React チームの区分 (Context) から外れ続ける | 却下     |
| `useOptimistic` を一覧の行にも使う                                             | TanStack/query #9742 の揺れが起きる。concurrent stores (react/react #35449) が出荷するまで成立しない                                                              | 却下     |
| ユーザー操作による更新を Transition の中で行い、pending を Transition から取る | React チームの前提 (「React 側の方針」) に沿い、pending の切り替えが `<ViewTransition>` の対象になる                                                              | **採用** |

### 他の文書との関係

| 文書     | この ADR に従う箇所            |
| -------- | ------------------------------ |
| ADR-0018 | `startTransition` に関する段落 |

## Consequences

- pending の源が Transition の `isPending` に一本化される。mutation の `isPending` を直接 UI へ渡す形は残さない (楽観表示と項目の busy は除く)。一覧のトリガーを全体で無効にするかは ADR-0020 の軸で決める
- ダイアログを閉じる時点と、その間に止める範囲は ADR-0020 の軸で機能ごとに選ぶ。再取得完了前に閉じるときは、対象の項目が mutation の pending から busy を表現する
- Transition 化で得るのは pending の自動管理、Action の順序保証 (完了点 (a) で Transition の外に出した mutation は除く。ADR-0020)、部品契約の統一、pending の切り替えを `<ViewTransition>` で装飾できることの 4 つ。「古い画面を保ったまま新しいデータを待つ」効果と一覧の行の増減のアニメーションは、query の再取得には効かない (「TanStack Query と Router のストアは Transition に参加しない」「`<ViewTransition>` は Transition 内の React state 更新でしか発火しない」)
- ルート遷移への `<ViewTransition>` 適用は別途判断する
  - TanStack Router は `document.startViewTransition` を直接呼び (router-core `router.js`)、React の `<ViewTransition>` には未対応
  - 2026-09-13 の `gh search prs "ViewTransition" --repo TanStack/router` は browser API 由来の PR のみ
- 再評価条件
  - concurrent stores (react/react #35449) が出荷したら、query が持つデータへの `useOptimistic` 適用を再評価する

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
