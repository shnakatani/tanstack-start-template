# テストのユーザー操作

ブラウザテストでユーザー操作を発火する手段と、animation・入力部品・debounce の扱いを持つ。

| 決定                                                                                               | ADR      |
| -------------------------------------------------------------------------------------------------- | -------- |
| mutation は Action 層の `action` prop から `useActionMutation` で呼び、二重発火は state だけで塞ぐ | ADR-0016 |
| 数値入力に `type="number"` を使わず Base UI の NumberField に寄せる                                | ADR-0021 |

## how-to

### クリックを発火する

手段は場面で決める。合成イベントは使わない (「合成イベントが実物からずれる理由」)。`.click()` が弾かれたら、Playwright のエラー文言が示す条件を読んでから行を選ぶ。通るまで手段を替えると、実物で起きない事象を固定する。

| 場面                                                  | 使うもの                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定                                                  | `locator.click()`                                                                                                                                                          |
| Playwright に弾かれ、キーボードで同じ活性化が起こせる | `userEvent.tab()` で対象へフォーカスを移し (直前の実クリックで乗っているならそのまま)、`userEvent.keyboard("{Enter}")`。キーボードは enabled / hit-target の判定を受けない |
| Playwright に弾かれ、pointer 経由の click が要る      | `.click({ force: true })`。対象に `pointer-events: none` が当たっていないことを先に確かめる                                                                                |
| 無効化された要素が反応しないことの検証                | `pointer-events` と状態属性で見る。イベントを対象へ届かせて、ライブラリ内部のガードまで見に行かない                                                                        |
| 決着前の二重発火の検証                                | 上の実イベントを 2 回。`await Promise.resolve()` で間隔を作らない                                                                                                          |

`.click()` が弾く条件は、Playwright の Actionability が定める Visible / Stable / Receives Events / Enabled である。このリポジトリで弾かれる典型は次のとおり。

| 条件               | 落ちる例                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Enabled            | native `disabled`、`aria-disabled="true"` の祖先を持つ要素                                                             |
| Stable             | 開閉アニメーションの途中。既定では animation の無効化で即座に終わる。animation を戻したテストでは settled を待って押す |
| Visible / viewport | `sr-only` の 1px + clip。`getByRole(..., { name })` で本体を掴む                                                       |
| Receives Events    | base-ui のバックドロップ (`data-base-ui-inert`)、`pointer-events: none`                                                |

- `force: true` はこの検査をまとめて飛ばす。animation を戻したテストでは、スライドインの途中の要素が "Element is outside of the viewport" で落ちる。viewport 内の座標の確認は公式の 4 条件の定義に無く、`playwright-core` の `_performPointerAction` が行う (ソースの読み取りで、公式 docs では未確認)
- 合成イベントを足したくなったら、先に `force: true` で届くかを測る。届くなら合成イベントは要らない

### スクロールさせる

`userEvent.wheel` をスクロールの手段にしない。wheel は `wheel` イベントを聞く UI (拡大縮小、横スクロールのタブ、canvas) を検証するための操作で、スクロールが終わるのを待たずに返る。

| 目的                               | 書き方                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| 要素を表示させてから操作する       | locator の操作 (`click()` など) に任せる。操作の前に自動でスクロールする |
| スクロール位置そのものが要る       | `element().scrollTop = n` か `element().scrollIntoView()` で作る         |
| `wheel` イベントへの反応を検証する | `userEvent.wheel`                                                        |

### animation を戻すテストを書く

animation は `src/test/browser/browser-setup.tsx` が毎テスト止める (「animation を無効にして走らせる理由」)。閉じかけの popup が残る窓そのもの (二重発火の dedupe など) を検証するテストだけ、次の形で戻す。

