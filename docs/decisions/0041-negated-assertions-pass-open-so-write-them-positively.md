# ADR-0041: 否定 assert は不在や綴り違いでも通るので、肯定で書く

- Status: Accepted
- Date: 2026-09-22
- 関連: ADR-0039 (assert には locator を渡す。その移行で否定 assert を一律に扱えないことが出た)、ADR-0036 (待機を retry API に委ねる)、ADR-0009 (ルールの選定基準)、ADR-0029 (`jsPlugins` で足す判断)

## Context

否定 assert には 3 つの素通り経路がある。いずれも「実装が壊れているのに緑で通る」向きに倒れる。要素が無くても通る肯定 matcher (`toHaveLength`) も、1 つ目と同じ穴を持つ。

### 要素が最初から無ければ 1 回目で通る

要素が無い状態から始まる `.not.toBeInTheDocument()` は、条件が最初から満たされているため 1 回目の試行で通る。DOM が確定する前でも通るので、その assert だけでは操作が効いたことを何も検証していない。

これは `@vitest/browser` が否定の `toBeInTheDocument` だけを特例にしているためで、他の否定 matcher とは挙動が違う。存在しない要素へ `.not.toHaveTextContent()` を当てると、要素が引けない間 retry して 2927ms 後に `Cannot find element with locator` で落ちた (2026-09-22、`testTimeout` 3000)。否定 matcher を一律に扱うと、この違いを踏む。

予算を下げてもこの問題は残る。待って成立しない条件にどんな予算を渡しても無駄に待つからで、区別は呼び出しごとにしか置けない (予算そのものは ADR-0040)。

同じ穴が `toHaveLength` にもある。こちらは否定ではないが、一致ゼロの locator へ `toHaveLength(0)` を当てると通る (2026-09-22 実測。一致しない `getByText` へ当てたテストが `Tests 1 passed (1)` で緑になる)。`expect.element` は retry のたびに locator を引き直すので、描画を待つ肯定 assert を先に置かないと、まだ描かれていない状態が 0 件として成立する。

### 解釈できない宣言は `not.toHaveStyle` を通す

期待値は probe 要素へ流し込まれ、ブラウザが受け付けた宣言だけが残る。単位の書き忘れや綴り誤りは空集合になり `.not` が真になる (2026-09-22 実測)。

| assert                                                  | 結果     |
| ------------------------------------------------------- | -------- |
| `.not.toHaveStyle("pointer-events: none")` (正しい宣言) | 落ちる   |
| `.not.toHaveStyle("outline-width: 0")` (単位なし)       | **通る** |
| `.not.toHaveStyle("pointer-evnets: none")` (綴り誤り)   | **通る** |
| `toHaveStyle("pointer-evnets: none")` (肯定形)          | 落ちる   |

### matcher を替えても、期待値がリテラルなら同じ

`expect.poll(() => getComputedStyle(x).outlineWidth).not.toBe("0")` も素通りする。算出値は `"0px"` なので、単位を落とした期待値との比較は潰れた状態でも真になる。潰れた outline で測ると `.not.toBe("0")` は通り、`.not.toBe("0px")` は落ちる (2026-09-22 実測)。**失敗の原因は matcher ではなく、期待値の綴りが 1 つ外れると否定が真になることである。**

## Decision

**否定 assert は、期待値がリテラルなら書かない。肯定で書く。** 例外は、要素が在る状態から消えるのを待つ `expectRemoved(locator)` と、期待値が別の観測である比較の 2 つに限る。

| 規範                                                                                                                                | 守らないと何が壊れるか                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 「最初から出ないこと」は `src/test/absent.ts` の `expectAbsent(locator)` で確かめ、同じ操作の効果を表す肯定 assert を先に置く       | この matcher は要素が無ければ 1 回目で通る。肯定 assert が無いと、検証しているつもりで何も検証していない   |
| 要素が在る状態から消えるのを待つときは `expectRemoved(locator)` を使う。素の `expect.element(x).not.toBeInTheDocument()` は書かない | 2 つは同じ matcher を呼ぶので、名前が無いとどちらのつもりかが字面で読めない                                |
| `.not.toBeInTheDocument()` 以外の否定 matcher には肯定 assert を添えなくてよい                                                      | 要素が引けない間 retry するため、不在のまま通ることがない                                                  |
| 件数は `expect.element(locator).toHaveLength(n)` で見る。`n` が 0 でなくても、描画を待つ肯定 assert を先に置く                      | 一致ゼロの locator でも `toHaveLength(0)` は通る。まだ描かれていない状態が 0 件として成立する              |
| スタイルをリテラルとの否定で確かめない。1 回の観測から数値を出すか、期待する値そのものと肯定で比べる                                | 綴りや単位が 1 つ外れると、潰れた状態のまま通る                                                            |
| `toHaveStyle` は文字列形式で書き、複数プロパティは `;` で 1 つにまとめる                                                            | オブジェクト形式は失敗しても差分が出ない。分けて書くと assert ごとに予算を使い、同時に成立しない状態も通る |
| `toHaveStyle` の 1 つの文字列に同じプロパティを 2 度書かない。shorthand で longhand を覆わない                                      | jest-dom は宣言を後勝ちで畳むため、先に書いたほうが黙って消える                                            |

