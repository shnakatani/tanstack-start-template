# ADR-0015: ブラウザテストのユーザー操作は実イベントだけで発火する

- Status: Accepted
- Date: 2026-09-22
- 関連: ADR-0013 (待機は retry API に委ねる。本 ADR は発火の側)、ADR-0058 (Action 層。「二重発火は state だけで塞ぐ」判断は、本 ADR の検証方法を前提にする)

## Context

決着前の二重発火を塞ぐ実装に、`useTransition` の `isPending` に加えて ref のフラグを要求するテストの形がある。

```tsx
button.element().dispatchEvent(new MouseEvent("click", { bubbles: true }));
button.element().dispatchEvent(new MouseEvent("click", { bubbles: true }));
expect(action).toHaveBeenCalledOnce();
```

`dispatchEvent` を同期に 2 回呼ぶと、1 回目のハンドラが積んだ state 更新は 2 回目より前に描画されない。フラグを外すとこのテストが落ち、フラグが「必要」に見える。
しかし実イベントでは 1 回のイベントごとに描画が済む。

| 論点                       | 根拠                                                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 実イベントの間に描画が済む | HTML 仕様「clean up after running script」は、スクリプトの実行コンテキストのスタックが空になるたびに microtask checkpoint を行う。React は SyncLane の描画を `queueMicrotask` で流す (react-dom 19.3.0 `scheduleImmediateRootScheduleTask`)                                  |
| React の保証               | reactwg/react-18 #21 は、ユーザー起点のイベントごとに次のイベントより前へ DOM 更新を終えると明言している                                                                                                                                                                     |
| 同期 2 連射                | `dispatchEvent` を同期に 2 回呼ぶとスタックが空にならず checkpoint が挟まらない。同一要素へ同期に 2 回 click が届くことは実イベントでは起きない (label の activation behavior のように別要素へ転送される click とは別の話)。これを固定したテストは実装に無用の防御を要求する |
| 実測 (2026-09-13)          | CDP 経由の実クリックと Enter の 2 連射で action は 1 回。`disabled={isPending}` を外した mutant では 2 回呼ばれて落ちる (Action 層の button / form と削除確認ダイアログの 2 連射テストで実測)                                                                                |

### 合成 click は実物から静かにずれる

`new MouseEvent("click", { bubbles: true })` で送る合成 click は、`cancelable` が既定の false になる。
実クリックと Enter 由来の click は cancelable=true かつ isTrusted=true である (2026-09-13、CDP 経由の実イベントで実測)。
非 cancelable のイベントはリスナーが `preventDefault` で止められない (MDN `Event.cancelable`) ため、Base UI の `useButton` が `aria-disabled` の submit ボタンで呼ぶ `preventDefault` が効かず、form の暗黙 submit がテストでだけ通る。

合成 click を実物へ寄せるとき、参照できる 3 つの実装はいずれも `bubbles` と `cancelable` を true にしている。

| 参照                                        | 属性                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| HTML 仕様「fire a synthetic pointer event」 | `HTMLElement.click()` の手順。`bubbles` と `cancelable` を true に初期化し、composed フラグを立て、`isTrusted` は false           |
| Playwright `locator.dispatchEvent()`        | 「Events are `composed`, `cancelable` and bubble by default」。docs/input は `HTMLElement.click()` の挙動を起こす手段と位置づける |
| testing-library `fireEvent.click`           | `event-map.js` の click は `bubbles` / `cancelable` / `composed` が true、`button` は 0                                           |

合わせる先が 3 つあり、`isTrusted` はどうやっても合わない。合成 click の helper を保守する限り、同じ種類のずれが入りうる。

### vitest browser mode の API

- `Locator` (`@vitest/browser` 4.1.11) に `dispatchEvent` は無い。`click()` の options は Playwright provider で `PWClickOptions` を継承し、`force` を持つ
- 弾かれる要素へ Playwright の `locator.dispatchEvent()` を届かせる公式経路はカスタムコマンド (`BrowserCommand`) で、`context.page` / `context.frame()` / `context.iframe` から Playwright の API を呼ぶ
- vitest-dev/vitest の issue には `aria-disabled` / `force` / `dispatchEvent` を主題にしたものが無い (2026-09-13、`gh search issues` を 9 語で検索)
- 合成 click を回避策に挙げる利用者は他のエコシステムにもいる (vitest-browser-svelte の scirexs/svseeds-ui)。`cancelable` を落とす点まで同じ形で、同じずれを踏んでいる

### ライブラリ自身のテスト

| ライブラリ | 二重発火・disabled のテストの書き方                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI    | `Button.test.tsx` の `focusableWhenDisabled` は user-event の `click` と `[Space]` / `[Enter]` を送り、ハンドラが 0 回であることを見る                                                                      |
| React Aria | `Button.test.js` の `isPending` は user-event の `click` を 2 回、`tab` + `{Enter}` を 2 回送り、pending を立てた後の submit が来ないことを見る。同期 2 連射は無く、pending の描画を挟んでから 2 回目を送る |