- 本文の先頭で `await enableAnimations()` を呼ぶ。次のテストの `beforeEach` が既定へ戻すので、戻す処理は書かない (`parkMouse` と同じ形)
- 無限アニメーション (Spinner) は既定で 1 周して止まる。rect や算出スタイルは `expect.poll` の中で読むので、残る 0.01ms も待たない
- 既定では閉じた popup が次の描画で unmount するので、`data-ending-style` は観測できない
- popup を閉じた後に `expectNoA11yViolations()` を呼ぶときは、先に popup の要素を `expectRemoved()` で待つ。既定では窓が無いが、animation を戻したテストでも同じ形で書く
- 閉じた後の行の取得に `includeHidden` を渡さない。既定では確定直後の行が `aria-hidden` の配下に残らない。モーダルが開いている間の取得には引き続き要る
- transition の後に「変化しないこと」を見るテスト (実例は `src/components/parts/segmented-radio-group.test.tsx` の hover) は、retry では途中値の前に通ってしまう。animation を戻したら、変化する側の値を先に待ってから見る
- モジュールの最上位で描画や算出値を読まない。`beforeEach` より前に走るので、前のファイルが残した emulation を読む

### 入力部品を操作する

- `NumberField` (ADR-0021) のロールは `spinbutton` ではなく `textbox` になる。`getByRole("textbox")` で取る
- locator の `fill()` は、controlled な `type="text"` では既存の値を置き換えず追記になる。要素を全選択してから打つ

### debounce のある入力をテストする

- debounce のテストは、1 文字ずつ別の `userEvent.keyboard` で打つ。`fill` は 1 回の input、`type("abc")` は 3 文字を間を置かず送るので、どちらも debounce の欠落を検出しない (2026-09-23 に mutant で実測)
- fake timers は使わない。browser mode では locator の操作が fake timer を進めない (vitest-dev/vitest の issue 10058)。待ちを広げたいときは、定数を `vi.mock(import(...))` の partial mock で広げる
- 実例は `src/routes/notes/-components/notes-page.test.tsx` と `src/routes/notes/index.test.tsx`

## explanation

### 合成イベントが実物からずれる理由

ユーザー操作は実イベント (Playwright / CDP 経由) だけで発火する。合成イベント (`element.dispatchEvent`) は使わず、同期に 2 回 dispatch する検証も書かない。

`new MouseEvent("click", { bubbles: true })` で送る合成 click は、`cancelable` が既定の false になり、`isTrusted` も false になる。実クリックと Enter 由来の click は両方 true である (2026-09-13、CDP 経由の実イベントで実測)。非 cancelable のイベントはリスナーが `preventDefault` で止められない (MDN `Event.cancelable`) ので、`aria-disabled` の submit ボタンで Base UI の `useButton` が呼ぶ `preventDefault` が効かず、form の暗黙 submit がテストでだけ通る。

合成 click を実物へ寄せるとき、参照できる実装は 3 つあり、どれも `bubbles` と `cancelable` を true にしている。`isTrusted` はどうやっても合わないので、合成 click の helper を保守する限り同じ種類のずれが入りうる。

| 参照                                        | 属性                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| HTML 仕様「fire a synthetic pointer event」 | `HTMLElement.click()` の手順。`bubbles` と `cancelable` を true に初期化し、composed フラグを立て、`isTrusted` は false           |
| Playwright `locator.dispatchEvent()`        | 「Events are `composed`, `cancelable` and bubble by default」。docs/input は `HTMLElement.click()` の挙動を起こす手段と位置づける |
| testing-library `fireEvent.click`           | `event-map.js` の click は `bubbles` / `cancelable` / `composed` が true、`button` は 0                                           |

同期に 2 回 dispatch すると、1 回目のハンドラが積んだ state 更新は 2 回目より前に描画されない。実イベントでは 1 回ごとに描画が済むので、この形を固定したテストは実装に無用の防御 (ref のフラグ) を要求する。根拠と実測は ADR-0016「二重発火は state だけで塞ぐ」が持つ。ライブラリ自身のテストも同期 2 連射を書かない。

| ライブラリ | 二重発火・disabled のテストの書き方                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI    | `Button.test.tsx` の `focusableWhenDisabled` は user-event の `click` と `[Space]` / `[Enter]` を送り、ハンドラが 0 回であることを見る                                                                      |
| React Aria | `Button.test.js` の `isPending` は user-event の `click` を 2 回、`tab` + `{Enter}` を 2 回送り、pending を立てた後の submit が来ないことを見る。同期 2 連射は無く、pending の描画を挟んでから 2 回目を送る |

合成イベントを要求する場面は無い (2026-09-22 実測)。理由に挙がる 2 つはどちらも合成イベントを要求しない。

