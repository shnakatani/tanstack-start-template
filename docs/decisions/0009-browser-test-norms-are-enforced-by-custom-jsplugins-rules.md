# ADR-0009: ブラウザテストの規範は jsPlugins の自前ルール (`browser-test/*`) で止める

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0007 (ルールの選定基準)、ADR-0023 (`jsPlugins` で足す判断)

## Context

ブラウザテストの assert には、書き方を 1 つ外すと「実装が壊れているのに緑で通る」か「落ちたときに原因が読めない」へ倒れる形がある。どれも字面は正しく見えるので、レビューでは落ちない。

| 形                                                                                             | 壊れ方                                                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 同期読み (`element()` / `query()` / `all()` / `elements()`) の値を `expect()` へ流す           | retry を持たないので DOM の確定前に評価されて flake する。失敗しても locator の名前が出力に残らない |
| `locator.findElement()` を呼ぶ                                                                 | assert の予算の設定の下では待機が上限なしになり、`Test timed out` で落ちて locator の名前が消える   |
| `not.toHaveStyle(...)`、`getComputedStyle` 起点で期待値がリテラルの否定 (`not.toBe("0")` など) | 期待値の綴りが 1 つ外れると否定が真になり、潰れた状態でも通る                                       |
| 素の `expect.element(x).not.toBeInTheDocument()`                                               | 「最初から無い」と「消えるのを待つ」を書き分けられず、取り違えても通る                              |

規範そのもの (何を書き、なぜそう書くか) と実測は `docs/guides/testing.md` にある。ここで決めるのは、その規範をどう守らせるかである。

- レビューでは守れない。判断を誤ってもほとんどの実行で通るので、字面を読むレビューでは落ちない。同期読みを assert へ流す形は、待機を retry API に委ねると決めた後も、レビューを経た変更が新しく足している (`91515ee`)
- 上流の `@vitest/eslint-plugin` はこの形のルールを持たない。ルールの一覧を `gh api repos/vitest-dev/eslint-plugin-vitest/contents/docs/rules` で取り、`locator` / `element` / `browser` / `poll` を含む名前を数えると 82 本中 1 本で (2026-09-22)、該当した `require-awaited-expect-poll` は `await` の付け忘れを見るもの (ADR-0007 が `correctness` 経由で有効と記録)
- 同じ趣旨のルールは他のエコシステムにある。`eslint-plugin-playwright` の `prefer-web-first-assertions` が `expect(await locator.isVisible()).toBe(true)` を報告し、"web first assertions will automatically wait for the conditions to be fulfilled resulting in more resilient tests" を理由に挙げる。対象 API が違うため流用はできない
- 禁止したい形は実行時の履歴ではなく式の構造で表せる。「同期読みの値が `expect()` の引数へ届くこと」「`not.toHaveStyle` の呼び出し」「算出値と期待値がリテラルの否定」は 1 ファイルの構文で判定できる

## Decision

**ブラウザテストの規範のうち式の構造で表せるものは、`scripts/lint/browser-test.ts` の自前ルールを `vite.config.ts` の `lint.jsPlugins` から読み、`error` で止める。**

| ルール                                   | 止める形                                                                                                                                                                                                                                                                                            | 規範の説明                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `browser-test/prefer-locator-methods`    | 同期読みの値が `expect()` / `assert` の引数へ届く (1 段の変数束縛を含む)                                                                                                                                                                                                                            | `docs/guides/testing.md`「同期読みを書き換える」 |
| `browser-test/no-find-element`           | `locator.findElement()` の呼び出し。呼び出し元の場所を見ず、除外を置かない                                                                                                                                                                                                                          | `docs/guides/testing.md`「待つ口を選ぶ」         |
| `browser-test/no-negated-style-literal`  | `expect(...)` 起点の `not.toHaveStyle` は引数の形を問わず報告する (値に式を埋めても宣言名は字面で、綴り違いは解釈できない宣言になって `.not` が真になる)。`getComputedStyle(...)` 起点の `toHaveStyle` 以外の否定 matcher は、期待値がリテラルのときだけ報告する (観測どうしの比較は綴りで潰れない) | `docs/guides/testing.md`「否定を肯定で書く」     |
| `browser-test/no-bare-absence-assertion` | 素の `expect.element(x).not.toBeInTheDocument()`。`expectAbsent` / `expectRemoved` を通させる                                                                                                                                                                                                       | `docs/guides/testing.md`「否定を肯定で書く」     |