肯定形の書き方は主張で決まる。「描かれている」「上限がある」なら `expect.poll(() => Number.parseFloat(getComputedStyle(x).outlineWidth)).toBeGreaterThan(0)` のように 1 回の観測から数値を出す。綴りを外しても `NaN` になって落ちる。当たっている token が分かっているなら `expect.element(x).toHaveStyle(`color: ${resolveColorToken("--foreground")}`)` のように値そのものと比べる (`src/components/parts/segmented-radio-group.test.tsx`)。観測が 2 つ要るなら 1 つの poll の中でまとめる。分けると別々の瞬間で成立してよいことになる。

## Consequences

### 不在の 2 つの意味は `src/test/absent.ts` の 2 つの名前が持つ

同じ matcher を呼ぶ 2 つのヘルパーを置く。`expectAbsent(x)` は `{ timeout: 0 }` で打ち切る不在確認、`expectRemoved(x)` は assert の予算ぶん待つ消滅待ちである。`{ timeout: 0 }` を外す退行は `src/test/absent.test.tsx` の所要時間の閾値が捕まえる (外すと同じ assert が 4 秒以上かけて落ちる)。素の `expect.element(x).not.toBeInTheDocument()` は `browser-test/no-bare-absence-assertion` が止める。

**予算の差は、落ちる向きの差である。** `expectAbsent` は「いま在る」で落ちる。予算を渡すとその向きに落ちなくなり、この assert が持つ唯一の反証条件が消える。`expectRemoved` はもともとその向きに落ちない。効率の差ではないので、2 つを 1 本へ畳むと `expectAbsent` の検出力がそのまま消える。

この差は `src/test/absent.test.tsx` が両方向のミューテーションで固定している (2026-09-22 実測)。`expectRemoved` から予算を奪うと「unmount が操作より後ろでも通る」が落ち、`expectAbsent` に予算を与えると「要素が在れば落ちる」の所要時間の閾値が落ちる。

**既存のテストで緑が割れないことは、差が無いことを意味しない。** `expectRemoved` を `{ timeout: 0 }` へ落として移行先 11 箇所を走らせても 43 件すべて緑だった (同日実測)。操作の `await` が React の更新を flush し、`src/test/browser-setup.tsx` が Base UI の animation を毎テスト無効にしている (ADR-0038) ため、assert の行では unmount が済んでいるからである。予算が効くのは `enableAnimations()` を呼んだテストと、flush を伴わない経路で消える場合で、`absent.test.tsx` はその後者を作って測っている。

名前を分ける理由は、取り違えが実際に起きたことにもある。本ブランチの `src/routes/notes/-components/note-cells.test.tsx` の 4 件は「最初から無い」を素の形で書いており、レビューが見つけて `1d987d5` で直した。機械では出なかった。

上流の対応物 `@testing-library/dom` の `waitForElementToBeRemoved` は、要素が最初から無いときに throw して取り違えをランタイムで止める。**この保証は移植できない。** 公式 API は操作の前に捕まえた要素を受け取る設計で、操作の後に assert を書く形では正当な消滅待ちでも `already removed` で落ちる (2026-09-22 に両方の向きで実測)。

素の呼び出しは `browser-test/no-bare-absence-assertion` が止める。壊し方を 2 つ当てた (2026-09-22)。直接は実コードへ素の形を戻すと 1 件報告され、間接は `lint.rules` を残したまま `src/test/absent.ts` の行単位抑制を外すと helper 自身が報告される。

**このルールが見るのは「名前を付けたか」であって「名前が正しいか」ではない。** `expectAbsent` と `expectRemoved` のどちらを選んでも報告しないので、上記 `1d987d5` の取り違えそのものは捕まえられない。買えるのは、素で書けば必ずどちらかを選ぶ地点に立たされることだけである。名前の真偽はレビューが見る。

### スタイルの否定は lint で止める

`browser-test/no-negated-style-literal` が、期待値がリテラルの否定 matcher を 2 つの起点から報告する。ルールの置き方は ADR-0039「機械強制は oxlint の JS plugin で書く」に従う。

| 起点                               | 報告する matcher         | 例                                                                  |
| ---------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `expect(...)` などの assert の起点 | `toHaveStyle` だけ       | `expect.element(x).not.toHaveStyle("outline-width: 0")`             |
| `getComputedStyle(...)`            | `toHaveStyle` 以外の全部 | `expect.poll(() => getComputedStyle(x).outlineWidth).not.toBe("0")` |