### 合成イベントを要求する場面は無い (2026-09-22 実測)

合成イベントを使う理由に挙がるのは 2 つある。inert バックドロップが pointer event を横取りすること、`aria-disabled="true"` の要素が Playwright の enabled 判定でタイムアウトすることである。どちらも合成イベントを要求しない。

**バックドロップは再現しない。** Dialog / AlertDialog の中のボタンを押す 4 箇所 (`src/routes/notes/index.test.tsx` の `confirmDelete` とキャンセル、`src/routes/notes/-components/note-create-dialog.test.tsx` の `clickSave` とキャンセル) は、`locator.click()` で browser project を全件走らせると全件通る。ADR-0018 の animation 無効化が効いているためではない。registry の AlertDialog を開いて実行ボタンを押す最小構成で、`enableAnimations()` の有無にかかわらず `.click()` が 130ms 台で通り、ハンドラが 1 回呼ばれる。

**enabled 判定に落ちる 2 箇所は、別々の解になる。** 分かれ目は対象に `pointer-events: none` が当たっているかである。`pointer-events: none` の対象を、click ハンドラを持つ器の上に重ねて、どちらにイベントが届くかを測った。

| 経路                             | 対象のハンドラ | 下の器のハンドラ  |
| -------------------------------- | -------------- | ----------------- |
| `.click({ force: true })`        | 0 回           | 1 回              |
| 合成 click を対象へ直接 dispatch | 1 回           | 1 回 (バブリング) |

`force` が飛ばすのは actionability の検査であって、ブラウザ自身のヒットテストは残る。対象が `pointer-events: none` なら、`force` のイベントは対象へ届かず下の要素へ落ちる。

### 2 箇所を mutant で測る

`src/components/parts/choice-card.test.tsx` の対象 (無効な行の label テキスト) には `pointer-events: none` が当たっていない。`Checkbox` への `disabled={disabled}` の転送を落とす mutant で測った。

| 経路                      | 健全                                                   | mutant |
| ------------------------- | ------------------------------------------------------ | ------ |
| `.click()`                | `locator.click: Timeout 3000ms exceeded.` で false red | 赤     |
| `.click({ force: true })` | 41ms で緑                                              | 赤     |

`force: true` が合成イベントと同じ検出力を持つ。この箇所は公式 API で書ける。

`src/components/parts/segmented-radio-group.test.tsx` の対象には `aria-disabled:pointer-events-none` が当たる。合成 click + `not.toHaveBeenCalled()` が固有に捕まえるのは、`aria-disabled` と `pointer-events: none` が正しいまま base-ui 内部のクリックガードだけが退行する場合に限られる。これは上流の担当で、base-ui 自身の `Button.test.tsx` が同じことを見ている (上表)。

合成 click の assert が無くても、クラスから `aria-disabled:pointer-events-none` を落とす mutant は `expected 'auto' to be 'none'` で 97ms のうちに捕まる。消費側が `disabled` を渡さなくなる退行は `aria-disabled` の assert が捕まえる。このリポジトリのコードを守る側は、合成イベント抜きで揃っている。

### テンプレートとして配る重さ

合成 click の helper を `src/test/` に置くと、このリポジトリを複製した利用者全員へ配られる。一方でそれを使いうる消費者は 2 つとも sample の部品である。利用者が sample を消すと、消費者ゼロの helper と、合成イベントという扱いの難しい手段だけが残る。上流ライブラリの内部を守るためにその重さを配らない。

## Decision

**ユーザー操作は実イベント (Playwright / CDP 経由) だけで発火する。合成イベント (`element.dispatchEvent`) は使わない。同期に 2 回 dispatch する検証は書かない。**

| 場面                                                  | 使うもの                                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定                                                  | `locator.click()`                                                                                                                                                         |
| Playwright に弾かれ、キーボードで同じ活性化が起こせる | `userEvent.tab()` で対象へフォーカスを移し (直前の実クリックで乗っているならそのまま) `userEvent.keyboard("{Enter}")`。キーボードは enabled / hit-target の判定を受けない |
| Playwright に弾かれ、pointer 経由の click が要る      | `.click({ force: true })`。対象に `pointer-events: none` が当たっていないことを先に確かめる                                                                               |
| 無効化された要素が反応しないことの検証                | `pointer-events` と状態属性で見る。イベントを対象へ届かせてライブラリ内部のガードまで見に行かない                                                                         |
| 決着前の二重発火の検証                                | 上の実イベントを 2 回。`await Promise.resolve()` で間隔を作らない                                                                                                         |