- 実行経路は増やさない。`vp lint` と `vp check` で走り、`@shadcn/lint` と `eslint-plugin-testing-library` が既に同じ経路に載っている (ADR-0023、`docs/guides/lint.md`「testing-library を当てる範囲」)
- severity は `error` にする。`vp check` は warn で exit 1 にならないため、新規コードへの強制力を失う
- 適用先はブラウザテスト本文と、そこへ locator を配る helper (`src/test/**` と `*.test-helpers.*`) にする。テスト本文だけに当てると、helper へ切り出した同期読みがルールから外れる。glob は `scripts/lib/companion-files.ts` から引く
- `src/test/*.test.ts` は外す。unit project は locator を持たず、drizzle の `db.select().from(x).all()` が同じメソッド名で誤検出になる (2026-09-22 実測。`src/**` へ広げると `src/server/db/index.test.ts` の 2 件が出る)
- ルールは「locator かどうか」をメソッド名と引数ゼロだけで判定し、適用先の glob がその補いになる。oxlint の JS plugin は型情報を持たない (公式の JS plugin ガイドの「Not supported yet」に「Lint rules that rely on TypeScript type-awareness」)
- 未移行のファイルを `lint.overrides` で列挙して段階的に当てる形は取らない。列挙が対象より大きくなり、一覧を消す作業が別に要る
- ルールの書き方と、2 通りに壊して効いていることを確かめる手順は `docs/guides/lint.md`「自前のルールを書く」「検査を作ったら 2 通りに壊して確かめる」にある

### ルールで止めない規範

| 規範                                                  | 止めない理由                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 生 DOM を読む場所 (操作を挟んだか) の残りの形         | 実行時の履歴で決まり、式の構造で表せない。レビューで見る                                                                                                                                    |
| 合成イベントを使わない                                | 合成イベントを送る helper を `src/test/` に置かないことで経路を持たない                                                                                                                     |
| animation を無効にする既定                            | `src/test/browser-setup.tsx` の setup が持ち、書き手が選ぶものではない                                                                                                                      |
| route の wrapper のテストの置き方                     | 置き方の選択で、式の形に出ない。レビューで見る                                                                                                                                              |
| `expectAbsent` の肯定 anchor が同じ操作の効果を表すか | 構文で決まらない。直前の文が肯定 assert かどうかなら見られるが、違反が 0 件で守る対象が無い。要件は `no-bare-absence-assertion` の診断メッセージと `src/test/absent.ts` の docstring に置く |
| `expectAbsent` と `expectRemoved` のどちらが正しいか  | ルールが見るのは「名前を付けたか」で、「名前が正しいか」ではない。素で書けば必ずどちらかを選ぶ地点に立たされることだけを買う                                                                |

### 検討した選択肢

