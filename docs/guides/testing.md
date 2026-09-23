# テストの書き方

ブラウザテストの待ち方・操作の仕方・assert の書き方と、検査スクリプトの作り方を持つ。

| 決定                                                                                                                                        | ADR      |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ブラウザテストの待機は vitest の retry API に委ね、自前の待機を積まない                                                                     | ADR-0041 |
| ブラウザテストのユーザー操作は実イベントだけで発火する                                                                                      | ADR-0042 |
| ブラウザテストは animation を無効にして走らせ、animate-out の窓を踏むテストだけ戻す                                                         | ADR-0043 |
| assert には locator を渡し、matcher の無い実測は `expect.poll` の中で読む                                                                   | ADR-0044 |
| assert の予算をテストの予算と分けて宣言する                                                                                                 | ADR-0045 |
| 否定 assert は不在や綴り違いでも通るので、肯定で書く                                                                                        | ADR-0046 |
| Route hooks を使う wrapper は、root を差し替えた route tree に実 Route を付け、memory history の router で route ファイルのテストが検証する | ADR-0047 |

## explanation

### 同期読みは待たない

`locator.element()` / `query()` / `all()` / `elements()` は同期で値を返し、retry しない (`@vitest/browser` の `context.d.ts`)。操作の直後に読むと、React の再レンダーや Portal の mount が終わる前の DOM を読むことがある。そのまま `expect()` へ渡すと、実装が正しくてもテストが落ち、失敗しても locator の名前が出力に残らない。
`expect.element(locator)` は locator を retry のたびに引き直し、条件が成り立つまで待つ。
一方、`render()` の直後は同期で読んでよい。`vitest-browser-react` の `render` は `act` の中で初回レンダーと effect を flush してから返る。詳細と実測は ADR-0041 と ADR-0044 の Context が持つ。

### 合成イベントが実物からずれる理由

`new MouseEvent("click", { bubbles: true })` で送る合成 click は、`cancelable` が既定の false になり、`isTrusted` も false になる。実クリックと Enter 由来の click は両方 true である。非 cancelable のイベントはリスナーが `preventDefault` で止められないので、たとえば `aria-disabled` の submit ボタンで Base UI が呼ぶ `preventDefault` が効かず、form の暗黙 submit がテストでだけ通る。属性を実物へ合わせても `isTrusted` は合わず、同じ種類のずれが残る。詳細は ADR-0042 の Context が持つ。

`.click({ force: true })` が飛ばすのは Playwright の actionability の検査で、ブラウザ自身のヒットテストは残る。対象に `pointer-events: none` が当たっていると、`force` のイベントは対象へ届かず下の要素へ落ちる。

### 否定 assert が素通りする経路

否定 assert は「実装が壊れているのに緑で通る」向きに倒れやすい。経路は 3 つある (ADR-0046 の Context)。

| 経路                                        | 例                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 要素が最初から無いと 1 回目で通る           | `.not.toBeInTheDocument()`。`@vitest/browser` はこの否定だけを特例にし、要素が無くても throw しない。一致ゼロの locator への `toHaveLength(0)` も同じ穴を持つ |
| 解釈できない宣言は `not.toHaveStyle` を通す | 単位の書き忘れや綴り誤りは空集合になり、`.not` が真になる                                                                                                     |
| 期待値がリテラルの否定                      | `expect.poll(() => getComputedStyle(x).outlineWidth).not.toBe("0")` は、算出値が `"0px"` なので潰れた状態でも通る                                             |

`expectAbsent` と `expectRemoved` は同じ matcher を呼ぶが、予算の有無で落ちる向きが違う。`expectAbsent` は予算 0 で「いま在る」なら落ち、`expectRemoved` は予算ぶん待って「消えない」なら落ちる。1 本へ畳むと、`expectAbsent` の唯一の反証条件が消える。

### 検査スクリプトを分けて置く理由

整合検査・成果物の検査・ソース検査は、アプリのコードが 1 行も変わらなくても落ちうる。「片方を直して片方を忘れた」を捕まえるための検査だからである。置き方は次の 2 つで決まる。