判定に落ちた条件は Playwright のエラー文言で確かめてから行を選ぶ (`.claude/rules/testing.md`「クリックの発火方法」)。

`.click()` が弾く条件は Playwright の Actionability が定める Visible / Stable / Receives Events / Enabled である。このリポジトリで弾かれる典型を次に置く。

| 条件               | 落ちる例                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Enabled            | native `disabled`、`aria-disabled="true"` の祖先を持つ要素                                                            |
| Stable             | 開閉アニメーションの途中。既定では ADR-0018 の無効化で即座に終わる。animation を戻したテストでは settled を待って押す |
| Visible / viewport | `sr-only` の 1px + clip。`getByRole(..., { name })` で本体を掴む                                                      |
| Receives Events    | base-ui のバックドロップ (`data-base-ui-inert`)、`pointer-events: none`                                               |

`force: true` はこの検査をまとめて飛ばす。animation を戻したテストでは、スライドイン途中の要素が "Element is outside of the viewport" で落ちる。viewport 内の座標の確認は公式の 4 条件の定義に書かれておらず、`playwright-core` の `_performPointerAction` が行う (ソースの読み取りで、公式 docs では未確認)。

`force: true` を選ぶ前に、対象へイベントが届くかを確かめる。`force` は actionability の検査を飛ばすだけで、ブラウザのヒットテストは越えない。届かない対象に使うと、押した結果を見る assert が `pointer-events` から導かれるだけのものに変わる。

### 検討した選択肢

| 案                                                                | 評価                                                                                                                                               | 採否     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 実イベント (`click()` と `userEvent.keyboard`) で 2 連射する      | 実装の仕組み (描画のタイミング) をテストに書かない。Base UI と React Aria 自身のテストと同じ形。mutant で落ちることを確認済み                      | **採用** |
| 合成イベントの間に `await Promise.resolve()` を挟む               | ブラウザが実イベント間で行う checkpoint の模倣で、React の描画が microtask で流れる知識をテストに焼き込む。React 側の実装が変わると意味が変わる    | 却下     |
| 合成イベントの同期 2 連射を残し、実装に ref のフラグを持つ        | 起きない事象への防御をテストが要求する形。react.dev の `disabled={pending}` の形から外れる (ADR-0058)                                              | 却下     |
| 2 回目を `click({ force: true })` で送る                          | `data-disabled:pointer-events-none` の部品では下の要素へ届き、何が止めたか分からない。キーボードなら部品自身に届く                                 | 却下     |
| 合成 click の helper を置き、用途を 1 つに絞る                    | 消費者が sample の部品だけになる。テンプレートの利用者が sample を消すと、消費者ゼロの helper が配られたままになる                                 | 却下     |
| 合成 click で base-ui 内部のガードを見続ける                      | 守る対象が上流ライブラリの内部で、base-ui 自身のテストが同じことを見ている。このリポジトリのコードは `pointer-events` と状態属性の assert で守れる | 却下     |
| カスタムコマンドで Playwright の `locator.dispatchEvent()` を呼ぶ | 公式経路だが、server 側のコマンド定義と型拡張が要る。合成イベントを使う場面が無いので不要                                                          | 却下     |

## Consequences

- 合成イベントを送る helper は `src/test/` に置かない
- ダイアログ内のボタンは `locator.click()` で押す (`src/routes/notes/index.test.tsx` の `confirmDelete` とキャンセル、`src/routes/notes/-components/note-create-dialog.test.tsx` の `clickSave` とキャンセル)
- `src/components/parts/choice-card.test.tsx` は `.click({ force: true })` で押す。対象に `pointer-events: none` が無く、click が実際に届く
- `src/components/parts/segmented-radio-group.test.tsx` はクリックが届かないことを `pointer-events` の assert で見る。合成 click と `not.toHaveBeenCalled()` は使わない
- 二重発火のテストは `click()` と `userEvent.keyboard("{Enter}")` の実イベントで書く
- `.claude/rules/testing.md`「クリックの発火方法」は「`.click()` → キーボード → `.click({ force: true })`」の順序と、`force` がヒットテストを越えないことを持つ
- 合成イベントを足したくなったら、この ADR へ戻って却下の根拠を読む。`force: true` で届くかを先に測り、届くなら合成イベントは要らない

`cancelable` を実イベントに合わせる手順は、合成イベントごと消えたので持たない。2026-09-13 に `cancelable` の既定が false で Base UI の `preventDefault` が効かず、実物では止まる form 送信がテストでだけ通った。合成イベントの属性を実物へ合わせ続ける保守は、この種の食い違いを生む側に回る。

導入時に inert バックドロップを理由として書いたのは、`.click()` が落ちた事象をバックドロップに帰属させ、他の原因と切り分けなかったためである。2026-09-22 の再実測では、どの経路でも再現しなかった。

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