| 案                                                                                              | 評価                                                                                                                                                                                                                                                                                                                                                                                                                             | 採否     |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 式の構造で表せる規範を `jsPlugins` の自前ルールで報告する                                       | 禁止したい形が式の構造で表せる。公式が DANGER 表記で同じ向きを案内しており、他エコシステムに先行例がある                                                                                                                                                                                                                                                                                                                         | **採用** |
| レビューで見る                                                                                  | `91515ee` がレビューを経て同じ形を新しく足している。判断を誤ってもほとんどの実行で通るため、レビューでは落ちない                                                                                                                                                                                                                                                                                                                 | 却下     |
| `element()` を全面禁止し `findElement()` に統一する                                             | `getBoundingClientRect` などの実測が待つ理由のない箇所まで `await` になる                                                                                                                                                                                                                                                                                                                                                        | 却下     |
| 代替 matcher の無い読み (`getBoundingClientRect` 等) を列挙して直接 `expect()` へ流すことを許す | 1 要素ずつ外すと helper の自己テスト 1 件を除き 0 件で、守る対象が無い (2026-09-22 実測)。`expect.poll` の中で読めば retry も付く                                                                                                                                                                                                                                                                                                | 却下     |
| `lint.overrides` で未移行ファイルを列挙して段階移行する                                         | 列挙と、それを消す作業のほうが移行より大きい (2026-09-22 時点で対象は 13 ファイル)                                                                                                                                                                                                                                                                                                                                               | 却下     |
| severity を `warn` にして移行を待つ                                                             | `vp check` は warn で exit 1 にならず、新規コードへの強制力を失う (`docs/guides/lint.md`「testing-library を story に限る理由」の `no-debugging-utils` と同じ判断)                                                                                                                                                                                                                                                               | 却下     |
| 型の代わりに receiver の連鎖を辿って locator を判定する                                         | `confirmDeleteButton(screen).element()` のように helper が返す locator は連鎖に生成口を持たず、型なしでは追えない (2026-09-22 時点で 3 件、増える側)                                                                                                                                                                                                                                                                             | 却下     |
| `expectAbsent` の anchor を引数で必須にする (`expectAbsent(x, { after: anchor })`)              | 型で止まるのは anchor の書き忘れだけで、anchor が同じ操作の効果を表すかは変わらずレビューで見る。12 箇所中 2 箇所 (`toHaveValue("")` / `not.toHaveAttribute`) は locator の存在で表せず thunk が要り、その時点で強制が形だけになる。anchor を API で強制する先行例は無く、公式が実行時に「先に在ること」を強制するのは消滅待ち (`waitForElementToBeRemoved`) だけで、「最初から無いこと」には前提条件そのものが無い (2026-09-22) | 却下     |

先行例の `prefer-web-first-assertions` も receiver を見ず、`expect()` から辿って引数をスコープで解決し、メソッド名だけで判定する。適用範囲の限定は利用者の設定に委ねている。glob で範囲を限るのは同じ形で、`element` / `all` のように名前が一般的なぶん範囲の限定が要る、という違いだけである。

## Consequences

- ルールを有効にした時点の違反は、`prefer-locator-methods` が 54 件 (1 行の grep で数えた 45 件 / 13 ファイルに、変数へ束縛してから渡す 9 件)、`no-find-element` が 0 件 (同じ日に `expect.element` へ寄せる前は 16 箇所あり、`actionTimeout` を置いた時点で全部の待機が上限なしになっていた)、`no-negated-style-literal` が 1 件 (`src/components/parts/dialog-scroll-body.test.tsx` の `expect(shown.borderTopColor).not.toBe("rgba(0, 0, 0, 0)")`) だった (2026-09-22)。1 行の grep は束縛を挟む形を取りこぼすので、件数はルールで数える
- 4 ルールの override は `scripts/checks/integrity/lint-config.test.ts` が解決後の設定で固定する。適用先か severity を動かすとそこが落ちる
- 効いていることは壊し方 2 つで確かめた (2026-09-22)

| ルール                      | 直接                                                                | 間接                                                                                                     |
| --------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `prefer-locator-methods`    | `lint.rules` で `off` にすると 2 件 → 0 件                          | 変数束縛の追跡 (`context.sourceCode.getDeclaredVariables`) を止めると 2 件 → 1 件 (束縛の形が無言で通る) |
| `no-find-element`           | `off` にすると 1 件 → 0 件                                          | メソッド名の判定を壊すと 1 件 → 0 件                                                                     |
| `no-negated-style-literal`  | 実コードへ `.not.toHaveStyle("max-height: none")` を戻すと 1 件報告 | `lint.rules` を残したまま override の適用先から外すと 0 件になり、`lint-config.test.ts` が落ちる         |
| `no-bare-absence-assertion` | 実コードへ素の形を戻すと 1 件報告                                   | `lint.rules` を残したまま `src/test/absent.ts` の行単位抑制を外すと helper 自身が報告される              |