- `src/` 全体へ当てるソース検査を作るなら、`scripts/checks/source/` と `checks-source` project を対で作る。先に lint (必要なら `jsPlugins`) で表せないかを見る
- 判定を `scripts/lib/` の純粋関数へ分け、単体テストを別に持つ。判定と適用を同じファイルに書くと、判定の境界条件を試すために `src/` を壊す必要が出る。実例は、実行側の `scripts/checks/runtime/security-headers.ts` と判定の `scripts/lib/response-headers.ts`
- 落ちたときに判断が要る検査だけを作る。判断が要るとは、設定を直すか期待値へ足すかを選ぶことを指す。実例は `scripts/checks/integrity/lint-config.test.ts` の緩和の適用先とルールの検査 (広げたのが意図なら期待値へ足し、誤りなら設定を直す) と、`scripts/checks/integrity/registry-baseline.test.ts` の 3-way の判別である。期待値の書き換えしか選択肢が無い検査は、上流の更新のたびに鳴って判断を鈍らせる (ADR-0019 が bail out の一覧を固定しない理由と同じ)

## how-to

### 待つ口を選ぶ

| 場面                                                                                | 使うもの                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 操作の結果として現れる要素の mount                                                  | `await expect.element(locator).toBeInTheDocument()`。`findElement()` は呼ばない (ADR-0045)                                                                                                             |
| 操作後の要素の実測 (rect / computed style)                                          | 先に `expect.element` で mount を待ち、実測は `expect.poll` のコールバックの中で `locator.element()` を読む。比較の基準値を 1 回だけ読むときは、mount を待った後に `element()` で読んでよい (ADR-0044) |
| 操作後の属性・テキストの検証                                                        | `await expect.element(locator).toHaveAttribute(...)`                                                                                                                                                   |
| `render()` の直後、操作前の要素の生 DOM                                             | `locator.element()`                                                                                                                                                                                    |
| close 後に要素が消えたことの確認                                                    | `expectRemoved(locator)` (`src/test/absent.ts`)                                                                                                                                                        |
| locator の matcher で表せない条件 (mock の呼び出し回数、announcer が積んだ配列など) | `vi.waitFor`。vitest の wait-for のレシピも、assertion を待つなら `expect.poll` 系、処理そのものが throw しなくなるのを待つなら `vi.waitFor` と分ける                                                  |

- `getAnimations()` の完了を待つ helper は置かない。animation は既定で止まる (ADR-0043)
- `toHaveTextContent` は文字列を渡すと部分一致になる。完全一致が要るなら正規表現を渡す
- 変化しないことの検証 (disabled な行がトグルしない等) は retry では強くならない。`expect.element` は条件を満たした時点で返るので、更新の前に成功しうる。待つ対象がある検証へ言い換えられないかを先に考える
- 生 DOM を読む箇所が「操作を挟んだか」で待ち方を誤っても、テストは大半の実行で通る。lint が止めるのは同期読みを assert へ流す形だけなので、残りはレビューで見る

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

手段は場面で決める (ADR-0042)。`.click()` が弾かれたら、Playwright のエラー文言が示す条件を読んでから行を選ぶ。通るまで手段を替えると、実物で起きない事象を固定する。

| 場面                                                  | 使うもの                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定                                                  | `locator.click()`                                                                                                                                                          |
| Playwright に弾かれ、キーボードで同じ活性化が起こせる | `userEvent.tab()` で対象へフォーカスを移し (直前の実クリックで乗っているならそのまま)、`userEvent.keyboard("{Enter}")`。キーボードは enabled / hit-target の判定を受けない |
| Playwright に弾かれ、pointer 経由の click が要る      | `.click({ force: true })`。対象に `pointer-events: none` が当たっていないことを先に確かめる                                                                                |
| 無効化された要素が反応しないことの検証                | `pointer-events` と状態属性で見る。イベントを対象へ届かせて、ライブラリ内部のガードまで見に行かない                                                                        |
| 決着前の二重発火の検証                                | 上の実イベントを 2 回。`await Promise.resolve()` で間隔を作らない                                                                                                          |

`.click()` が弾く条件は、Playwright の Actionability が定める Visible / Stable / Receives Events / Enabled である。このリポジトリで弾かれる典型は次のとおり。

