# テストの書き方

ブラウザテストの待ち方・操作の仕方・assert の書き方と、検査スクリプトの作り方を持つ。

| 決定                                                                                                   | ADR      |
| ------------------------------------------------------------------------------------------------------ | -------- |
| ブラウザテストの規範は jsPlugins の自前ルール (`browser-test/*`) で止める                              | ADR-0009 |
| mutation は Action 層の `action` prop から `useActionMutation` で呼び、二重発火は state だけで塞ぐ     | ADR-0016 |
| a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす | ADR-0028 |

## explanation

### 同期読みは待たない

`locator.element()` / `query()` / `all()` / `elements()` は同期で値を返し、retry しない (`@vitest/browser` の `context.d.ts`)。操作の直後に読むと、React の再レンダーや Portal の mount が終わる前の DOM を読むことがある。そのまま `expect()` へ渡すと、実装が正しくてもテストが落ち、失敗しても locator の名前が出力に残らない。
`expect.element(locator)` は locator を retry のたびに引き直し、条件が成り立つまで待つ。
一方、`render()` の直後は同期で読んでよい。`vitest-browser-react` の `render` は `await act(async () => { root.render(...) })` で、初回レンダーと effect を flush してから返る。

- 公式 docs も同期読みに DANGER 表記を置く。locators の `.query()` / `.element()` は "This is an escape hatch for external APIs that do not support locators. Prefer using locator methods instead."、assertion API は "We recommend to always use `expect.element` when working with `page.getBy*` locators to reduce test flakiness." と書く
- retry するのは `findElement()` だけで、`context.d.ts` が「wait and retry until a matching element appears in the DOM, using increasing intervals (0, 20, 50, 100, 100, 500ms)」と書く。ただし assert の予算の下では待機が上限なしになるので呼ばない (「assert の予算を分ける理由」)
- 300ms 後に要素を描画するコンポーネントへ、描画前に assert を置いて測った (2026-09-22、browser project)。`expect(locator.query()).not.toBeNull()` は 1ms で赤 (`expected null not to be null`)、`await expect.element(locator).toBeInTheDocument()` は 305ms で緑。要素が最後まで現れないときの文言は、前者が `expected null not to be null`、後者が `Cannot find element with locator: page.getByText('ない')` で、前者はどの locator が解決しなかったかを持たない
- 移行先のうち `toHaveLength` と `toHaveFocus` は動かして確かめた (2026-09-22)。250ms 後に項目が 1 件から 3 件へ増えるリストで `expect.element(locator).toHaveLength(3)` は 263ms 待って通り、`click()` の直後の `expect.element(locator).toHaveFocus()` も通る

### 待機を retry API に委ねる理由

操作の直後に popup の中の要素を同期で取りに行くと、click は完了していても React の再レンダーと base-ui の Portal の mount が終わっていないことがある。失敗は full run のような負荷の高い実行でだけ出て、単独実行では通る。待ったつもりの手段が待っていないのが原因になる。

| API                                       | 実際の挙動                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `getAnimations({ subtree: true })` を待つ | 呼んだ時点の animation だけを待つ。popup が未 mount なら空配列で即解決する                                           |
| `Locator.element()`                       | retry しない。`@vitest/browser` の `context.d.ts` が「If no elements match the selector, an error is thrown.」と書く |

- 要素が操作前から在る場合も同じで、操作の直後に `element().getAttribute(...)` を同期で読むと `element()` は成功するが、読む値が更新前になりうる
- この規範はブラウザテストにだけ効く。unit project は DOM を持たず、`render` も locator も無い

| 案                                            | 評価                                                                                                                                                      | 採否     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `expect.element` に寄せる                     | vitest が retry 間隔と失敗時の DOM 出力を持つ。待機の実装がテスト側に残らない。生 DOM の mount 待ちも `expect.element` で足り、`findElement()` は呼ばない | **採用** |
| `element()` のまま `vi.waitFor` で全体を囲む  | 同じ待機が書ける。ただし囲む範囲の判断がテストごとに要り、囲み忘れが同じ形で再発する                                                                      | 却下     |
| animation を待つ helper に mount 待ちを足す   | 「アニメーションを待つ」名前と責務がずれる。待つ対象を引数で渡す設計になり、呼び出し側の判断が増える                                                      | 却下     |
| `element()` を全廃して `findElement()` に統一 | `render()` 直後は `act` で flush 済みで、待つ理由がない。同期で読める箇所まで `await` を増やすことになる                                                  | 却下     |

同期読みを assert へ流す形は lint が止める (ADR-0009)。生 DOM を読む場所 (操作を挟んだか) の残りの形はレビューで見る。

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

### 否定 assert が素通りする経路

否定 assert は「実装が壊れているのに緑で通る」向きに倒れやすい。経路は 3 つある。

| 経路                                        | 例                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 要素が最初から無いと 1 回目で通る           | `.not.toBeInTheDocument()`。`@vitest/browser` はこの否定だけを特例にし、要素が無くても throw しない。一致ゼロの locator への `toHaveLength(0)` も同じ穴を持つ |
| 解釈できない宣言は `not.toHaveStyle` を通す | 単位の書き忘れや綴り誤りは空集合になり、`.not` が真になる                                                                                                     |
| 期待値がリテラルの否定                      | `expect.poll(() => getComputedStyle(x).outlineWidth).not.toBe("0")` は、算出値が `"0px"` なので潰れた状態でも通る                                             |

