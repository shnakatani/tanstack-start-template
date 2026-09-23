# ADR-0019: mutation は Action 層の `action` prop から `useActionMutation` で呼び、二重発火は state だけで塞ぐ

- Status: Accepted
- Date: 2026-09-14
- 関連: ADR-0017 (ユーザー操作による更新は Transition を既定にする)、ADR-0020 (完了点とブロック範囲の軸)、ADR-0037 (二重発火の検証は実イベントで書く)、ADR-0024 (registry コードは触らない。Action 層は registry の外に置く)、ADR-0012 (配置の原則)

## Context

### 決定時点のコード (2026-09-13)

pending 表示は TanStack Query の mutation が持つ `isPending` から取っていた。
`startTransition` / `useTransition` / `useDeferredValue` / `useOptimistic` を使う箇所は `src/` に無かった。

```bash
grep -rn "useTransition\|startTransition\|useDeferredValue\|useOptimistic" src/   # 2026-09-13: 0 件
grep -rln "useMutation(" src/ --include='*.tsx'                                   # 2026-09-13: 2 ファイル
```

mutation を持つのは `src/routes/notes/-components/note-create-dialog.tsx` (追加) と `src/routes/notes/index.tsx` (削除) の 2 箇所だった。
どちらも `onSuccess` の中で `invalidateQueries` を `void` した直後にダイアログを `close()` していた。
削除の二重発火は `src/components/parts/delete-confirm-dialog.tsx` の `deleteConfirmMutationProps` が閉包のフラグで塞いでいた。コード上の理由は「`isPending` は再レンダー後にしか立たず、それより前に届く再クリックを `disabled` では止められない」だったが、この前提は実測されていなかった (2026-09-13 に React の pending 描画は次のユーザーイベントより前に流れると確認した)。

mutation 以外のユーザー操作由来の更新は、`src/components/screens/route-error.tsx` の `handleRetry` (Error Boundary の `reset()` と `router.invalidate()`) と、ダイアログの開閉 (Base UI の handle) があった。

ルート遷移は既に Transition である。
`@tanstack/router-core` は match の commit を `router.startTransition` へ渡し (`load-client.js`)、`@tanstack/react-router` の `Transitioner` がそれを `React.startTransition` で包む。
2026-09-13 に router-core 1.171.27 と react-router 1.170.32 の dist で確認した。

### 制約: registry の Button に action prop は無い

`src/components/ui/button.tsx` は shadcn registry の出力で、改変は ADR-0024 の許容リストに限る。
包んでいる `@base-ui/react` 1.8.0 の Button の props は `NativeButtonProps` と `focusableWhenDisabled` だけで、`action` / pending 相当の prop は無い (`node_modules/@base-ui/react/button/Button.d.ts`)。

| ライブラリ | 状況 (2026-09-13)                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base UI    | mui/base-ui #5133 (2026-06-27) が `action` / `on*ChangeAction` を提案。ラベル「waiting for 👍」、メンテナ返信なし                                                        |
| React Aria | adobe/react-spectrum #9894 (2026-04-08) が `action` / `changeAction` / `isPending` / `actionError` の RFC。2026-07-17 に実装を別 PR へ分割すると表明、merge 済み実装なし |
| shadcn/ui  | issue なし。Button のドキュメントは disabled + Spinner の例だけ                                                                                                          |

### 制約: Action の reject は Error Boundary へ届く

`useTransition` リファレンスは、`startTransition` に渡した関数が throw または reject すると最寄りの Error Boundary が fallback を出すと書く。
操作の失敗は Error Boundary へ届けず、toast か画面内表示で通知する。Error Boundary は画面ごと差し替わるためである。両立させるには、Action の中で失敗を処理し切る必要がある。

## Decision

**mutation は `src/components/action/` の部品の `action` prop から、`useActionMutation` の `runAction` で呼ぶ。決着前の二重発火は Transition の `isPending` だけで塞ぐ。**

### Action 層 `src/components/action/`

`src/components/ui/` を包み、`action` prop を受ける部品を置く。ファイル名は包む先と同名にする (`button.tsx` → `ActionButton`)。
最初に置くのは `button.tsx`、`alert-dialog.tsx`、`form.tsx` の 3 つで、メモ画面の 2 経路が使う最小集合である。`form.tsx` だけは `ui/` に対応部品が無く、素の `<form>` を包む。
React の `<form action>` + `useFormStatus` を使わないのは、submit の経路を TanStack Form の `handleSubmit` (FormData を経由しない) にするためと、決着前の二重 submit を部品側の dedupe で塞ぐためである。`ActionForm` の context は `useFormStatus` と同じ形で pending を子孫へ渡す。