起点を 2 つに分けるのは、`toHaveStyle` が要素を主語に取り `getComputedStyle` を通らないためである。両方が同じ呼び出しを報告しないよう、後者は `toHaveStyle` を除く。

値の matcher (`not.toBe` 等) は期待値が式なら報告しない。観測どうしの比較は綴りで潰れないためである。`not.toHaveStyle` は形を問わず報告する。値に式を埋めても宣言名 (`color:`) は字面で、綴り違いは解釈できない宣言になって `.not` が真になる (2026-09-22 の再レビューで判明)。次のコマンドで数えると 10 件あった (2026-09-22)。

```bash
grep -rn --include='*.test.tsx' -E '\.not\.(toHaveStyle|toBe)\(' src/ | grep -iE 'getComputedStyle|Color|Width|Height'
```

導入時の違反は 1 件で、テンプレート初版 (`fb3433a`) から在った `src/components/parts/dialog-scroll-body.test.tsx` の `expect(shown.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")` である。

変数へ束縛してから読む形も 1 段だけ辿る。上の 1 件がその形だったので、追跡が無いと導入時の違反が 0 件に見えて、ルールが効いているように読める。

壊し方を 2 つ当てた (2026-09-22)。

| 壊し方 | 操作                                                        | 結果                                                                       |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| 直接   | 実コードへ `.not.toHaveStyle("max-height: none")` を戻す    | `vp lint` が 1 件報告する                                                  |
| 間接   | `lint.rules` は残したまま `lint.overrides` の適用先から外す | 違反が 0 件になり、`scripts/checks/integrity/lint-config.test.ts` が落ちる |

### ADR-0036 との関係

ADR-0036 の Decision の表は「close 後に要素が消えたことの確認」に **`expectRemoved(locator)` を充てる。** `expect.element(locator).not.toBeInTheDocument()` を素で書かない。ADR-0036 が決めた「待機を vitest の retry API に委ねる」ことはそのままで、`expectRemoved` はその式に名前を付けたものである。

### 肯定形は失敗するまで予算を使う

否定を肯定の `expect.poll` で書くと、失敗時の所要が変わる。否定は条件が最初から成立すれば即座に返るが、肯定は成立しない条件を assert の予算 (ADR-0040) いっぱいまで retry してから落ちる (2026-09-22 実測で 5121ms / 5343ms)。挙動としては正しく、赤の所要が延びるのは検出力と引き換えである。

### `toHaveStyle` で表せない 3 つの形

`toHaveStyle` で表せないので、`getComputedStyle` を `expect.poll` のコールバックの中で読む (ADR-0039)。

| 形                 | 例                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| 2 回の観測を比べる | `src/components/ui/sidebar.test.tsx` の「開く前後で背景色が変わったこと」                          |
| 数値の大小         | `expect.poll(() => Number(getComputedStyle(off).opacity)).toBeLessThan(...)`                       |
| 擬似要素を読む     | `getComputedStyle(el, "::before").content`。`toHaveStyle` は要素自身しか見ない (2026-09-22 に実測) |

ADR-0039 のルールは `expect.poll` のコールバックの中を見ないので、この 3 つより広い形も通る。狭めるには matcher を見る分岐が要る。先行例の `prefer-web-first-assertions` は `supportedMatchers` で matcher を見ているが、あれは autofix の可否を決めるためで範囲の限定ではない。本 ADR のルールは期待値がリテラルの否定だけを狭く止める。

### ルールが追えない形

`await expectAbsent(x)` の肯定 anchor が「同じ操作の効果を表す」かは構文で決まらない。直前の文が肯定 assert かどうかだけなら構文で見られるが、そのルールは作らない。違反が 0 件で、守る対象が無いためである。anchor の欠落が実際に起きた記録も無い (`1d987d5` の取り違えは名前の選択の誤りで、anchor の欠落ではない)。

代わりに、**要件を利用者が必ず読む場所へ置く。** `browser-test/no-bare-absence-assertion` の診断メッセージが anchor 要件を持つ。素の形を書いた利用者は `expectAbsent` と `expectRemoved` のどちらかを選ぶ地点に立たされ、そこで同時に anchor 要件を受け取る。`src/test/absent.ts` の docstring も規範として持ち、名前の真偽と anchor の妥当性はレビューで見る。

束縛を 2 段以上またぐ形も辿らない。ADR-0039 のルールと同じ理由で、任意段を追うのは taint 解析になる。

### 再評価の条件

- 上流が否定の `toBeInTheDocument` 以外にも特例を足したら、「肯定 assert を添えなくてよい」行を測り直す
- `@vitest/eslint-plugin` か `jest-dom` 側が同種のルールを持ったら、そちらへ移して自前のルールを消す