- 変数束縛を 1 段追うのは、束縛を挟む形が多いためである。`grep -rE 'const \w+ = [^;]*\.(element|query|all|elements)\(\)' --include='*.test.tsx' src/` で 64 行 / 17 ファイルあった (2026-09-22)。追跡が外れても直接の形は報告され続けるので、設定は有効に見える。`no-negated-style-literal` の上の 1 件も束縛を挟む形で、追跡が無いと違反が 0 件に見えてルールが効いているように読める

- 判定は 1 ファイルの構文だけで行う。同期読み由来の値は、関数の引数・演算・テンプレート・`await`・`new`・1 段の束縛を通っても `expect()` / `assert` の引数に届けば報告する。`expect.poll` と `vi.waitFor` に直に渡したコールバックは retry されるので、その中の同期読みは報告しない (`scripts/lint/browser-test.ts` の `RETRYING_CALLBACK_CALLEES`)。`expect.element` の引数は呼び出し時に 1 度だけ評価されるので報告する
- 次の形は報告しない。件数をこのルールで数えるときは、数えた結果がこの範囲を出ない

| 形                                                  | 例                                                                                                                  | なぜ追えないか                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 束縛を 2 段以上またぐ                               | `const el = x.element(); const t = el.textContent; expect(t)...`                                                    | 参照を 1 段だけ辿る。任意段を追うのは taint 解析になる                                                                                           |
| helper の戻り値                                     | `expect(titleTextbox(screen).query())` を別ファイルの helper が包む                                                 | 関数を跨いだ追跡が要る。先行例も 1 段の dereference に留めている                                                                                 |
| 束縛した観測の基準値を matcher の期待値に使う       | `const before = getComputedStyle(x.element()).color; … .toBe(before)`                                               | 操作の前後の観測を比べる形 (`docs/guides/testing.md`「否定を肯定で書く」)。連鎖を束縛した値は `expect()` / `assert` の主語に届くときだけ報告する |
| 束縛した同期読みを retry コールバックの中で参照する | `const el = x.element(); await expect.poll(() => el.textContent)`                                                   | 要素は引き直されず stale のまま retry される。基準値の参照 (`before`) と型なしで区別できないので飛ばす。要素は poll の中で引き直す               |
| 宣言以外の束縛                                      | `let el; el = x.element(); expect(el)`、`for (const row of rows.all())`、`rows.all().forEach((row) => expect(row))` | 追うのは `const` / `let` の宣言子だけ。代入・for-of・コールバック引数は追わない                                                                  |
| 値の流れを止める節点                                | `expect(map[x.element().id])`、`expect((f(), x.element()))`、`` html`${x.element().outerHTML}` ``                   | 計算プロパティのキー、sequence、tagged template は透かさない                                                                                     |

### 再評価の条件

- `@vitest/eslint-plugin` か `jest-dom` 側が同種のルールを持ったら、そちらへ移して自前のルールを消す

## 出典

- vitest browser の locator (同期読みの DANGER 表記): <https://vitest.dev/guide/browser/locators>
- 同梱の `node_modules/vite-plus/docs/guide/lint.md`「JS Plugins」
- oxlint の JS plugin 作成ガイド: <https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html>
- `eslint-plugin-playwright` の `prefer-web-first-assertions`: <https://github.com/playwright-community/eslint-plugin-playwright/blob/main/docs/rules/prefer-web-first-assertions.md>
- `eslint-plugin-testing-library` の `prefer-presence-queries` と `prefer-query-by-disappearance` (不在 assert の書き分けを lint で持つ概念上の先行例。対象が Testing Library の query 名なので流用元にはならない): <https://github.com/testing-library/eslint-plugin-testing-library/tree/main/docs/rules>