| 条件               | 落ちる例                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Enabled            | native `disabled`、`aria-disabled="true"` の祖先を持つ要素                                                            |
| Stable             | 開閉アニメーションの途中。既定では ADR-0043 の無効化で即座に終わる。animation を戻したテストでは settled を待って押す |
| Visible / viewport | `sr-only` の 1px + clip。`getByRole(..., { name })` で本体を掴む                                                      |
| Receives Events    | base-ui のバックドロップ (`data-base-ui-inert`)、`pointer-events: none`                                               |

- `force: true` はこの検査をまとめて飛ばす。animation を戻したテストでは、スライドインの途中の要素が "Element is outside of the viewport" で落ちる。viewport 内の座標の確認は公式の 4 条件の定義に無く、`playwright-core` の `_performPointerAction` が行う (ソースの読み取りで、公式 docs では未確認)
- 合成イベントを足したくなったら、先に `force: true` で届くかを測る。届くなら合成イベントは要らない

### animation を戻すテストを書く

animation は `src/test/browser-setup.tsx` が毎テスト止める (ADR-0043)。閉じかけの popup が残る窓そのもの (二重発火の dedupe など) を検証するテストだけ、次の形で戻す。

- 本文の先頭で `await enableAnimations()` を呼ぶ。次のテストの `beforeEach` が既定へ戻すので、戻す処理は書かない (`parkMouse` と同じ形)
- 無限アニメーション (Spinner) は既定で 1 周して止まる。rect や算出スタイルは `expect.poll` の中で読むので、残る 0.01ms も待たない
- 既定では閉じた popup が次の描画で unmount するので、`data-ending-style` は観測できない
- popup を閉じた後に `expectNoA11yViolations()` を呼ぶときは、先に popup の要素を `expectRemoved()` で待つ。既定では窓が無いが、animation を戻したテストでも同じ形で書く
- 閉じた後の行の取得に `includeHidden` を渡さない。既定では確定直後の行が `aria-hidden` の配下に残らない。モーダルが開いている間の取得には引き続き要る
- transition の後に「変化しないこと」を見るテスト (実例は `src/components/parts/segmented-radio-group.test.tsx` の hover) は、retry では途中値の前に通ってしまう。animation を戻したら、変化する側の値を先に待ってから見る
- モジュールの最上位で描画や算出値を読まない。`beforeEach` より前に走るので、前のファイルが残した emulation を読む

### 否定を肯定で書く

否定 assert は、期待値がリテラルなら書かない (ADR-0046)。

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
- 肯定形は、失敗するときに assert の予算 (ADR-0045) いっぱいまで retry してから落ちる (2026-09-22 実測で 5121ms / 5343ms)。赤の所要が延びるのは検出力と引き換えである

`toHaveStyle` で表せない次の 3 つの形は、`getComputedStyle` を `expect.poll` のコールバックの中で読む。

| 形                 | 例                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 回の観測を比べる | `src/components/ui/input-group.test.tsx` で、フォーカスの前に `borderBefore` を読み、フォーカスの後の border 色を poll の中で読んで比べる箇所 |
| 数値の大小         | `expect.poll(() => Number(getComputedStyle(off).opacity)).toBeLessThan(...)`                                                                  |
| 擬似要素を読む     | `getComputedStyle(el, "::before").content`。`toHaveStyle` は要素自身しか見ない                                                                |

### 予算を呼び出しごとに外す

assert の予算は `src/test/assert-budget.ts` の `ASSERT_TIMEOUT_MS` で宣言する (ADR-0045)。呼び出しごとの `{ timeout: 0 }` はこの設定と独立に効く (2026-09-22 実測で 53ms)。呼び出しごとの指定が先に読まれるので、予算を宣言しても「待たない」は書ける。実例は `expectAbsent`。

### route の wrapper をテストする

route ファイルの wrapper は、root を差し替えた tree と memory history で描く (ADR-0047)。実例は `src/routes/notes/index.test.tsx`。