## 検討した選択肢

| 案                                                                                 | 評価                                                                                                                                                                                                                                                                                                                                                                                                                             | 採否     |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 期待値がリテラルの否定を lint で止め、肯定形へ移す                                 | 経路 2-3 は同じ「期待値の綴りで否定が真になる」に還元でき、式の構造で表せる。経路 1 と `toHaveLength` は期待値を取らないので lint では表せず、`expectAbsent` と肯定 anchor が持つ                                                                                                                                                                                                                                                | **採用** |
| 否定 assert には触れない                                                           | ADR-0039 の移行が 15 秒の赤を持ち込む。`toHaveStyle` の素通りは実測で 2 形あり、レビューでは字面が正しく見える                                                                                                                                                                                                                                                                                                                   | 却下     |
| `not.toHaveStyle` だけを止める                                                     | matcher を替えた同型 (`poll(...).not.toBe("0")`) が残る。失敗の原因は matcher ではなく期待値の綴りである                                                                                                                                                                                                                                                                                                                         | 却下     |
| 否定 matcher を全面禁止する                                                        | 観測どうしの比較 10 件が書けなくなる。綴りで潰れない形まで巻き込む                                                                                                                                                                                                                                                                                                                                                               | 却下     |
| `waitForElementToBeRemoved` を使う                                                 | 捕まえた要素の identity と「論理的に在る」が一致しない。React の再調停でノードが差し替わると、捕まえた側だけが detach して素通りする。`src/routes/notes/-components/notes-page.test.tsx` の楽観行が実データ行へ置き換わる経路がこれに当たる                                                                                                                                                                                      | 却下     |
| `toHaveStyle` をオブジェクト形式で書く                                             | 失敗時が `Expected styles could not be parsed by the browser. Did you make a typo?` だけになり、差分が出ない                                                                                                                                                                                                                                                                                                                     | 却下     |
| `expectAbsent` の anchor を引数で必須にする (`expectAbsent(x, { after: anchor })`) | 型で止まるのは anchor の書き忘れだけで、anchor が同じ操作の効果を表すかは変わらずレビューで見る。12 箇所中 2 箇所 (`toHaveValue("")` / `not.toHaveAttribute`) は locator の存在で表せず thunk が要り、その時点で強制が形だけになる。anchor を API で強制する先行例は無く、公式が実行時に「先に在ること」を強制するのは消滅待ち (`waitForElementToBeRemoved`) だけで、「最初から無いこと」には前提条件そのものが無い (2026-09-22) | 却下     |

失敗時の文言を比べた (2026-09-22)。

| 書き方                                                   | 失敗時                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `toHaveStyle("pointer-events: auto")`                    | `- Expected` / `+ Received` の差分が出る                                                      |
| `toHaveStyle({ pointerEvents: "auto" })`                 | `Expected styles could not be parsed by the browser. Did you make a typo?` だけで差分が出ない |
| `expect(getComputedStyle(x).pointerEvents).toBe("auto")` | `expected 'none' to be 'auto'`                                                                |

## 出典

- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- 同梱の `@vitest/browser` 4.1.11 の `matchers.d.ts` (`expect.element` が受ける型)
- jest-dom の `toHaveStyle`: <https://github.com/testing-library/jest-dom#tohavestyle>
- Playwright の Assertions (「non-retrying assertions ... can lead to a flaky test」。`expectAbsent` の `{ timeout: 0 }` が該当し、肯定 anchor が緩和にあたる): <https://playwright.dev/docs/test-assertions>
- Cypress の retry-ability (`cy.get(..., { timeout: 0 }).should('not.exist')` を「check synchronously that the element does not exist (no retry)」の形として載せる。`expectAbsent` と同じ形): <https://docs.cypress.io/app/core-concepts/retry-ability>
- Cypress の Assertions「Negative assertions」(否定 assert は意図しない理由で通るので肯定 assert と組にする): <https://docs.cypress.io/app/references/assertions>
- `@testing-library/dom` の `waitForElementToBeRemoved` (要素が最初から無いと throw する): <https://testing-library.com/docs/dom-testing-library/api-async/>
- `eslint-plugin-testing-library` の `prefer-presence-queries` (在る / 無いの assert で `getBy*` / `queryBy*` を使い分けさせる) と `prefer-query-by-disappearance` (消滅待ちには `queryBy*`)。不在 assert の書き分けを lint で持つ概念上の先行例。対象が Testing Library の query 名なので `browser-test/no-bare-absence-assertion` の流用元にはならない: <https://github.com/testing-library/eslint-plugin-testing-library/tree/main/docs/rules>

ルールの置き方と、その根拠となる oxlint の JS plugin の出典は ADR-0039 が持つ。
