# テストのモジュール差し替え

テストで `vi.mock` を使ってモジュールを差し替えるときの形の選び方と、`__mocks__` の置き方、環境変数とグローバルの差し替えを持つ。

| 決定                                                                                         | ADR      |
| -------------------------------------------------------------------------------------------- | -------- |
| ドメインに属するコードは `src/features/<domain>/` へ集め、環境はファイル名の接尾辞で宣言する | ADR-0010 |
| server function をデータ境界とし、全 fn 共通の middleware は global に載せる                 | ADR-0012 |

## how-to

### 差し替えの形を選ぶ

| 場面                                                                  | 形                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同じモジュールを複数のテストで丸ごと差し替える (server function など) | 隣の `__mocks__/<同名>` に `vi.fn()` を並べ、各テストは factory なしの `vi.mock(import(...))` で読む                                                                                                                                          |
| 1 つのテストだけで丸ごと差し替える                                    | `vi.mock(import(...), () => ({ ... }))` の factory                                                                                                                                                                                            |
| 元のモジュールを残して一部の export だけを変える (partial mock)       | factory で `importOriginal()` を展開し、変える export だけ上書きする。`__mocks__` では書かない (「`__mocks__` で元を展開して一部だけ差し替えない理由」)。実例は `docs/guides/testing/user-interactions.md`「debounce のある入力をテストする」 |

- 差し替えたモジュールは静的 import で受け、`vi.mocked(fn)` で戻り値を決める。`vi.mock` は巻き上げられ、すべての import より先に実行されるので、`await import` で後から読まなくても差し替え後のモジュールが届く ([Vitest docs「vi.mock」][] の本文)
- factory の中から factory の外の変数を参照しない。`vi.mock` は巻き上げられるので、`There was an error when mocking a module` で落ちる ([Vitest docs「vi.mock」][] の warning、2026-09-28 に 5.0.1 で実測)。外の値が要るなら `vi.hoisted` で定義する
- `__mocks__` の export は元と同じ名前を全部並べ、元に export を足したら mock にも足す。手書きの mock は元の変更に追随しない ([Jest docs「Manual Mocks」][])。足し忘れると import 側が `does not provide an export named` の SyntaxError で落ちる
- `__mocks__` は coverage の分母から外す (`tooling/test/config.ts` の `coverage.exclude`)。`coverage.include` が `src/**` を含み、`coverage.exclude` の既定は空なので、外さないと出荷されないファイルが分母に入る ([Vitest docs「coverage.exclude」][])

### 戻り値を決める

| 場面                                                                | 形                                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 引数ごとに応答を変える (検索語ごとの一覧、対象の id ごとの保存)     | `vi.when(vi.mocked(fn), { onUnmatched: "throw" }).calledWith(引数).thenResolve(値)`。`mockImplementation` に引数の分岐を手書きしない。登録していない引数で呼ばれると例外になる ([Vitest docs「vi.when」][]) |
| 同じ引数で、呼ばれる順に応答を変える (初回の取得と、更新後の再取得) | `mockResolvedValueOnce(初回).mockResolvedValue(以降)`                                                                                                                                                       |
| 応答の時点をテストで握る                                            | 引数を問わないなら `deferMock(fn)` (`src/test/app/defer-mock.ts`)。引数ごとに握るなら `Promise.withResolvers()` を作り、`vi.when` の `thenReturn(pending.promise)` に渡す                                   |

- 途中から応答を変えるなら、最初の `vi.when` の戻り値に同じ引数の `calledWith` を積み足す。同じ引数の behavior に後から足した応答 (action) が先に使われ、無期限の応答なら以降は前の応答に戻らない ([Vitest docs のレシピ「Conditional Mocking with vi.when」][] の Stacking actions)
- 登録した引数が全部呼ばれたことを、`vi.when` の戻り値に `expect(戻り値).toHaveBeenExhausted()` を当てて閉じる。呼び出しを待つ途中なら `await expect.poll(() => 戻り値).toHaveBeenExhausted()` で待つ
- `onUnmatched: "throw"` は登録していない引数での呼び出しを、`toHaveBeenExhausted` は登録した引数で呼ばれなかったことを捕まえる。呼ばれなかった `calledWith` と応答が失敗の文言に並ぶ
- 期限の無い応答 (`thenResolve` / `thenReturn`) は 1 回使えば消費済みに数える ([Vitest docs のレシピ「Conditional Mocking with vi.when」][] の Asserting that all behaviors were called、2026-09-29 に vitest 5.0.1 の browser mode で実測)
- 期限の無い応答は 2 回目以降も応答し続け、消費済みの判定は増えた呼び出しを数えない。同じ引数での回数まで確かめるなら `toHaveBeenCalledTimes` を並べる ([Vitest docs のレシピ「Conditional Mocking with vi.when」][] の Asserting that all behaviors were called)
- 同じ spy で、`vi.when` と、あとからの差し替え (`mockImplementation` / `mockResolvedValue` / `deferMock`) や `mock*Once` を混ぜない
- `vi.when` は spy の実装を差し替える。あとから差し替えると `vi.when` の振る舞いがすべて外れ、`onUnmatched: "throw"` も効かなくなる (2026-09-28、vitest 5.0.1 で実測)
- 未消費の `mock*Once` は、引数を問わず `vi.when` より先に使われる (2026-09-28、vitest 5.0.1 で実測)
- `onUnmatched: "throw"` の例外は、呼んだアプリのコードがエラー処理で受け止めると、テストの失敗の文言に出ない。後段の assert で落ちて理由が読めないときは、`vi.mocked(fn).mock.results` を見る
- `mock.results` には `vi.when: no behavior defined when called with [...]` の例外と、渡った引数が入る (文言の形は [Vitest docs のレシピ「Conditional Mocking with vi.when」][] の `onUnmatched` の例)