| 組み方                                                                                                                                                                                                                                                                                                                 | 守らないと                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root は `createRootRouteWithContext<{ queryClient }>()({ component: () => <Outlet /> })` で本番と同じ context 型を持たせ、実 `Route` を生成コードと同じ `update({ id, path, getParentRoute })` で付ける。`update` の公開型に id / path / getParentRoute が無いので (生成コードは `as any`)、交差型で注釈した変数を渡す | 生成済みの `routeTree` は browser test で描けない。`createTestRouter` (`src/test/create-test-router.tsx`) は component から自前の route を作るので、`validateSearch` や loader を持つ実 `Route` を付けられない |
| router には本番と同じ `defaultErrorComponent` (`RouteErrorContent`) を渡す                                                                                                                                                                                                                                             | 無いと、検証の失敗が root の外まで抜けて組み込みの `ErrorComponent` が描き、"wasn't caught by any route" の warn が出る                                                                                        |

browser test は DEV で走るので、search の検証に失敗すると `RouteErrorContent` が `error.message` (Standard Schema の issues の JSON) をそのまま出す。テストは schema の文言が含まれることを見る。

### debounce のある入力をテストする

- debounce のテストは、1 文字ずつ別の `userEvent.keyboard` で打つ。`fill` は 1 回の input、`type("abc")` は 3 文字を間を置かず送るので、どちらも debounce の欠落を検出しない (2026-09-23 に mutant で実測)
- fake timers は使わない。browser mode では locator の操作が fake timer を進めない (vitest-dev/vitest#10058)。待ちを広げたいときは、定数を `vi.mock(import(...))` の partial mock で広げる
- 実例は `src/routes/notes/-components/notes-page.test.tsx` と `src/routes/notes/index.test.tsx`

### 入力部品を操作する

- `NumberField` (ADR-0028) のロールは `spinbutton` ではなく `textbox` になる。`getByRole("textbox")` で取る
- locator の `fill()` は、controlled な `type="text"` では既存の値を置き換えず追記になる。要素を全選択してから打つ

### 状態と通知を検証する

- pending の検証は `aria-busy` と announcer の region のテキストで行う。`getByRole("status", { name })` で項目の pending を掴まない。項目に `role="status"` は付けていない (ADR-0035)
- announcer の region は `src/test/browser-setup.tsx` が毎テスト描く。文言は `src/test/live-announcer.ts` の `readAnnouncements(politeness)` で読み、配列を丸ごと比べる。`toContain` だと重複や余計な通知が通る
- 同じ通知の経路を 2 つのテストで見ない。`/notes` では、ページのテスト (`-components/notes-page.test.tsx`) が debounce 後と無効化済みキャッシュの決着を、wrapper のテスト (`index.test.tsx`) が Enter と戻るを見る

### viewport に収まることを測る

viewport の寸法の定数は `src/test/viewport-sizes.ts` が持ち、`src/test/viewport.ts` が再 export する。`page.viewport()` で変えたら、`afterEach` で `DEFAULT_VIEWPORT` へ戻す。既定の viewport は、`vitest.browser.config.ts` の `browser.viewport` が `viewport-sizes.ts` から `DEFAULT_VIEWPORT` を import して使う。値を写すとどちらかが古くなる。config から `viewport.ts` を読むと、browser mode の外で落ちる (`viewport-sizes.ts` の docstring)。

popup の全体が viewport に収まることは、`src/test/viewport.ts` の `expectWithinViewport(locator)` で見る。`toBeInViewport({ ratio: 1 })` は使わない。実測と理由は `src/test/viewport.ts` の docstring が持つ。

- 判定は `src/test/viewport-overflows.ts` の純粋関数が持ち、はみ出した辺と px を文字列で返す。helper は `toEqual([])` で比べるので、失敗文に `bottom +40px` のような原因が残る
- 高さか幅が 0 の要素は、収まっているとは見なさない。潰れた要素ははみ出しを自明に満たす。`toBeInViewport` も面積 0 の要素に ratio 1 を返す (IntersectionObserver 仕様「Run the Update Intersection Observations Steps」の step 12)
- 呼び出し側は先に mount を待たなくてよい。helper 自身が poll し、要素が無ければ `element()` の throw (`Cannot find element with locator: …`) がそのまま失敗文になる
- 一部が見えていること (`ratio` 0) は、公式の `toBeInViewport()` のまま使う。End キーで最下部へ届くことの検証は公式の matcher で足りる
- `max-height` を `toHaveStyle` で見る形は採らない。Tailwind の class を写す同語反復で、収まるかどうかは内容の高さと viewport で決まる
