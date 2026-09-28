# テストのモジュール差し替え

テストで `vi.mock` を使ってモジュールを差し替えるときの形の選び方と、`__mocks__` の置き方を持つ。

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

- 差し替えたモジュールは静的 import で受け、`vi.mocked(fn)` で戻り値を決める。`vi.mock` は巻き上げられ、すべての import より先に実行されるので、`await import` で後から読まなくても差し替え後のモジュールが届く (vitest docs「vi.mock」の本文)
- factory の中から factory の外の変数を参照しない。`vi.mock` は巻き上げられるので、`There was an error when mocking a module` で落ちる (vitest docs「vi.mock」の warning、2026-09-28 に 5.0.1 で実測)。外の値が要るなら `vi.hoisted` で定義する
- `__mocks__` の export は元と同じ名前を全部並べ、元に export を足したら mock にも足す。手書きの mock は元の変更に追随しない (Jest docs「Manual Mocks」)。足し忘れると import 側が `does not provide an export named` の SyntaxError で落ちる
- `__mocks__` は coverage の分母から外す (`vitest.config.ts` の `coverage.exclude`)。`coverage.include` が `src/**` を含み、`coverage.exclude` の既定は空なので、外さないと出荷されないファイルが分母に入る (vitest docs「coverage.exclude」)

## explanation

### `__mocks__` に寄せる理由

同じ factory を複数のテストに書くと、差し替え先のモジュールに export を足すたびに全部を同時に直すことになる。`__mocks__` に置けば直す場所は 1 つになる。

- factory も `__mocks__` も無い `vi.mock(path)` は、元のモジュールを読んで export を自動で mock する (vitest docs「vi.mock」、vitest-dev/vitest の issue 7733 のメンテナの回答)。元を読むので、元が引く依存も読まれる
- server function のファイルは Start の server runtime を引く。ブラウザで読むと `node:async_hooks` の読み込みで落ちる (2026-09-28、vitest 5.0.1 で `__mocks__` を外して実測)。factory か `__mocks__` で、元を読まずに差し替える必要がある
- browser mode でも、factory なしの `vi.mock` は `__mocks__` を使う (vitest-dev/vitest の PR 5765 が browser mode に module mocking を入れた)
- `__mocks__` が無視されるという未解決の報告がある (vitest-dev/vitest の issue 8343。alias でも相対 import でも起きるとされる)。このリポジトリの構成では、`@/` の alias で指す形で `__mocks__` が解決される (2026-09-28、vitest 5.0.1 で実測)。相対 import の形は測っていない

### `__mocks__` で元を展開して一部だけ差し替えない理由

Jest は、manual mock と実装の同期を保つ手段として、mock の中で `jest.requireActual` で元のモジュールを読み、一部だけ差し替えて export する形を挙げている (Jest docs「Manual Mocks」)。このリポジトリの構成では、この形が取れない。

| 書き方 (`__mocks__` の中)                 | 結果 (2026-09-28、vitest 5.0.1 の browser mode で実測)                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export * from "../<元>"`                 | import した export が `undefined` になり、呼ぶと `real is not a function` のように落ちる。元のパスも差し替え対象として解決され、mock 自身を読んだと推定している |
| `vi.importActual("../<元>")` (相対パス)   | `Cannot resolve "../<元>" imported from "/src/..."` で落ちる                                                                                                    |
| `vi.importActual("@/...")` (alias)        | 同じ `Cannot resolve` で落ちる                                                                                                                                  |
| `vi.importActual("/src/...")` (root 起点) | 解決される。ただし ESM では元の export を展開して並べられず、名前で 1 つずつ並べ直すことになり、直す場所が増える                                                |

- `importActual` に渡る importer は、テストファイルからは絶対パス、`__mocks__` からはブラウザ側の URL (`/src/...`) だった (2026-09-27 実測)
- `@vitest/mocker` の `node/resolver.ts` の `resolveId` は importer を加工せずに解決へ渡し、同じファイルの `resolveMockId` は root と join する。相対パスが落ちる原因はこの差と推定している
- 一部だけ変えるなら、partial mock を各テストの factory で書く。factory の `importOriginal` はテストファイルを起点に解決されるので、この問題に当たらない

## 出典

explanation と how-to が拠る一次情報。vitest は 5.0.1 の tag で固定する。

- vitest docs「vi.mock」: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/vi.md#vimock
- vitest docs「coverage.exclude」: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/coverage.md#coverageexclude
- vitest issue #7733: https://github.com/vitest-dev/vitest/issues/7733
- vitest issue #8343: https://github.com/vitest-dev/vitest/issues/8343
- vitest PR #5765: https://github.com/vitest-dev/vitest/pull/5765
- `@vitest/mocker` `node/resolver.ts`: https://github.com/vitest-dev/vitest/blob/v5.0.1/packages/mocker/src/node/resolver.ts
- Jest docs「Manual Mocks」: https://jestjs.io/docs/manual-mocks