- 否定の `toBeInTheDocument` だけが特例である。存在しない要素へ `.not.toHaveTextContent()` を当てると、要素が引けない間 retry して 2927ms 後に `Cannot find element with locator` で落ちた (2026-09-22、`testTimeout` 3000)。否定 matcher を一律に扱うと、この違いを踏む
- 一致しない `getByText` へ `toHaveLength(0)` を当てたテストは `Tests 1 passed (1)` で緑になる (2026-09-22)。`expect.element` は retry のたびに locator を引き直すので、描画を待つ肯定 assert を先に置かないと、まだ描かれていない状態が 0 件として成立する
- 予算を下げてもこの問題は残る。待って成立しない条件にはどんな予算を渡しても使い切るので、区別は呼び出しごとにしか置けない
- `not.toHaveStyle` は期待値を probe 要素へ流し込み、ブラウザが受け付けた宣言だけを残す (2026-09-22 実測)

| assert                                                  | 結果     |
| ------------------------------------------------------- | -------- |
| `.not.toHaveStyle("pointer-events: none")` (正しい宣言) | 落ちる   |
| `.not.toHaveStyle("outline-width: 0")` (単位なし)       | **通る** |
| `.not.toHaveStyle("pointer-evnets: none")` (綴り誤り)   | **通る** |
| `toHaveStyle("pointer-evnets: none")` (肯定形)          | 落ちる   |

- 潰れた outline で測ると `.not.toBe("0")` は通り、`.not.toBe("0px")` は落ちる (2026-09-22)。失敗の原因は matcher ではなく、期待値の綴りが 1 つ外れると否定が真になることである

### 不在を 2 つの名前で書き分ける理由

`src/test/absent.ts` は同じ matcher を呼ぶ 2 つの helper を置く。`expectAbsent(x)` は `{ timeout: 0 }` で打ち切る不在確認、`expectRemoved(x)` は assert の予算ぶん待つ消滅待ちである。

- 予算の差は、落ちる向きの差である。`expectAbsent` は「いま在る」で落ちる。予算を渡すとその向きに落ちなくなり、この assert が持つ唯一の反証条件が消える。`expectRemoved` はもともとその向きに落ちない。2 つを 1 本へ畳むと `expectAbsent` の検出力が消える
- この差は `src/test/absent.test.tsx` が両方向のミューテーションで固定している (2026-09-22 実測)。`expectRemoved` から予算を奪うと「unmount が操作より後ろでも通る」が落ち、`expectAbsent` に予算を与えると「要素が在れば落ちる」の所要時間の閾値が落ちる (外すと同じ assert が 4 秒以上かけて落ちる)
- 既存のテストで緑が割れないことは、差が無いことを意味しない。`expectRemoved` を `{ timeout: 0 }` へ落として移行先 11 箇所を走らせても 43 件すべて緑だった (同日実測)。操作の `await` が React の更新を flush し、animation が毎テスト止まるので、assert の行では unmount が済んでいる。予算が効くのは `enableAnimations()` を呼んだテストと、flush を伴わない経路で消える場合である
- `@testing-library/dom` の `waitForElementToBeRemoved` は、要素が最初から無いと throw して取り違えをランタイムで止める。この保証は移植できない。公式 API は操作の前に捕まえた要素を受け取る設計で、操作の後に assert を書く形では正当な消滅待ちでも `already removed` で落ちる (2026-09-22 に両方の向きで実測)

| 案                                                                            | 評価                                                                                                                                                                                                                                        | 採否     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 期待値がリテラルの否定をやめて肯定形へ移し、不在は 2 つの helper で書き分ける | 経路 2-3 は「期待値の綴りで否定が真になる」に還元できる。経路 1 と `toHaveLength` は期待値を取らないので、`expectAbsent` と肯定 anchor が持つ                                                                                               | **採用** |
| 否定 assert には触れない                                                      | `.not.toBeInTheDocument()` の赤が予算を使い切る。`toHaveStyle` の素通りは実測で 2 形あり、レビューでは字面が正しく見える                                                                                                                    | 却下     |
| `not.toHaveStyle` だけを止める                                                | matcher を替えた同型 (`poll(...).not.toBe("0")`) が残る。失敗の原因は matcher ではなく期待値の綴りである                                                                                                                                    | 却下     |
| 否定 matcher を全面禁止する                                                   | 観測どうしの比較 10 件が書けなくなる。綴りで潰れない形まで巻き込む                                                                                                                                                                          | 却下     |
| `waitForElementToBeRemoved` を使う                                            | 捕まえた要素の identity と「論理的に在る」が一致しない。React の再調停でノードが差し替わると、捕まえた側だけが detach して素通りする。`src/routes/notes/-components/notes-page.test.tsx` の楽観行が実データ行へ置き換わる経路がこれに当たる | 却下     |
| `toHaveStyle` をオブジェクト形式で書く                                        | 失敗時が `Expected styles could not be parsed by the browser. Did you make a typo?` だけになり、差分が出ない                                                                                                                                | 却下     |

失敗時の文言は次のとおり (2026-09-22)。