### 環境変数とグローバルを差し替える

`import.meta.env` と `process.env` の値は `vi.stubEnv` で、`globalThis` (ブラウザでは `window`) のグローバルは `vi.stubGlobal` で差し替え、テストの中では戻さない。戻すのは 2 か所で、どちらも全 project に効く。理由は「差し替えの戻しを設定と setup の両方に置く理由」。

| 戻す場所                                                                | 時点         |
| ----------------------------------------------------------------------- | ------------ |
| `tooling/test/config.ts` の `unstubEnvs: true` と `unstubGlobals: true` | 各テストの前 |
| `tooling/test/setup.ts` (root の `setupFiles`) の `afterEach`           | 各テストの後 |

- `vi.stubEnv` と `vi.stubGlobal` は `beforeEach` かテストの中で呼ぶ (`vi.mock` は最上位のまま)。テストファイルと setup ファイルの最上位、`beforeAll` で差し替えた値は、最初のテストの前に戻る。全テストに効かせる差し替えは、setup ファイルの `beforeEach` に書く。env は差し替える前の値で、グローバルは差し替える前のもの (ブラウザでは本物の `matchMedia` など) で走り、差し替えが効いていないことに気付かずに通ることがある。[Vitest docs「Mocking Globals」][] の例は最上位で `vi.stubGlobal` を呼ぶが、この形にしない
- `.concurrent` を付けたテストでは `vi.stubEnv` も `vi.stubGlobal` も使わない。並行して走っている別のテストが差し替えた値も、設定は別のテストが始まるたびに、setup の `afterEach` は別のテストが終わるたびに戻す ([Vitest docs「unstubEnvs」][] と [Vitest docs「unstubGlobals」][] の warning。vitest 5.0.1、unit project に `maxConcurrency: 2` を書いて 2026-10-04 に実測)
- テストの中でグローバルを差し替えるときは `vi.stubGlobal` を使い、`globalThis` へ代入しない。代入した値は設定も setup も戻さず、後のテストへ残る ([Vitest docs「vi.stubGlobal」][] の tip: "you won't be able to use `vi.unstubAllGlobals` to restore original value")。差し替える関数が `onTestFinished` で戻しを登録する値 (`src/test/browser/animations.ts` の Base UI のフラグ) は、同じ関数が戻す停止用の CSS と戻し方をそろえるので代入でよい (`docs/guides/testing/user-interactions.md`「animation を戻す経路」)
- 差し替えた値 (env やグローバル) を使う非同期の処理 (再取得、タイマー) は、テストの中で終わりまで待つ。`render()` で描いた部品は次のテストの前まで残る ([vitest-browser-react の README][] の "performs cleanup of the component before the test begins") が、差し替えた値はそれより先に戻るので、テストの後に走る処理は差し替える前の値を使う
- env はモジュールの最上位ではなく、呼び出しの時点で読む。最上位で読んだ値は、テストで差し替えても変わらない

## explanation

### `__mocks__` に寄せる理由

同じ factory を複数のテストに書くと、差し替え先のモジュールに export を足すたびに全部を同時に直すことになる。`__mocks__` に置けば直す場所は 1 つになる。