- inert バックドロップが pointer event を横取りする件は再現しない。Dialog / AlertDialog の中のボタンを押す 4 箇所 (`src/routes/notes/index.test.tsx` の `confirmDelete` とキャンセル、`src/routes/notes/-components/note-create-dialog.test.tsx` の `clickSave` とキャンセル) は `locator.click()` で全件通る。registry の AlertDialog の最小構成でも、`enableAnimations()` の有無にかかわらず `.click()` が 130ms 台で通る
- `aria-disabled="true"` の要素が Playwright の enabled 判定でタイムアウトする 2 箇所は、対象に `pointer-events: none` が当たっているかで解が分かれる。`src/components/parts/choice-card.test.tsx` の対象には当たっておらず、`Checkbox` への `disabled` の転送を落とす mutant で測ると `.click()` は false red、`.click({ force: true })` は 41ms で緑になり mutant で赤になる。`src/components/parts/segmented-radio-group.test.tsx` の対象には当たっており、クリックが届かないことを `pointer-events` の assert (`expected 'auto' to be 'none'` を 97ms で捕まえる) と `aria-disabled` の assert で見る
- `pointer-events: none` の対象を click ハンドラを持つ器の上に重ねて、どちらにイベントが届くかを測った (2026-09-22)。`force` が飛ばすのは actionability の検査で、ブラウザのヒットテストは残るので、`force` のイベントは対象へ届かず下の要素へ落ちる

| 経路                             | 対象のハンドラ | 下の器のハンドラ  |
| -------------------------------- | -------------- | ----------------- |
| `.click({ force: true })`        | 0 回           | 1 回              |
| 合成 click を対象へ直接 dispatch | 1 回           | 1 回 (バブリング) |

- vitest の `Locator` (`@vitest/browser` 4.1.11) に `dispatchEvent` は無い。Playwright の `locator.dispatchEvent()` を届かせる公式経路はカスタムコマンド (`BrowserCommand`) だけである。vitest-dev/vitest の issue には `aria-disabled` / `force` / `dispatchEvent` を主題にしたものが無い (2026-09-13、`gh search issues` を 9 語で検索)

合成 click の helper を `src/test/` に置くと、テンプレートを複製した利用者全員へ配られる。使いうる消費者は 2 つとも sample の部品で、sample を消すと消費者ゼロの helper だけが残る。

| 案                                                                | 評価                                                                                                                                               | 採否     |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 実イベント (`click()` と `userEvent.keyboard`) で 2 連射する      | 実装の仕組み (描画のタイミング) をテストに書かない。Base UI と React Aria 自身のテストと同じ形。mutant で落ちることを確認済み                      | **採用** |
| 合成イベントの間に `await Promise.resolve()` を挟む               | ブラウザが実イベント間で行う checkpoint の模倣で、React の描画が microtask で流れる知識をテストに焼き込む。React 側の実装が変わると意味が変わる    | 却下     |
| 合成イベントの同期 2 連射を残し、実装に ref のフラグを持つ        | 起きない事象への防御をテストが要求する形。react.dev の `disabled={pending}` の形から外れる (ADR-0016)                                              | 却下     |
| 2 回目を `click({ force: true })` で送る                          | `data-disabled:pointer-events-none` の部品では下の要素へ届き、何が止めたか分からない。キーボードなら部品自身に届く                                 | 却下     |
| 合成 click の helper を置き、用途を 1 つに絞る                    | 消費者が sample の部品だけになる。利用者が sample を消すと、消費者ゼロの helper が配られたままになる                                               | 却下     |
| 合成 click で base-ui 内部のガードを見続ける                      | 守る対象が上流ライブラリの内部で、base-ui 自身のテストが同じことを見ている。このリポジトリのコードは `pointer-events` と状態属性の assert で守れる | 却下     |
| カスタムコマンドで Playwright の `locator.dispatchEvent()` を呼ぶ | 公式経路だが、server 側のコマンド定義と型拡張が要る。合成イベントを使う場面が無いので不要                                                          | 却下     |

### animation を無効にして走らせる理由

ブラウザテストは animation を無効にした状態を既定にし、閉じかけの popup が残る窓そのものを検証するテストだけが自分のテストの間だけ animation を戻す。popup を閉じた後の a11y 検査は unmount を待ってから行う。

