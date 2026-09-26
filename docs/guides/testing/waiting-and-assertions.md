# テストの待機と assert

ブラウザテストで要素と状態を待つ口の選び方と、assert の書き方・予算を持つ。

| 決定                                                                                          | ADR      |
| --------------------------------------------------------------------------------------------- | -------- |
| ブラウザテストの規範は jsPlugins の自前ルール (`browser-test/*`) で止める                     | ADR-0009 |
| 状態の通知は常時 mount の live region に集約し、項目の状態は静的テキストと `aria-busy` で持つ | ADR-0026 |

## how-to

### 待つ口を選ぶ

| 場面                                                                                | 使うもの                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 操作の結果として現れる要素の mount                                                  | `await expect.element(locator).toBeInTheDocument()`。`findElement()` は呼ばない (「assert の予算を分ける理由」)                                                                             |
| 操作後の要素の実測 (rect / computed style)                                          | 先に `expect.element` で mount を待ち、実測は `expect.poll` のコールバックの中で `locator.element()` を読む。比較の基準値を 1 回だけ読むときは、mount を待った後に `element()` で読んでよい |
| 操作後の属性・テキストの検証                                                        | `await expect.element(locator).toHaveAttribute(...)`                                                                                                                                        |
| `render()` の直後、操作前の要素の生 DOM                                             | `locator.element()`                                                                                                                                                                         |
| close 後に要素が消えたことの確認                                                    | `expectRemoved(locator)` (`src/test/assert/absent.ts`)                                                                                                                                      |
| locator の matcher で表せない条件 (mock の呼び出し回数、announcer が積んだ配列など) | `vi.waitFor`。vitest の wait-for のレシピも、assertion を待つなら `expect.poll` 系、処理そのものが throw しなくなるのを待つなら `vi.waitFor` と分ける                                       |

- `getAnimations()` の完了を待つ helper は置かない。animation は既定で止まる (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」)
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

### 否定を肯定で書く

否定 assert は、期待値がリテラルなら書かない。肯定で書く。例外は、要素が在る状態から消えるのを待つ `expectRemoved(locator)` と、期待値が別の観測である比較の 2 つに限る。理由は「否定 assert が素通りする経路」「不在を 2 つの名前で書き分ける理由」、lint で止める範囲は ADR-0009 にある。

| 書き方                                                                                                                               | 守らないと                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 「最初から出ないこと」は `src/test/assert/absent.ts` の `expectAbsent(locator)` で確かめ、同じ操作の効果を表す肯定 assert を先に置く | この matcher は要素が無ければ 1 回目で通る。肯定 assert が無いと、検証しているつもりで何も検証していない   |
| 要素が在る状態から消えるのを待つときは `expectRemoved(locator)` を使う。素の `expect.element(x).not.toBeInTheDocument()` は書かない  | 2 つは同じ matcher を呼ぶので、名前が無いとどちらのつもりかが字面で読めない                                |
| `.not.toBeInTheDocument()` 以外の否定 matcher には、肯定 assert を添えなくてよい                                                     | 要素が引けない間 retry するので、不在のまま通ることがない                                                  |
| 件数は `expect.element(locator).toHaveLength(n)` で見る。`n` が 0 でなくても、描画を待つ肯定 assert を先に置く                       | 一致ゼロの locator でも `toHaveLength(0)` は通る。まだ描かれていない状態が 0 件として成立する              |
| スタイルをリテラルとの否定で確かめない。1 回の観測から数値を出すか、期待する値そのものと肯定で比べる                                 | 綴りや単位が 1 つ外れると、潰れた状態のまま通る                                                            |
| `toHaveStyle` は文字列形式で書き、複数のプロパティは `;` で 1 つにまとめる                                                           | オブジェクト形式は失敗しても差分が出ない。分けて書くと assert ごとに予算を使い、同時に成立しない状態も通る |
| `toHaveStyle` の 1 つの文字列に同じプロパティを 2 度書かない。shorthand で longhand を覆わない                                       | jest-dom は宣言を後勝ちで畳むので、先に書いたほうが黙って消える                                            |

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