- factory も `__mocks__` も無い `vi.mock(path)` は、元のモジュールを読んで export を自動で mock する ([Vitest docs「vi.mock」][]、[vitest-dev/vitest#7733][] のメンテナの回答)。元を読むので、元が引く依存も読まれる
- server function のファイルは Start の server runtime を引く。ブラウザで読むと `node:async_hooks` の読み込みで落ちる (2026-09-28、vitest 5.0.1 で `__mocks__` を外して実測)。factory か `__mocks__` で、元を読まずに差し替える必要がある
- browser mode でも、factory なしの `vi.mock` は `__mocks__` を使う ([vitest-dev/vitest#5765][] が browser mode に module mocking を入れた)
- `__mocks__` が無視されるという未解決の報告がある ([vitest-dev/vitest#8343][]。alias でも相対 import でも起きるとされる)。このリポジトリの構成では、`@/` の alias で指す形で `__mocks__` が解決される (2026-09-28、vitest 5.0.1 で実測)。相対 import の形は測っていない

### `__mocks__` で元を展開して一部だけ差し替えない理由

Jest は、manual mock と実装の同期を保つ手段として、mock の中で `jest.requireActual` で元のモジュールを読み、一部だけ差し替えて export する形を挙げている ([Jest docs「Manual Mocks」][])。このリポジトリの構成では、この形が取れない。

| 書き方 (`__mocks__` の中)                 | 結果 (2026-09-28、vitest 5.0.1 の browser mode で実測)                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export * from "../<元>"`                 | import した export が `undefined` になり、呼ぶと `real is not a function` のように落ちる。元のパスも差し替え対象として解決され、mock 自身を読んだと推定している |
| `vi.importActual("../<元>")` (相対パス)   | `Cannot resolve "../<元>" imported from "/src/..."` で落ちる                                                                                                    |
| `vi.importActual("@/...")` (alias)        | 同じ `Cannot resolve` で落ちる                                                                                                                                  |
| `vi.importActual("/src/...")` (root 起点) | 解決される。ただし ESM では元の export を展開して並べられず、名前で 1 つずつ並べ直すことになり、直す場所が増える                                                |

- `importActual` に渡る importer は、テストファイルからは絶対パス、`__mocks__` からはブラウザ側の URL (`/src/...`) だった (2026-09-28、vitest 5.0.1 で実測)
- [`@vitest/mocker` の `node/resolver.ts`][] の `resolveId` は importer を加工せずに解決へ渡し、同じファイルの `resolveMockId` は root と join する。相対パスが落ちる原因はこの差と推定している
- 一部だけ変えるなら、partial mock を各テストの factory で書く。factory の `importOriginal` はテストファイルを起点に解決されるので、この問題に当たらない

### 差し替えの戻しを設定と setup の両方に置く理由

[Vitest docs「Mocking」の Mock a global variable][] は、`vi.stubGlobal` の値は `unstubGlobals` を有効にするか `vi.unstubAllGlobals` を呼ばない限りテストの間で戻らない、と書く。[Vitest docs「Mocking」の Mock `import.meta.env`][] は、自動で戻したいなら `vi.stubEnv` を `unstubEnvs` と使うか、`beforeEach` で `vi.unstubAllEnvs` を手で呼ぶよう書く (既定で戻らないとは書かないが、自動で戻す手段として挙げている)。どちらにするかの推奨は無く、既定は戻さない側である ([Vitest docs「unstubGlobals」][] の Default は `false`)。設定は 1 行で全 project に届く。inline の project は root の設定を継承する ([Vitest docs「Projects」][] の Configuration)。

設定が戻す時点は、docs の中で食い違う。[Vitest docs「unstubGlobals」][] の本文は "Should Vitest automatically call `vi.unstubAllGlobals()` before each test." と書き、同じページの warning は "the completion of one test will restore all global values" と書く。[Vitest docs「Mocking Globals」][] は "restore the original values after each test" と書く。実測では次のテストの前だった。最上位で差し替えた値は最初のテストの時点で既に戻り、並行のテストでは、設定だけのときは短いテストが終わった時点では戻らず、次のテストが始まった時点で長いテストの値が戻った (2026-10-04)。

設定だけでは塞げない窓がある。戻すのが次のテストの前なので、`--no-isolate` で走らせると、ファイルの最後のテストの値が、同じ worker で次に走るファイルのモジュール評価と `beforeAll` に見える。最後のテストで stub して戻さないファイルと、モジュールの最上位と `beforeAll` で env を読むファイルを `--no-isolate --no-file-parallelism --sequence.shuffle.files` でseed を 5 通り変えて走らせると、unit と browser の両 project で値が残る seed があった。setup の `afterEach` を足すと、5 通りのどれでも残らなかった (vitest 5.0.1、2026-10-02 に実測。`vi.stubGlobal` は 2026-10-04 に unit と browser の両 project で同じ形を確かめた。browser では `matchMedia` の差し替えも、setup の `afterEach` が無いと次のファイルのモジュール評価と `beforeAll` に残った)。setup file は `--no-isolate` でもファイルごとに走り直し、hook もファイルごとに置き直される ([Vitest docs「setupFiles」][] の warning にある `afterEach` の例と同じ形)。

戻し方ごとに、差し替えた値がどこで見えるかを測った (vitest 5.0.1、unit project、2026-10-04。`vi.stubEnv` と `vi.stubGlobal` で同じ結果。`--no-isolate` の行は、差し替えるファイルの後に読むファイルが走った seed で測った)。

| 場面                                                        | 戻さない (既定)      | 設定と setup の `afterEach` | setup の `afterAll` |
| ----------------------------------------------------------- | -------------------- | --------------------------- | ------------------- |
| 最上位か `beforeAll` で差し替えた値                         | 効く                 | 最初のテストの前に戻る      | 効く                |
| `beforeEach` で差し替えた値                                 | 効く                 | 効く                        | 効く                |
| テストの中で差し替えた値が、同じファイルの次のテストで      | 残る                 | 戻っている                  | 残る                |
| `--no-isolate` で、前のファイルの最後のテストが差し替えた値 | 次のファイルに見える | 見えない                    | 見えない            |
| `.concurrent` で、並行する短いテストが終わったあと          | 残る                 | 戻る                        | 残る                |

| 案                                                                                                                                                                | 評価                                                                                                                                                                                                                                                                                                                                                                                   | 採否     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 設定と setup の `afterEach` の両方で戻す                                                                                                                          | どのテストも差し替えの無い状態から始まり、順番で結果が変わらない。テストに後始末を書かない。最上位と `beforeAll` の差し替えは外れるので、書く場所を `beforeEach` とテストの中に限る                                                                                                                                                                                                    | **採用** |
| 戻さない (既定。[Vitest docs「Mocking Globals」][] の例の形)                                                                                                      | テストの中の差し替えが後のテストへ、`--no-isolate` ではファイルをまたいで残り、気付く手段が無い                                                                                                                                                                                                                                                                                        | 却下     |
| setup の `afterAll` だけで戻す                                                                                                                                    | 最上位の差し替えが効き、ファイルをまたいでも残らないが、テストの中の差し替えは同じファイルの後のテストへ残る。毎テスト戻る前提のテストが壊れ、`vi.stubEnv` にも当てると `src/components/screens/route-error.test.tsx` の「DEV でも stack を出さない」が、同じファイルの「production では raw な error.message を出さず固定文言だけを出す」の `vi.stubEnv("DEV", false)` が残って落ちた | 却下     |
| 設定だけで戻す                                                                                                                                                    | 公式が先に挙げる形。`--no-isolate` では、ファイルの最後の値が次のファイルのモジュール評価と `beforeAll` に残る                                                                                                                                                                                                                                                                         | 却下     |
| setup の `afterEach` だけで戻す                                                                                                                                   | 最上位と `beforeAll` の差し替えが、最初のテストでだけ効いて 2 つ目から外れる                                                                                                                                                                                                                                                                                                           | 却下     |
| 使うテストファイルごとに `beforeEach` で `vi.unstubAllEnvs` / `vi.unstubAllGlobals` を呼ぶ ([Vitest docs「Mocking」の Mock `import.meta.env`][] が書く手で戻す形) | 書き忘れたファイルでは値が後のテストへ残り、気付く手段が無い。`--no-isolate` では、設定だけと同じく前のファイルの値がモジュール評価と `beforeAll` に見える                                                                                                                                                                                                                             | 却下     |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vitest は 5.0.1 に固定した版を指す。

[Vitest docs「vi.mock」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/vi.md#vimock
[Jest docs「Manual Mocks」]: https://jestjs.io/docs/manual-mocks
[Vitest docs「coverage.exclude」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/coverage.md#coverageexclude
[Vitest docs「vi.when」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/vi.md#viwhen-500-vi-when
[Vitest docs のレシピ「Conditional Mocking with vi.when」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/recipes/conditional-mocking.md
[vitest-dev/vitest#7733]: https://github.com/vitest-dev/vitest/issues/7733
[vitest-dev/vitest#5765]: https://github.com/vitest-dev/vitest/pull/5765
[vitest-dev/vitest#8343]: https://github.com/vitest-dev/vitest/issues/8343
[`@vitest/mocker` の `node/resolver.ts`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/mocker/src/node/resolver.ts
[Vitest docs「Mocking」の Mock a global variable]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/mocking.md#mock-a-global-variable
[Vitest docs「Mocking」の Mock `import.meta.env`]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/mocking.md#mock-importmetaenv
[vitest-browser-react の README]: https://github.com/vitest-community/vitest-browser-react/blob/v2.3.0/README.md
[Vitest docs「unstubEnvs」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/unstubenvs.md
[Vitest docs「unstubGlobals」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/unstubglobals.md
[Vitest docs「Mocking Globals」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/mocking/globals.md
[Vitest docs「vi.stubGlobal」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/vi.md#vistubglobal
[Vitest docs「Projects」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/projects.md#configuration
[Vitest docs「setupFiles」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/setupfiles.md