`src/routes/notes/index.test.tsx` の「削除中は対象の行が busy になる」が CI (GitHub Actions、run 34792768529) でだけ落ちた。axe の incomplete に Base UI の focus guard (`aria-hidden-focus`) と確認ダイアログの見出し (`heading-order`) が出ていた。確定でダイアログを閉じた直後に `document.body` を検査しており、閉じかけの popup が animate-out (`duration-100`) の間だけ mount されたまま残る窓に検査が落ちていた。

この窓は乱数ではない。Base UI は閉じた popup を `element.getAnimations()` の完了まで mount し続ける (Handbook「Animation」)。その間、focus guard は `aria-hidden="true"` + `tabindex="0"` のまま、行は `aria-hidden` 配下のまま、`onOpenChangeComplete` は未発火のままである。検査がこの窓の内側に落ちるか外側に落ちるかは実行環境の速さで決まり、遅い CI ほど内側に落ちる。

| 出典                                                                 | 内容                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI の issue 5519 (2026-08-17)                                   | Combobox の exit animation 中に focus guard が focusable のまま残り、axe が `aria-hidden-focus` を出す。「DOM の状態は animation の間は決定的で、scan が窓の内外どちらに落ちるかで断続的に見えるだけ」               |
| Base UI の PR 5537 (2026-08-19 作成、2026-09-14 時点で未マージ)      | メンテナによる修正。閉じかけの popup に `inert` を付けて a11y tree と focus 順から外す。`heading-order` の incomplete は残りうる                                                                                     |
| axe-core の issue 4832 (open)                                        | floating-ui 系の focus guard を `aria-hidden-focus` が誤検出する。heuristics の更新待ち                                                                                                                              |
| Base UI 配布物 `global.d.ts` / `internals/useAnimationsFinished.mjs` | `globalThis.BASE_UI_ANIMATIONS_DISABLED` が `true` の間、animation の完了を待たずに完了コールバックを即実行する。JSDoc「When `true`, disables animation-related code, even if supported by the runtime environment」 |
| Base UI リポジトリ `test/setupVitest.ts` / `ComboboxRoot.test.tsx`   | 自身のテスト基盤で同フラグを既定 `true` にし、animation を検証するテストだけ `false` へ戻して `onTestFinished` で復元する                                                                                            |
| vitest.dev「Playwright」                                             | `contextOptions` は `browser.newContext` へ素通しで、context は session 単位 (1 つの session が複数ファイルを順に走らせる)。`reducedMotion: "reduce"` でメディア機能を偽装できる                                     |
| vitest.dev「retry」「TestCase」                                      | `retry` は全体 / test 単位 / `condition` で絞れる。retry 後に通ったテストは `TestDiagnostic.flaky` で拾える                                                                                                          |

既定は `src/test/browser/browser-setup.tsx` の `beforeEach` が `src/test/browser/animations.ts` の `disableAnimations()` を毎テスト呼んで作る。`globalThis.BASE_UI_ANIMATIONS_DISABLED = true` で閉じた popup は animate-out を待たずに unmount し、CDP `Emulation.setEmulatedMedia` の `prefers-reduced-motion: reduce` で `src/styles.css` の reduced-motion ブロックが CSS の animation / transition を 0.01ms にする。

| 案                                                            | 評価                                                                                                                                                                                                                                                                                                       | 採否     |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Base UI のフラグで animation を無効にし、必要なテストだけ戻す | 窓そのものが消える。Base UI 自身のテスト基盤と同じ形で、per-test で戻す前例もある。影響は Base UI の unmount 待ちに限られ、tw-animate-css の enter や rect 実測には及ばない                                                                                                                                | **採用** |
| `prefers-reduced-motion: reduce` のエミュレーション           | Playwright の context 単位の設定ではテスト単位に戻せないので、CDP `Emulation.setEmulatedMedia` で `beforeEach` から per-test に立てる。次のテストの `beforeEach` が立て直すので、戻す経路を持たない (`parkMouse` と同じ形)。rect 実測は `expect.poll` の中で読むので、enter animation を走らせる理由が無い | **採用** |
| 検査の順序だけを規範化する (unmount を待ってから axe)         | 根本の窓が残り、書き忘れると同じ形で再発する。採用案の補助として規範には残す                                                                                                                                                                                                                               | 補助     |
| vitest の `retry` で吸収する                                  | 原因を消さず、失敗が隠れる。入れるなら flaky を可視化する reporter とセットで、別途判断する                                                                                                                                                                                                                | 却下     |
| 上流 (Base UI の PR 5537、axe-core の issue 4832) を待つ      | 時期が未定。PR 5537 が入っても `heading-order` の incomplete は残りうる                                                                                                                                                                                                                                    | 却下     |