| 契約     | 内容                                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action` | `() => Promise<void> \| void`。`startTransition` に直接渡す (同期 / 非同期どちらも受け、決着まで pending が続く)                                                                                                                                                                                                                                                                               |
| pending  | `useTransition` の `isPending`。`aria-disabled` と `focusableWhenDisabled` でフォーカスを保つ。名前は `aria-labelledby` で children に固定する。`Spinner` は視覚専用 (`aria-hidden`)。状態は要素自身の `aria-busy` + `aria-disabled` で持ち、通知は feature 側が announcer で出す (ADR-0032)。button の子孫はユーザーエージェントが accessibility API に露出すべきでない (WAI-ARIA 1.2 §5.2.9) |
| 二重発火 | 決着前の再クリックは `isPending` (`aria-disabled`) が塞ぐ。ref や閉包のフラグは持たない (「二重発火は state だけで塞ぐ」)                                                                                                                                                                                                                                                                      |
| 失敗     | 部品は握らない。呼び出し側が Action の中で処理し切る (「Action の reject は Error Boundary へ届く」)。mutation は次項の `useActionMutation` を通す                                                                                                                                                                                                                                             |
| 基盤依存 | 契約は Base UI に依存しない。Base UI #5133 か React Aria #9894 が出荷したら内部実装だけ差し替える                                                                                                                                                                                                                                                                                              |

### 二重発火は state だけで塞ぐ

react.dev が示す形は `useTransition` の `disabled={isPending}` と `useFormStatus` の `disabled={pending}` で、どちらも state だけで決着前の再操作を止める。`useActionState` は再操作を queue に積み、拒否しない。
React はユーザー起点のイベントごとに次のイベントより前へ DOM 更新を終える (reactwg/react-18 #21) ので、2 回目の実イベントは `aria-disabled` の部品に届き、Base UI が click を止める。

「同期に 2 回 dispatch すると `isPending` の描画前に 2 回目が届く」ことを理由に ref のフラグを併せ持つ形は採らない。この事象は実イベントでは起きず、フラグはその検証を通すためだけのものになる。検証を実イベントで書く根拠は ADR-0037 が持つ。

完了点 (a) (ADR-0020) では Action が close だけを含み Transition が確定直後に終わるため、close の animate-out の間は `isPending` の dedupe が効かない。同じ対象の mutation が pending なら handler を no-op にする (`queryClient.isMutating` の判定)。実例は `src/routes/notes/index.tsx` の `confirmDelete`。

### mutation の書き方

mutation は `src/hooks/use-action-mutation.ts` の `useActionMutation` を通す。`useMutation` の薄い wrapper で、次を持つ。

| 項目                    | 規範                                                                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 入力                    | `useMutation` の options。型で `onError` を必須にする。省略すると reject の吸収が無通知の失敗になるため、型で止める                                                                                                                                                                 |
| 出力                    | `useMutation` の戻り値から `mutate` / `mutateAsync` を型で外し、`runAction(variables): Promise<void>` を足す。`runAction` は `mutateAsync` を await し、reject を吸収する。通知は `onError` (`toastMutationError`) が担う                                                           |
| 呼び出し                | `action` prop から `runAction` を呼ぶ。`mutate` は Promise を返さず reject も `.catch(noop)` で握るため、Transition が完了も失敗も観測できない (`useMutation.js`)                                                                                                                   |
| 再取得と close          | `onSuccess` は完了点によらず再取得の Promise を返す (TanStack Query は `onSuccess` の Promise を待つので、その間 `isPending` が続く)。閉じる時点は ADR-0020 で選び、(c) では再取得を await した後に `handle.close()`、(b) では先頭で `close()`、(a) では Action 側で `close()` する |
| `await` 後の state 更新 | 書かない。Action の中で `await` の後に set すると Transition から外れる (`useTransition` の既知の制限)。画面の更新は query の再取得に任せる                                                                                                                                         |

### 検討した選択肢

| 案                                                            | 評価                                                                                                                                                                | 採否     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| app 層に `src/components/action/` を置き `action` prop で包む | React Conf 2025 デモと同じ構造。registry を触らず (ADR-0024)、基盤にも依存しない。dedupe と pending の実装が 1 箇所に集まる                                         | **採用** |
| ref や閉包のフラグで同一タスク内の 2 連射も塞ぐ               | 実イベントでは起きない事象への防御で、その検証を書くためだけにフラグが要る (ADR-0037)。react.dev の形 (`disabled={pending}`) から外れる                             | 却下     |
| 呼び出し側ごとに `useTransition` を書く                       | 決着前の dedupe と a11y の状態伝達を毎回書き直す。`deleteConfirmMutationProps` の閉包と同じ形が箇所ごとに散る                                                       | 却下     |
| Base UI #5133 か React Aria #9894 の出荷を待つ                | どちらも 2026-09-13 時点で merge 済み実装が無く、時期も未定                                                                                                         | 却下     |
| 基盤を React Aria へ替えて action prop を待つ                 | shadcn CLI は `--base aria` を持つが、shadcn-ui/ui #11724 (2026-09-01) の実測で API parity が無く porting になる。Action 層は基盤非依存なので、この判断と切り離せる | 別 ADR   |

## Consequences

- `useActionMutation` を通さない Action の reject は Error Boundary へ届く (「Action の reject は Error Boundary へ届く」)。lint で検出できないため、Action を書くときのレビュー観点に含める
- 後続作業
  - 値を持つ部品の `changeAction` 版 (`checkbox` / `select` / `toggle` / `toggle-group` / `radio-group` / `combobox`)。`useOptimistic` で表示を先に進める設計が要り、Button 系とは別に扱う
  - React Aria への基盤変更の ADR。発火条件は「React Aria #9894 の実装が出荷した」か「a11y 要件で Base UI に不足が出た」のどちらか
- 再評価条件
  - Base UI #5133 か React Aria #9894 が出荷したら、Action 層の内部実装をライブラリの `action` prop へ寄せる

## 出典

- React Conf 2025 Async React デモ: https://github.com/rickhanlonii/async-react
- `useTransition` リファレンス: https://react.dev/reference/react/useTransition
- `<form>` / `useFormStatus` リファレンス: https://react.dev/reference/react-dom/components/form / https://react.dev/reference/react-dom/hooks/useFormStatus
- reactwg/react-18 #21 Automatic batching for fewer renders in React 18: https://github.com/reactwg/react-18/discussions/21
- TanStack Query「Invalidations from Mutations」: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
- mui/base-ui #5133 First class support for async react primitives: https://github.com/mui/base-ui/issues/5133
- adobe/react-spectrum #9894 RFC: Adopting Async React in React Aria Components: https://github.com/adobe/react-spectrum/pull/9894
- shadcn-ui/ui #11724 Bundle size audit across base / aria / radix: https://github.com/shadcn-ui/ui/issues/11724