| 規範                                                                                                                             | 守らないと何が壊れるか                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `expect.poll.timeout` と `actionTimeout` を対で置く                                                                              | `actionTimeout` を消すと残り予算を使い切る側へ戻り、`expect.poll.timeout` を消すと vitest の既定 1000ms になる               |
| 予算の値は `src/test/browser/assert-budget.ts` の `ASSERT_TIMEOUT_MS` の 1 か所だけが持ち、config と helper の両方がそこから読む | 数字を 2 か所に置くと、重い画面を持つ利用者が上げる場所が 2 つになる                                                         |
| `testTimeout` は動かさない                                                                                                       | 締めるべきは assert の予算であって、テストの予算ではない。短くすると待つべき assert の予算も一緒に縮み、遅い環境で緑が落ちる |
| `locator.findElement()` を呼ばない。mount は `expect.element(locator).toBeInTheDocument()` で待つ                                | `actionTimeout` があると `findElement()` の待ち時間が上限なしになる。`Test timed out` で落ち、locator 名が消える             |

- 呼び出しごとの `{ timeout: 0 }` はこの設定と独立に効く (2026-09-22 実測で 53ms)。呼び出しごとの指定が先に読まれるので、予算を宣言しても「待たない」は書ける。実例は `expectAbsent`
- 予算の宣言は「最初から出ない」否定 assert の無駄待ちを解かない。待って成立しない条件にはどんな予算を渡しても使い切るので、そちらは `expectAbsent` の `{ timeout: 0 }` が持つ

### viewport に収まることを測る

viewport の寸法の定数は `src/test/browser/viewport-sizes.ts` が持ち、`src/test/assert/viewport.ts` が再 export する。`page.viewport()` で変えたら、`afterEach` で `DEFAULT_VIEWPORT` へ戻す。既定の viewport は、`vitest.browser.config.ts` の `browser.viewport` が `viewport-sizes.ts` から `DEFAULT_VIEWPORT` を import して使う。値を写すとどちらかが古くなる。config から `viewport.ts` を読むと、browser mode の外で落ちる (`viewport-sizes.ts` の docstring)。

popup の全体が viewport に収まることは、`src/test/assert/viewport.ts` の `expectWithinViewport(locator)` で見る。`toBeInViewport({ ratio: 1 })` は使わない。実測と理由は `src/test/assert/viewport.ts` の docstring が持つ。

- 判定は `src/test/assert/viewport-overflows.ts` の純粋関数が持ち、はみ出した辺と px を文字列で返す。helper は `toEqual([])` で比べるので、失敗文に `bottom +40px` のような原因が残る
- 高さか幅が 0 の要素は、収まっているとは見なさない。潰れた要素ははみ出しを自明に満たす。`toBeInViewport` も面積 0 の要素に ratio 1 を返す (IntersectionObserver 仕様「Run the Update Intersection Observations Steps」の step 12)
- 呼び出し側は先に mount を待たなくてよい。helper 自身が poll し、要素が無ければ `element()` の throw (`Cannot find element with locator: …`) がそのまま失敗文になる
- 一部が見えていること (`ratio` 0) は、公式の `toBeInViewport()` のまま使う。End キーで最下部へ届くことの検証は公式の matcher で足りる
- `max-height` を `toHaveStyle` で見る形は採らない。Tailwind の class を写す同語反復で、収まるかどうかは内容の高さと viewport で決まる

### 状態と通知を検証する

- pending の検証は `aria-busy` と announcer の region のテキストで行う。`getByRole("status", { name })` で項目の pending を掴まない。項目に `role="status"` は付けていない (ADR-0026)
- announcer の region は `src/test/browser/browser-setup.tsx` が毎テスト描く。文言は `src/test/assert/live-announcer.ts` の `readAnnouncements(politeness)` で読み、配列を丸ごと比べる。`toContain` だと重複や余計な通知が通る
- 同じ通知の経路を 2 つのテストで見ない。`/notes` では、ページのテスト (`src/routes/notes/-components/notes-page.test.tsx`) が debounce 後と無効化済みキャッシュの決着を、wrapper のテスト (`src/routes/notes/index.test.tsx`) が Enter と戻るを見る

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