- ブラウザテストは本番と違い animation を待たず、CSS の transition / animation も 0.01ms の条件 (reduced motion を選んだユーザーと同じ) で走る。閉じかけの popup の挙動を守るテストは `await enableAnimations()` を明示し、animation ありの条件で走っていることが本文から読めるようにする
- `getAnimations()` の完了を待つ helper は置かない。待つ側の形は MDN `Animation.finished` の例そのものだが、観測の前に止める側 (Playwright の screenshot `animations: "disabled"`、Chromatic の最終フレーム停止) が主流で、待つ helper に直接の先行例は無い
- 二重発火の dedupe のテストは animate-out の窓を踏む必要があるため、animation を戻して走らせる

## 出典

explanation と how-to が拠る一次情報。

- axe-core issue #4832: https://github.com/dequelabs/axe-core/issues/4832
- Base UI `Button.test.tsx`: https://github.com/mui/base-ui/blob/master/packages/react/src/button/Button.test.tsx
- Base UI `test/setupVitest.ts`: https://github.com/mui/base-ui/blob/master/test/setupVitest.ts
- Base UI Handbook「Animation」: https://base-ui.com/react/handbook/animation
- Base UI issue #5519: https://github.com/mui/base-ui/issues/5519
- Base UI PR #5537: https://github.com/mui/base-ui/pull/5537
- Chrome DevTools Protocol `Emulation.setEmulatedMedia`: <https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setEmulatedMedia>
- HTML Standard「clean up after running script」: https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script
- HTML Standard「fire a synthetic pointer event」: https://html.spec.whatwg.org/multipage/webappapis.html#fire-a-synthetic-pointer-event
- MDN `Animation.finished` (待つ側の形): <https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished>
- MDN `Event.cancelable`: https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable
- Playwright `BrowserContextOptions.reducedMotion` (`prefers-reduced-motion` のエミュレーション): <https://playwright.dev/docs/api/class-browser#browser-new-context>
- Playwright `locator.dispatchEvent()`: https://playwright.dev/docs/api/class-locator#locator-dispatch-event
- Playwright Actionability (`force` が飛ばす判定、Enabled / Receives Events の定義): https://playwright.dev/docs/actionability
- Playwright Actions「Programmatic click」: https://playwright.dev/docs/input#programmatic-click
- Playwright screenshot の `animations` オプション (観測の前に止める側の先行例): <https://playwright.dev/docs/api/class-page#page-screenshot>
- React Aria Components `Button.test.js`: https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/test/Button.test.js
- reactwg/react-18 #21 Automatic batching for fewer renders in React 18: https://github.com/reactwg/react-18/discussions/21
- scirexs/svseeds-ui「userEvent.click is a no-op on aria-disabled elements」: https://github.com/scirexs/svseeds-ui/blob/main/.ws/knowledge/vitest-browser-userevent-skips-aria-disabled.md
- testing-library `event-map.js`: https://github.com/testing-library/dom-testing-library/blob/main/src/event-map.js
- vitest Commands (カスタムコマンドから Playwright の `page` / `frame` を使う): https://vitest.dev/guide/browser/commands
- vitest Interactivity API (CDP / webdriver でイベントを偽装しない): https://vitest.dev/guide/browser/interactivity-api
- vitest Locators: https://vitest.dev/api/browser/locators
- vitest-dev/vitest #5770 Interactivity API for Browser Mode: https://github.com/vitest-dev/vitest/issues/5770
- vitest「Playwright」(contextOptions): https://vitest.dev/config/browser/playwright
- vitest「retry」: https://vitest.dev/config/retry
- vitest「TestCase」(diagnostic): https://vitest.dev/api/advanced/test-case
- Vitest の userEvent.wheel: https://vitest.dev/api/browser/interactivity#userevent-wheel
- Playwright の Mouse.wheel ("does not wait for the scrolling to finish"): https://playwright.dev/docs/api/class-mouse#mouse-wheel
