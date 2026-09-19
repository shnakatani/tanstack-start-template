# ADR-0015: ブラウザテストのユーザー操作は実イベントで発火し、合成イベントは実イベントと同じ属性で送る

- Status: Accepted
- Date: 2026-09-13
- 関連: ADR-0013 (待機は retry API に委ねる。本 ADR は発火の側)。PR #16 (Action 層の導入) が持つ「二重発火を state だけで塞ぐ」判断は、本 ADR の検証方法を前提にする

## Context

PR #16 (Action 層の導入) の初期実装では、決着前の二重発火を塞ぐ実装に `useTransition` の `isPending` に加えて ref のフラグが入っていた。
フラグを要求していたのは次の形のテストである。

```tsx
dispatchNativeClick(button.element());
dispatchNativeClick(button.element());
expect(action).toHaveBeenCalledOnce();
```

`dispatchEvent` を同期に 2 回呼ぶと、1 回目のハンドラが積んだ state 更新は 2 回目より前に描画されない。フラグを外すとこのテストが落ち、フラグが「必要」に見えた。
しかし実イベントでは 1 回のイベントごとに描画が済む。

| 論点                       | 根拠                                                                                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実イベントの間に描画が済む | HTML 仕様「clean up after running script」は、スクリプトの実行コンテキストのスタックが空になるたびに microtask checkpoint を行う。React は SyncLane の描画を `queueMicrotask` で流す (react-dom 19.3.0 `scheduleImmediateRootScheduleTask`)                                                               |
| React の保証               | reactwg/react-18 #21 は、ユーザー起点のイベントごとに次のイベントより前へ DOM 更新を終えると明言している                                                                                                                                                                                                  |
| 同期 2 連射                | `dispatchEvent` を同期に 2 回呼ぶとスタックが空にならず checkpoint が挟まらない。同一要素へ同期に 2 回 click が届くことは実イベントでは起きない (label の activation behavior のように別要素へ転送される click とは別の話)。これを固定したテストは実装に無用の防御を要求する                              |
| 実測 (2026-09-13)          | CDP 経由の実クリックと Enter の 2 連射で action は 1 回。`disabled={isPending}` を外した mutant では 2 回呼ばれて落ちる (PR #16 の `src/components/action/button.test.tsx` / `form.test.tsx` / `src/components/parts/delete-confirm-dialog.test.tsx` の 2 連射テスト、2026-09-13 の PR #16 branch で実測) |

### 合成 click の属性

`src/test/native-click.ts` の `dispatchNativeClick` は `new MouseEvent("click", { bubbles: true })` を送っており、`cancelable` は既定の false だった。
実クリックと Enter 由来の click は cancelable=true かつ isTrusted=true である (2026-09-13、CDP 経由の実イベントで実測)。
非 cancelable のイベントはリスナーが `preventDefault` で止められない (MDN `Event.cancelable`) ため、Base UI の `useButton` が `aria-disabled` の submit ボタンで呼ぶ `preventDefault` が効かず、form の暗黙 submit がテストでだけ通っていた。

合成 click の属性は、参照した 3 つの実装がいずれも `bubbles` と `cancelable` を true にしている。

| 参照                                        | 属性                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| HTML 仕様「fire a synthetic pointer event」 | `HTMLElement.click()` の手順。`bubbles` と `cancelable` を true に初期化し、composed フラグを立て、`isTrusted` は false           |
| Playwright `locator.dispatchEvent()`        | 「Events are `composed`, `cancelable` and bubble by default」。docs/input は `HTMLElement.click()` の挙動を起こす手段と位置づける |
| testing-library `fireEvent.click`           | `event-map.js` の click は `bubbles` / `cancelable` / `composed` が true、`button` は 0                                           |

### vitest browser mode の API

- `Locator` (`@vitest/browser` 4.1.11) に `dispatchEvent` は無い。`click()` の options は Playwright provider で `PWClickOptions` を継承し、`force` を持つ
- 弾かれる要素へ Playwright の `locator.dispatchEvent()` を届かせる公式経路はカスタムコマンド (`BrowserCommand`) で、`context.page` / `context.frame()` / `context.iframe` から Playwright の API を呼ぶ
- vitest-dev/vitest の issue には `aria-disabled` / `force` / `dispatchEvent` を主題にしたものが無い (2026-09-13、`gh search issues` を 9 語で検索)。#5770 (Interactivity API の設計) のコメントで利用者が raw の `document.dispatchEvent(new KeyboardEvent(...))` を回避策に挙げるだけ
- 同じ問題に当たった例として、vitest-browser-svelte 利用者が「`userEvent.click` は `aria-disabled` に届かず、`new MouseEvent("click", { bubbles: true })` なら届く」と記録している (scirexs/svseeds-ui)。`cancelable` を落とす点まで同じ形

### ライブラリ自身のテスト

| ライブラリ | 二重発火・disabled のテストの書き方                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI    | `Button.test.tsx` の `focusableWhenDisabled` は user-event の `click` と `[Space]` / `[Enter]` を送り、ハンドラが 0 回であることを見る                                                                      |
| React Aria | `Button.test.js` の `isPending` は user-event の `click` を 2 回、`tab` + `{Enter}` を 2 回送り、pending を立てた後の submit が来ないことを見る。同期 2 連射は無く、pending の描画を挟んでから 2 回目を送る |

## Decision

**ユーザー操作は実イベント (Playwright / CDP 経由) で発火する。合成イベントは Playwright に弾かれる要素に限り使い、実イベントと同じ `bubbles` / `cancelable` で送る。同期に 2 回 dispatch する検証は書かない。**

| 場面                                                                                    | 使うもの                                                                                                                                                     |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 既定                                                                                    | `locator.click()`                                                                                                                                            |
| 決着前の 2 回目以降の操作 (`aria-disabled` で Playwright の enabled 判定に落ちる)       | `userEvent.keyboard("{Enter}")` (フォーカスは `element.focus()` で移してよい)。キーボードは enabled / hit-target の判定を受けない                            |
| Playwright に弾かれる要素 (バックドロップ越し等) で、キーボードでも同じ活性化が起こせる | `element.focus()` + `userEvent.keyboard("{Enter}")`。判定に落ちた条件は Playwright のエラー文言で確かめる (`.claude/rules/testing.md`「クリックの発火方法」) |
| Playwright に弾かれ、pointer 経由の click そのものが要る                                | `dispatchNativeClick` (`src/test/native-click.ts`)。合成イベントを使うのはこの場面だけ                                                                       |
| 決着前の二重発火の検証                                                                  | 上の実イベントを 2 回。`await Promise.resolve()` や合成イベントの同期 2 連射で間隔を作らない                                                                 |

合成イベントを新設・変更するときは、同じ操作を実イベントで起こして `bubbles` / `cancelable` / `isTrusted` を実測し、`isTrusted` 以外を合わせる (`isTrusted` はスクリプトから true にできない)。
`composed` は shadow DOM を使うまで既定のままにする。

### 検討した選択肢

| 案                                                                | 評価                                                                                                                                                          | 採否     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 実イベント (`click()` と `userEvent.keyboard`) で 2 連射する      | 実装の仕組み (描画のタイミング) をテストに書かない。Base UI と React Aria 自身のテストと同じ形。mutant で落ちることを確認済み                                 | **採用** |
| 合成イベントの間に `await Promise.resolve()` を挟む               | ブラウザが実イベント間で行う checkpoint の模倣で、React の描画が microtask で流れる知識をテストに焼き込む。React 側の実装が変わると意味が変わる               | 却下     |
| 合成イベントの同期 2 連射を残し、実装に ref のフラグを持つ        | 起きない事象への防御をテストが要求する形。react.dev の `disabled={pending}` の形から外れる (ADR-0014)                                                         | 却下     |
| 2 回目を `click({ force: true })` で送る                          | `data-disabled:pointer-events-none` の部品では下の要素へ届き、何が止めたか分からない。キーボードなら部品自身に届く                                            | 却下     |
| `dispatchNativeClick` の `cancelable` を既定 (false) のまま残す   | Base UI の `preventDefault` が効かず、実物では止まる form 送信がテストでは通る。参照できる実装 (HTML 仕様、Playwright、testing-library) のどれとも違う        | 却下     |
| カスタムコマンドで Playwright の `locator.dispatchEvent()` を呼ぶ | 公式経路だが、server 側のコマンド定義と型拡張が要る。合成 click 1 種のためには `MouseEvent` を 1 行で作るほうが小さい。合成イベントの種類が増えたら再評価する | 見送り   |

## Consequences

- `dispatchNativeClick` は cancelable=true を送る。`src/test/native-click.test.tsx` が submit ボタンの `preventDefault` で form 送信が止まることを固定する
- 二重発火のテストは `click()` と `userEvent.keyboard("{Enter}")` の実イベントで書き、`dispatchNativeClick` を使わない
- `.claude/rules/testing.md`「クリックの発火方法」の順序を「`.click()` → キーボード → `dispatchNativeClick`」にする。既存テストの `dispatchNativeClick` は触らず、新規と改修から適用する
- `.claude/rules/testing.md`「クリックの発火方法」に、同期 2 連射を書かない項目を足す
- 合成イベントを足すときの実測は手順として残す。キーボードでも起こせない操作だけが合成の対象で、そのときも属性は実イベントに合わせる
- 再評価条件: 合成イベントの種類が 2 つ以上になったら、カスタムコマンド経由の `locator.dispatchEvent()` へ寄せるかを判断する

## 出典

- HTML Standard「clean up after running script」: https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script
- HTML Standard「fire a synthetic pointer event」: https://html.spec.whatwg.org/multipage/webappapis.html#fire-a-synthetic-pointer-event
- reactwg/react-18 #21 Automatic batching for fewer renders in React 18: https://github.com/reactwg/react-18/discussions/21
- MDN `Event.cancelable`: https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable
- Playwright Actions「Programmatic click」: https://playwright.dev/docs/input#programmatic-click
- Playwright `locator.dispatchEvent()`: https://playwright.dev/docs/api/class-locator#locator-dispatch-event
- Playwright Actionability (`force` が飛ばす判定、Enabled / Receives Events の定義): https://playwright.dev/docs/actionability
- vitest Interactivity API (CDP / webdriver でイベントを偽装しない): https://vitest.dev/guide/browser/interactivity-api
- vitest Locators: https://vitest.dev/api/browser/locators
- vitest Commands (カスタムコマンドから Playwright の `page` / `frame` を使う): https://vitest.dev/guide/browser/commands
- vitest-dev/vitest #5770 Interactivity API for Browser Mode: https://github.com/vitest-dev/vitest/issues/5770
- testing-library `event-map.js`: https://github.com/testing-library/dom-testing-library/blob/main/src/event-map.js
- Base UI `Button.test.tsx`: https://github.com/mui/base-ui/blob/master/packages/react/src/button/Button.test.tsx
- React Aria Components `Button.test.js`: https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/test/Button.test.js
- scirexs/svseeds-ui「userEvent.click is a no-op on aria-disabled elements」: https://github.com/scirexs/svseeds-ui/blob/main/.ws/knowledge/vitest-browser-userevent-skips-aria-disabled.md