| 書き方                                                   | 失敗時                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `toHaveStyle("pointer-events: auto")`                    | `- Expected` / `+ Received` の差分が出る                                                      |
| `toHaveStyle({ pointerEvents: "auto" })`                 | `Expected styles could not be parsed by the browser. Did you make a typo?` だけで差分が出ない |
| `expect(getComputedStyle(x).pointerEvents).toBe("auto")` | `expected 'none' to be 'auto'`                                                                |

- 先行例: Playwright の Assertions は「non-retrying assertions ... can lead to a flaky test」と書く (`expectAbsent` の `{ timeout: 0 }` が該当し、肯定 anchor が緩和にあたる)。Cypress の retry-ability は `cy.get(..., { timeout: 0 }).should('not.exist')` を同期の不在確認の形として載せ、Assertions の「Negative assertions」は "Negative assertions may pass for reasons you weren't expecting." と書く。肯定 assert と組にするのは、この否定の弱さに対するこのリポジトリの規範である (`src/test/absent.ts`)

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

既定は `src/test/browser-setup.tsx` の `beforeEach` が `src/test/animations.ts` の `disableAnimations()` を毎テスト呼んで作る。`globalThis.BASE_UI_ANIMATIONS_DISABLED = true` で閉じた popup は animate-out を待たずに unmount し、CDP `Emulation.setEmulatedMedia` の `prefers-reduced-motion: reduce` で `src/styles.css` の reduced-motion ブロックが CSS の animation / transition を 0.01ms にする。

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

### assert の予算を分ける理由

`expect.element` の「最初から出ないこと」の確認 (`.not.toBeInTheDocument()`) や肯定 assert は、退行で赤になったときにテストの残り予算を使い切る。同期の 1 回読みなら赤は即座だった。テンプレートとして配るので、ブラウザテストが増えた先ほど効く。

`matchers.d.ts` の docstring と公式 docs は、`expect.element` の timeout が `expect.poll.timeout` を既定にすると書く。実装はそうなっていない。`expect.poll.timeout` を 200ms に設定して測った (2026-09-22)。

| assert                                                 | 所要                                   | 判定                                                |
| ------------------------------------------------------ | -------------------------------------- | --------------------------------------------------- |
| `expect.poll(() => false).toBe(true)`                  | 206ms                                  | 設定値が効いている                                  |
| `expect.element(存在する要素).not.toBeInTheDocument()` | 2938ms (`testTimeout` 3000 のテスト内) | 設定値を無視し、残り予算から 100ms を引いた値を使う |

既定の `testTimeout` (browser project は 15000) のまま同じ assert を測ると 14933ms かかり、`{ timeout: 0 }` を渡すと 52ms で落ちる。失敗の文言は変わらない。この食い違いは上流でも報告されている (2026-09-22 時点でどちらも open)。

| issue                           | 表題                                     | 使う記述                                                                                                                                    |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| vitest-dev/vitest の issue 8308 | expect.poll.timeout not being respected  | 報告者以外にも再現報告があり、4.0.15 でも再現している。コメントが回避策として Playwright provider の `actionTimeout` を挙げる               |
| vitest-dev/vitest の issue 9751 | Unify and simplify timeout configuration | 内部で `testTimeout - elapsedTime - 100ms` を計算していることを "Hidden dynamic adjustment" と呼び、"Users are unaware this happens" と書く |

この設定を置いた状態が、公式ドキュメントどおりの挙動である。4 ページを突き合わせた (2026-09-22)。

| ページ                                      | 記述                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `expect.element` (browser の assertion API) | timeout は "Defaults to `expect.poll.timeout` config option" |
| `findElement` (browser の locators API)     | "By default, the timeout matches the test timeout"           |
| `actionTimeout` (playwright provider)       | Playwright の操作についてのみ。他 2 つへの影響に言及が無い   |
| `testTimeout`                               | 既定値のみ。browser で 15000                                 |

- `actionTimeout` を置かないと `expect.element` が `expect.poll.timeout` を読まず、1 ページ目の記述と食い違う。置くと記述どおりになる。回避策で挙動を曲げているのではなく、文書化された既定へ戻している
- この対はメンテナが提示した形そのものである。issue 9157 で `actionTimeout` を 5000 にしても効かないという報告に対し、メンテナは「`actionTimeout` is not applied to assertions. They are controlled by `expect.poll.timeout`」と答え、`expect.poll.timeout: 5_000` と `playwright({ actionTimeout: 5_000 })` を両方足す diff を示している (2026-09-22 に `gh issue view 9157 --repo vitest-dev/vitest` で確認)
- 同じ回答は第 3 のノブ `browser.expect` にも触れているが、4.1.11 のこれは `toMatchScreenshot` しか持たず `poll` を持たない (`BrowserConfigOptions` を 2026-09-22 に確認)
- `expect.poll.timeout` は、`actionTimeout` を作った issue 6983 でメンテナが `expect.element()` について「which can be already configured by `expect.poll.timeout`」と書いた口である。`actionTimeout` は同 issue で「CI is quite often slower and locators take more than the default」を動機に要望され、PR 6984 が足した
- `actionTimeout` を置くと Playwright の操作にも上限が付く。残り予算からの計算は action の timeout がテストを跨いで持ち越されるのを止めるために入り (issue 7871 のメンテナ回答)、その代わりテストの後半ほど予算が縮んで `Timeout 581ms exceeded` のような説明のつかない失敗が出る。固定値を置くとこの縮みが消える