`src/test/assert/absent.ts` は同じ matcher を呼ぶ 2 つの helper を置く。`expectAbsent(x)` は `{ timeout: 0 }` で打ち切る不在確認、`expectRemoved(x)` は assert の予算ぶん待つ消滅待ちである。

- 予算の差は、落ちる向きの差である。`expectAbsent` は「いま在る」で落ちる。予算を渡すとその向きに落ちなくなり、この assert が持つ唯一の反証条件が消える。`expectRemoved` はもともとその向きに落ちない。2 つを 1 本へ畳むと `expectAbsent` の検出力が消える
- この差は `src/test/assert/absent.test.tsx` が両方向のミューテーションで固定している (2026-09-22 実測)。`expectRemoved` から予算を奪うと「unmount が操作より後ろでも通る」が落ち、`expectAbsent` に予算を与えると「要素が在れば落ちる」の所要時間の閾値が落ちる (外すと同じ assert が 4 秒以上かけて落ちる)
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

- 先行例: Playwright の Assertions は「non-retrying assertions ... can lead to a flaky test」と書く (`expectAbsent` の `{ timeout: 0 }` が該当し、肯定 anchor が緩和にあたる)。Cypress の retry-ability は `cy.get(..., { timeout: 0 }).should('not.exist')` を同期の不在確認の形として載せ、Assertions の「Negative assertions」は "Negative assertions may pass for reasons you weren't expecting." と書く。肯定 assert と組にするのは、この否定の弱さに対するこのリポジトリの規範である (`src/test/assert/absent.ts`)

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

## 出典

explanation と how-to が拠る一次情報。

- 同梱の `@vitest/browser` 4.1.11 の `context.d.ts` (同期読み 4 メソッドと `findElement` の docstring) と `matchers.d.ts` (`expect.element` が受ける型の docstring)
- `@testing-library/dom` の `waitForElementToBeRemoved` (要素が最初から無いと throw する): <https://testing-library.com/docs/dom-testing-library/api-async/>
- Cypress の Assertions「Negative assertions」("Negative assertions may pass for reasons you weren't expecting."): <https://docs.cypress.io/app/references/assertions>
- Cypress の retry-ability (`cy.get(..., { timeout: 0 }).should('not.exist')` を「check synchronously that the element does not exist (no retry)」の形として載せる。`expectAbsent` と同じ形): <https://docs.cypress.io/app/core-concepts/retry-ability>
- jest-dom の `toHaveStyle`: <https://github.com/testing-library/jest-dom#tohavestyle>
- Playwright の Assertions (「non-retrying assertions ... can lead to a flaky test」。`expectAbsent` の `{ timeout: 0 }` が該当し、肯定 anchor が緩和にあたる): <https://playwright.dev/docs/test-assertions>
- Playwright の Test timeouts (assertion timeout を test timeout と分ける): <https://playwright.dev/docs/test-timeouts>
- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- vitest browser の locator: <https://vitest.dev/guide/browser/locators>
- vitest-dev/vitest#6983 / PR #6984 (`actionTimeout` の導入と、`expect.poll.timeout` が `expect.element` の口だというメンテナ回答): <https://github.com/vitest-dev/vitest/issues/6983>
- vitest-dev/vitest#7871 (action の timeout がテストの残り予算で縮む): <https://github.com/vitest-dev/vitest/issues/7871>
- vitest-dev/vitest#8308 (OPEN。`expect.poll.timeout` が `expect.element` に効かない): <https://github.com/vitest-dev/vitest/issues/8308>
- vitest-dev/vitest#9157 (`testTimeout` の既定が docs と食い違う可能性): <https://github.com/vitest-dev/vitest/issues/9157>
- vitest-dev/vitest#9751 (OPEN。timeout 設定の集約): <https://github.com/vitest-dev/vitest/issues/9751>