値は Playwright の既定を写す。Playwright は「Auto-retrying assertions like `expect(locator).toHaveText()` have a separate timeout, 5 seconds by default. Assertion timeout is unrelated to the test timeout.」と書く。このリポジトリのテストへ当てて決めた数字ではないが、当てた結果は 5000 が足りている側にある (2026-09-22、全 project 同時実行)。

| `expect.poll.timeout` | 結果                                          |
| --------------------- | --------------------------------------------- |
| 1000 (vitest の既定)  | 12 件が赤                                     |
| 2000                  | 6 件が赤                                      |
| 3000                  | 緑                                            |
| 5000 (採用)           | 緑。肯定 assert の赤は 14942ms から 5038ms へ |

- `testTimeout` の browser 既定 15000 はテストの予算として妥当である (単独実行の最遅テストは 605ms、全 project 同時実行では 3595ms)。ただしこの既定値は版で動く。メンテナは issue 9157 で、docs の数字が PR 8705 で意図せず変わった可能性に触れている。版を上げたときの扱いは `docs/guides/dependencies-and-toolchain.md`「依存を上げたときに見直すもの」にある
- 代償は `findElement` に出る。`actionTimeout` があると vitest は呼び出し側の options をそのまま返し、`findElement` の待機ループには既定が無くなる。要素が現れないと回り続け、`Test timed out` で落ちて locator の名前が出力から消える (2026-09-22 実測。`actionTimeout` なしでは 7905ms で `Cannot find element with locator: page.getByText('ない')`)。この相互作用は docs にも上流の issue にも無い (同日に検索)
- 代償のもう 1 つは、mount に `ASSERT_TIMEOUT_MS` 以上かかる要素を `expect.element` で待てなくなることである。より重い画面を持つ利用者は値を上げる

| 案                                                          | 評価                                                                                                     | 採否     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| `actionTimeout` を設定して `expect.poll.timeout` を効かせる | assert の予算をテストの予算から分けられる。値は Playwright が文書化した assertion 側の既定 5000ms を写す | **採用** |
| 何もしない (vitest の既定のまま)                            | 赤になった assert 1 件が 14942ms かかる。テンプレートとして配るので、ブラウザテストが増えた先ほど効く    | 却下     |
| `testTimeout` を短くして赤のコストを抑える                  | 待つべき assert の予算も一緒に縮む。遅い環境で緑のテストが落ちる                                         | 却下     |
| `findElement` の既定を 15000 で復元する                     | 待機の予算が assert と 2 つに割れる。`findElement` がするのは肯定 assert と同じ種類の待機である          | 却下     |
| `findElement()` に予算を渡す helper を置く                  | `src/` に呼び出しが 0 件で (2026-09-22 実測)、使い手がいない。mount 待ちは `expect.element` で足りる     | 却下     |

### route の wrapper を実 router で描く理由

Route hooks を使う wrapper (`Route.useSearch` / `Route.useNavigate`) は、実 router で描いて検証する必要がある。props 直渡しのページテストでは wrapper が一度も実行されず、URL → props と操作 → URL の往復が silent に壊れる。

Router の how-to「How to Test Router with File-Based Routing」は生成済みの `routeTree.gen.ts` を `createMemoryHistory` で描く形を示す。このテンプレートでは `__root.tsx` が `TanStackDevtools` と `<html>` を描くため、browser test でそのまま import すると "Invalid hook call" (React の二重解決) と `<html>` を `<div>` の中に描く警告で動かない (2026-09-23 に実測)。

| 案                                               | 評価                                                                 | 採否     |
| ------------------------------------------------ | -------------------------------------------------------------------- | -------- |
| root を差し替えた route tree + `Route.update`    | 実 `Route` の `validateSearch` / loader / wrapper をそのまま動かせる | **採用** |
| 生成済み `routeTree.gen.ts` を描く (how-to の形) | `__root.tsx` の devtools と `<html>` が browser test で動かない      | 却下     |
| props 直渡しのページテストだけ                   | wrapper が一度も実行されない                                         | 却下     |
| wrapper のテストを `route.test.tsx` に置く       | `route.tsx` (レイアウトルート) のテストと読める                      | 却下     |

- 出典: TanStack Router の how-to「How to Test Router with File-Based Routing」(https://tanstack.com/router/latest/docs/framework/react/how-to/test-file-based-routing)、「How to Set Up Testing with Code-Based Routing」(https://tanstack.com/router/latest/docs/framework/react/how-to/setup-testing)、file-naming-conventions (https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions)

### 検査スクリプトを分けて置く理由

整合検査・成果物の検査・ソース検査は、アプリのコードが 1 行も変わらなくても落ちうる。「片方を直して片方を忘れた」を捕まえるための検査だからである。置き方は次の 2 つで決まる。

- `src/` 全体へ当てるソース検査を作るなら、`scripts/checks/source/` と `checks-source` project を対で作る。先に lint (必要なら `jsPlugins`) で表せないかを見る
- 判定を `scripts/lib/` の純粋関数へ分け、単体テストを別に持つ。判定と適用を同じファイルに書くと、判定の境界条件を試すために `src/` を壊す必要が出る。実例は、実行側の `scripts/checks/runtime/security-headers.ts` と判定の `scripts/lib/response-headers.ts`
- 落ちたときに判断が要る検査だけを作る。判断が要るとは、設定を直すか期待値へ足すかを選ぶことを指す。実例は `scripts/checks/integrity/lint-config.test.ts` の緩和の適用先とルールの検査 (広げたのが意図なら期待値へ足し、誤りなら設定を直す) と、`scripts/checks/integrity/registry-baseline.test.ts` の 3-way の判別である。期待値の書き換えしか選択肢が無い検査は、上流の更新のたびに鳴って判断を鈍らせる (ADR-0014 が bail out の一覧を固定しない理由と同じ)

## how-to

### 待つ口を選ぶ

| 場面                                                                                | 使うもの                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 操作の結果として現れる要素の mount                                                  | `await expect.element(locator).toBeInTheDocument()`。`findElement()` は呼ばない (「assert の予算を分ける理由」)                                                                             |
| 操作後の要素の実測 (rect / computed style)                                          | 先に `expect.element` で mount を待ち、実測は `expect.poll` のコールバックの中で `locator.element()` を読む。比較の基準値を 1 回だけ読むときは、mount を待った後に `element()` で読んでよい |
| 操作後の属性・テキストの検証                                                        | `await expect.element(locator).toHaveAttribute(...)`                                                                                                                                        |
| `render()` の直後、操作前の要素の生 DOM                                             | `locator.element()`                                                                                                                                                                         |
| close 後に要素が消えたことの確認                                                    | `expectRemoved(locator)` (`src/test/absent.ts`)                                                                                                                                             |
| locator の matcher で表せない条件 (mock の呼び出し回数、announcer が積んだ配列など) | `vi.waitFor`。vitest の wait-for のレシピも、assertion を待つなら `expect.poll` 系、処理そのものが throw しなくなるのを待つなら `vi.waitFor` と分ける                                       |

- `getAnimations()` の完了を待つ helper は置かない。animation は既定で止まる (「animation を無効にして走らせる理由」)
- `toHaveTextContent` は文字列を渡すと部分一致になる。完全一致が要るなら正規表現を渡す
- 変化しないことの検証 (disabled な行がトグルしない等) は retry では強くならない。`expect.element` は条件を満たした時点で返るので、更新の前に成功しうる。待つ対象がある検証へ言い換えられないかを先に考える
- 生 DOM を読む箇所が「操作を挟んだか」で待ち方を誤っても、テストは大半の実行で通る。lint が止めるのは同期読みを assert へ流す形だけなので (ADR-0009)、残りはレビューで見る

### 同期読みを書き換える

同期読みを `expect()` へ渡す形は `browser-test/prefer-locator-methods` が止める。直し方は次のとおり。

| 形                                                 | 書き換え先                                                  |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `expect(x.query()).not.toBeNull()`                 | `expect.element(x).toBeInTheDocument()`                     |
| `expect(x.query()).toBeNull()`                     | 最初から出ないなら `expectAbsent(x)` (「否定を肯定で書く」) |
| `expect(x.element().getAttribute(a)).toBe(v)`      | `expect.element(x).toHaveAttribute(a, v)`                   |
| `expect(document.activeElement).toBe(x.element())` | `expect.element(x).toHaveFocus()`                           |
| `expect(x.all()).toHaveLength(n)`                  | `expect.element(x).toHaveLength(n)`                         |
| `expect(x.element().textContent).toContain(t)`     | `expect.element(x).toHaveTextContent(t)`                    |
| 要素を受け取る helper へ渡す                       | helper の引数を locator にする                              |

matcher の無い実測 (rect / computed style / `matches()`) は `expect.poll` のコールバックの中で読む。単一のプロパティを文字列のリテラルと比べる形は `toHaveStyle` で書く。

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

### animation を戻すテストを書く

animation は `src/test/browser-setup.tsx` が毎テスト止める (「animation を無効にして走らせる理由」)。閉じかけの popup が残る窓そのもの (二重発火の dedupe など) を検証するテストだけ、次の形で戻す。

- 本文の先頭で `await enableAnimations()` を呼ぶ。次のテストの `beforeEach` が既定へ戻すので、戻す処理は書かない (`parkMouse` と同じ形)
- 無限アニメーション (Spinner) は既定で 1 周して止まる。rect や算出スタイルは `expect.poll` の中で読むので、残る 0.01ms も待たない
- 既定では閉じた popup が次の描画で unmount するので、`data-ending-style` は観測できない
- popup を閉じた後に `expectNoA11yViolations()` を呼ぶときは、先に popup の要素を `expectRemoved()` で待つ。既定では窓が無いが、animation を戻したテストでも同じ形で書く
- 閉じた後の行の取得に `includeHidden` を渡さない。既定では確定直後の行が `aria-hidden` の配下に残らない。モーダルが開いている間の取得には引き続き要る
- transition の後に「変化しないこと」を見るテスト (実例は `src/components/parts/segmented-radio-group.test.tsx` の hover) は、retry では途中値の前に通ってしまう。animation を戻したら、変化する側の値を先に待ってから見る
- モジュールの最上位で描画や算出値を読まない。`beforeEach` より前に走るので、前のファイルが残した emulation を読む

### 否定を肯定で書く

否定 assert は、期待値がリテラルなら書かない。肯定で書く。例外は、要素が在る状態から消えるのを待つ `expectRemoved(locator)` と、期待値が別の観測である比較の 2 つに限る。理由は「否定 assert が素通りする経路」「不在を 2 つの名前で書き分ける理由」、lint で止める範囲は ADR-0009 にある。

| 書き方                                                                                                                              | 守らないと                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 「最初から出ないこと」は `src/test/absent.ts` の `expectAbsent(locator)` で確かめ、同じ操作の効果を表す肯定 assert を先に置く       | この matcher は要素が無ければ 1 回目で通る。肯定 assert が無いと、検証しているつもりで何も検証していない   |
| 要素が在る状態から消えるのを待つときは `expectRemoved(locator)` を使う。素の `expect.element(x).not.toBeInTheDocument()` は書かない | 2 つは同じ matcher を呼ぶので、名前が無いとどちらのつもりかが字面で読めない                                |
| `.not.toBeInTheDocument()` 以外の否定 matcher には、肯定 assert を添えなくてよい                                                    | 要素が引けない間 retry するので、不在のまま通ることがない                                                  |
| 件数は `expect.element(locator).toHaveLength(n)` で見る。`n` が 0 でなくても、描画を待つ肯定 assert を先に置く                      | 一致ゼロの locator でも `toHaveLength(0)` は通る。まだ描かれていない状態が 0 件として成立する              |
| スタイルをリテラルとの否定で確かめない。1 回の観測から数値を出すか、期待する値そのものと肯定で比べる                                | 綴りや単位が 1 つ外れると、潰れた状態のまま通る                                                            |
| `toHaveStyle` は文字列形式で書き、複数のプロパティは `;` で 1 つにまとめる                                                          | オブジェクト形式は失敗しても差分が出ない。分けて書くと assert ごとに予算を使い、同時に成立しない状態も通る |
| `toHaveStyle` の 1 つの文字列に同じプロパティを 2 度書かない。shorthand で longhand を覆わない                                      | jest-dom は宣言を後勝ちで畳むので、先に書いたほうが黙って消える                                            |

肯定形の書き方は主張で決まる。

- 「描かれている」「上限がある」なら、`expect.poll(() => Number.parseFloat(getComputedStyle(x).outlineWidth)).toBeGreaterThan(0)` のように 1 回の観測から数値を出す。綴りを外しても `NaN` になって落ちる
- 当たっている token が分かっているなら、`expect.element(x).toHaveStyle(`color: ${resolveColorToken("--foreground")}`)` のように値そのものと比べる (`src/components/parts/segmented-radio-group.test.tsx`)
- 観測が 2 つ要るなら 1 つの poll の中でまとめる。分けると、別々の瞬間に成立してよいことになる
- 肯定形は、失敗するときに assert の予算 (「assert の予算を宣言する」) いっぱいまで retry してから落ちる (2026-09-22 実測で 5121ms / 5343ms)。赤の所要が延びるのは検出力と引き換えである

`toHaveStyle` で表せない次の 3 つの形は、`getComputedStyle` を `expect.poll` のコールバックの中で読む。

| 形                 | 例                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 回の観測を比べる | `src/components/ui/input-group.test.tsx` で、フォーカスの前に `borderBefore` を読み、フォーカスの後の border 色を poll の中で読んで比べる箇所 |
| 数値の大小         | `expect.poll(() => Number(getComputedStyle(off).opacity)).toBeLessThan(...)`                                                                  |
| 擬似要素を読む     | `getComputedStyle(el, "::before").content`。`toHaveStyle` は要素自身しか見ない                                                                |

### assert の予算を宣言する

assert の予算をテストの予算と分けて宣言する。`vitest.browser.config.ts` に `expect.poll.timeout` と `browser.providerOptions.actionTimeout` を対で置き、値は 5000ms にする。理由は「assert の予算を分ける理由」にある。

| 規範                                                                                                                     | 守らないと何が壊れるか                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `expect.poll.timeout` と `actionTimeout` を対で置く                                                                      | `actionTimeout` を消すと残り予算を使い切る側へ戻り、`expect.poll.timeout` を消すと vitest の既定 1000ms になる               |
| 予算の値は `src/test/assert-budget.ts` の `ASSERT_TIMEOUT_MS` の 1 か所だけが持ち、config と helper の両方がそこから読む | 数字を 2 か所に置くと、重い画面を持つ利用者が上げる場所が 2 つになる                                                         |
| `testTimeout` は動かさない                                                                                               | 締めるべきは assert の予算であって、テストの予算ではない。短くすると待つべき assert の予算も一緒に縮み、遅い環境で緑が落ちる |
| `locator.findElement()` を呼ばない。mount は `expect.element(locator).toBeInTheDocument()` で待つ                        | `actionTimeout` があると `findElement()` の待ち時間が上限なしになる。`Test timed out` で落ち、locator 名が消える             |

- 呼び出しごとの `{ timeout: 0 }` はこの設定と独立に効く (2026-09-22 実測で 53ms)。呼び出しごとの指定が先に読まれるので、予算を宣言しても「待たない」は書ける。実例は `expectAbsent`
- 予算の宣言は「最初から出ない」否定 assert の無駄待ちを解かない。待って成立しない条件にはどんな予算を渡しても使い切るので、そちらは `expectAbsent` の `{ timeout: 0 }` が持つ

### route の wrapper をテストする

Route hooks を使う wrapper は、root だけをテスト用に差し替えた route tree に実 `Route` を付け、`createMemoryHistory` の router で描いて、route ファイルのテストが検証する。ページ本体は props で描く。理由は「route の wrapper を実 router で描く理由」にある。実例は `src/routes/notes/index.test.tsx` と `src/routes/notes/-components/notes-page.test.tsx`。

- route ファイルのテストは route ファイル名に `.test` を付ける (`index.test.tsx`)。`route.test.tsx` と名付けない。`route.tsx` はディレクトリのレイアウトルートの予約名 (Router の file-naming-conventions) で、そのテストと読める
- ページ本体のテストは `-components/` の部品として props で描く。wrapper の往復 (URL → props、操作 → URL、別の遷移で search が変わったときの追随、search の検証失敗を受ける error component) は route ファイルのテストが持つ。同じ経路を 2 つのテストで見ると、片方が古いまま緑になる

| 組み方                                                                                                                                                                                                                                                                                                                 | 守らないと                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root は `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` で本番と同じ context 型を持たせ、実 `Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済みの `routeTree` は browser test で描けない。`createTestRouter` (`src/test/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない |
| router には本番と同じ `defaultErrorComponent` (`RouteErrorContent`) を渡す                                                                                                                                                                                                                                             | 無いと、検証の失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る                                                                                        |

browser test は DEV で走るので、search の検証に失敗すると `RouteErrorContent` が `error.message` (Standard Schema の issues の JSON) をそのまま出す。テストは schema の文言が含まれることを見る。

### debounce のある入力をテストする

- debounce のテストは、1 文字ずつ別の `userEvent.keyboard` で打つ。`fill` は 1 回の input、`type("abc")` は 3 文字を間を置かず送るので、どちらも debounce の欠落を検出しない (2026-09-23 に mutant で実測)
- fake timers は使わない。browser mode では locator の操作が fake timer を進めない (vitest-dev/vitest の issue 10058)。待ちを広げたいときは、定数を `vi.mock(import(...))` の partial mock で広げる
- 実例は `src/routes/notes/-components/notes-page.test.tsx` と `src/routes/notes/index.test.tsx`

### 入力部品を操作する

- `NumberField` (ADR-0021) のロールは `spinbutton` ではなく `textbox` になる。`getByRole("textbox")` で取る
- locator の `fill()` は、controlled な `type="text"` では既存の値を置き換えず追記になる。要素を全選択してから打つ

### 状態と通知を検証する

- pending の検証は `aria-busy` と announcer の region のテキストで行う。`getByRole("status", { name })` で項目の pending を掴まない。項目に `role="status"` は付けていない (ADR-0026)
- announcer の region は `src/test/browser-setup.tsx` が毎テスト描く。文言は `src/test/live-announcer.ts` の `readAnnouncements(politeness)` で読み、配列を丸ごと比べる。`toContain` だと重複や余計な通知が通る
- 同じ通知の経路を 2 つのテストで見ない。`/notes` では、ページのテスト (`src/routes/notes/-components/notes-page.test.tsx`) が debounce 後と無効化済みキャッシュの決着を、wrapper のテスト (`src/routes/notes/index.test.tsx`) が Enter と戻るを見る

### viewport に収まることを測る

viewport の寸法の定数は `src/test/viewport-sizes.ts` が持ち、`src/test/viewport.ts` が再 export する。`page.viewport()` で変えたら、`afterEach` で `DEFAULT_VIEWPORT` へ戻す。既定の viewport は、`vitest.browser.config.ts` の `browser.viewport` が `viewport-sizes.ts` から `DEFAULT_VIEWPORT` を import して使う。値を写すとどちらかが古くなる。config から `viewport.ts` を読むと、browser mode の外で落ちる (`viewport-sizes.ts` の docstring)。

popup の全体が viewport に収まることは、`src/test/viewport.ts` の `expectWithinViewport(locator)` で見る。`toBeInViewport({ ratio: 1 })` は使わない。実測と理由は `src/test/viewport.ts` の docstring が持つ。

- 判定は `src/test/viewport-overflows.ts` の純粋関数が持ち、はみ出した辺と px を文字列で返す。helper は `toEqual([])` で比べるので、失敗文に `bottom +40px` のような原因が残る
- 高さか幅が 0 の要素は、収まっているとは見なさない。潰れた要素ははみ出しを自明に満たす。`toBeInViewport` も面積 0 の要素に ratio 1 を返す (IntersectionObserver 仕様「Run the Update Intersection Observations Steps」の step 12)
- 呼び出し側は先に mount を待たなくてよい。helper 自身が poll し、要素が無ければ `element()` の throw (`Cannot find element with locator: …`) がそのまま失敗文になる
- 一部が見えていること (`ratio` 0) は、公式の `toBeInViewport()` のまま使う。End キーで最下部へ届くことの検証は公式の matcher で足りる
- `max-height` を `toHaveStyle` で見る形は採らない。Tailwind の class を写す同語反復で、収まるかどうかは内容の高さと viewport で決まる

## 出典

explanation と how-to が拠る一次情報。

- 同梱の `@vitest/browser` 4.1.11 の `context.d.ts` (同期読み 4 メソッドと `findElement` の docstring) と `matchers.d.ts` (`expect.element` が受ける型の docstring)
- `@testing-library/dom` の `waitForElementToBeRemoved` (要素が最初から無いと throw する): <https://testing-library.com/docs/dom-testing-library/api-async/>
- axe-core issue #4832: https://github.com/dequelabs/axe-core/issues/4832
- Base UI `Button.test.tsx`: https://github.com/mui/base-ui/blob/master/packages/react/src/button/Button.test.tsx
- Base UI `test/setupVitest.ts`: https://github.com/mui/base-ui/blob/master/test/setupVitest.ts
- Base UI Handbook「Animation」: https://base-ui.com/react/handbook/animation
- Base UI issue #5519: https://github.com/mui/base-ui/issues/5519
- Base UI PR #5537: https://github.com/mui/base-ui/pull/5537
- Chrome DevTools Protocol `Emulation.setEmulatedMedia`: <https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setEmulatedMedia>
- Cypress の Assertions「Negative assertions」("Negative assertions may pass for reasons you weren't expecting."): <https://docs.cypress.io/app/references/assertions>
- Cypress の retry-ability (`cy.get(..., { timeout: 0 }).should('not.exist')` を「check synchronously that the element does not exist (no retry)」の形として載せる。`expectAbsent` と同じ形): <https://docs.cypress.io/app/core-concepts/retry-ability>
- HTML Standard「clean up after running script」: https://html.spec.whatwg.org/multipage/webappapis.html#clean-up-after-running-script
- HTML Standard「fire a synthetic pointer event」: https://html.spec.whatwg.org/multipage/webappapis.html#fire-a-synthetic-pointer-event
- jest-dom の `toHaveStyle`: <https://github.com/testing-library/jest-dom#tohavestyle>
- MDN `Animation.finished` (待つ側の形): <https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished>
- MDN `Event.cancelable`: https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable
- Playwright の Assertions (「non-retrying assertions ... can lead to a flaky test」。`expectAbsent` の `{ timeout: 0 }` が該当し、肯定 anchor が緩和にあたる): <https://playwright.dev/docs/test-assertions>
- Playwright の Test timeouts (assertion timeout を test timeout と分ける): <https://playwright.dev/docs/test-timeouts>
- Playwright `BrowserContextOptions.reducedMotion` (`prefers-reduced-motion` のエミュレーション): <https://playwright.dev/docs/api/class-browser#browser-new-context>
- Playwright `locator.dispatchEvent()`: https://playwright.dev/docs/api/class-locator#locator-dispatch-event
- Playwright Actionability (`force` が飛ばす判定、Enabled / Receives Events の定義): https://playwright.dev/docs/actionability
- Playwright Actions「Programmatic click」: https://playwright.dev/docs/input#programmatic-click
- Playwright screenshot の `animations` オプション (観測の前に止める側の先行例): <https://playwright.dev/docs/api/class-page#page-screenshot>
- React Aria Components `Button.test.js`: https://github.com/adobe/react-spectrum/blob/main/packages/react-aria-components/test/Button.test.js
- reactwg/react-18 #21 Automatic batching for fewer renders in React 18: https://github.com/reactwg/react-18/discussions/21
- scirexs/svseeds-ui「userEvent.click is a no-op on aria-disabled elements」: https://github.com/scirexs/svseeds-ui/blob/main/.ws/knowledge/vitest-browser-userevent-skips-aria-disabled.md
- testing-library `event-map.js`: https://github.com/testing-library/dom-testing-library/blob/main/src/event-map.js
- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- vitest browser の locator: <https://vitest.dev/guide/browser/locators>
- vitest Commands (カスタムコマンドから Playwright の `page` / `frame` を使う): https://vitest.dev/guide/browser/commands
- vitest Interactivity API (CDP / webdriver でイベントを偽装しない): https://vitest.dev/guide/browser/interactivity-api
- vitest Locators: https://vitest.dev/api/browser/locators
- vitest-dev/vitest #5770 Interactivity API for Browser Mode: https://github.com/vitest-dev/vitest/issues/5770
- vitest-dev/vitest#6983 / PR #6984 (`actionTimeout` の導入と、`expect.poll.timeout` が `expect.element` の口だというメンテナ回答): <https://github.com/vitest-dev/vitest/issues/6983>
- vitest-dev/vitest#7871 (action の timeout がテストの残り予算で縮む): <https://github.com/vitest-dev/vitest/issues/7871>
- vitest-dev/vitest#8308 (OPEN。`expect.poll.timeout` が `expect.element` に効かない): <https://github.com/vitest-dev/vitest/issues/8308>
- vitest-dev/vitest#9157 (`testTimeout` の既定が docs と食い違う可能性): <https://github.com/vitest-dev/vitest/issues/9157>
- vitest-dev/vitest#9751 (OPEN。timeout 設定の集約): <https://github.com/vitest-dev/vitest/issues/9751>
- vitest「Playwright」(contextOptions): https://vitest.dev/config/browser/playwright
- vitest「retry」: https://vitest.dev/config/retry
- vitest「TestCase」(diagnostic): https://vitest.dev/api/advanced/test-case
