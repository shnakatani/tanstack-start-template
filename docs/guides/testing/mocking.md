# テストのモジュール差し替え

テストで `vi.mock` を使ってモジュールを差し替えるときの形の選び方と、`__mocks__` の置き方を持つ。

| 決定                                                                                         | ADR      |
| -------------------------------------------------------------------------------------------- | -------- |
| ドメインに属するコードは `src/features/<domain>/` へ集め、環境はファイル名の接尾辞で宣言する | ADR-0010 |
| server function をデータ境界とし、全 fn 共通の middleware は global に載せる                 | ADR-0012 |

## how-to

### 差し替えの形を選ぶ

| 場面                                                                  | 形                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 同じモジュールを複数のテストで丸ごと差し替える (server function など) | 隣の `__mocks__/<同名>` に `vi.fn()` を並べ、各テストは factory なしの `vi.mock(import(...))` で読む。実例は `src/features/notes/__mocks__/functions.ts`                                                                                  |
| 1 つのテストだけで丸ごと差し替える                                    | `vi.mock(import(...), () => ({ ... }))` の factory。戻り値は `vi.fn(() => Promise.resolve(x))` で持たせる。`vi.fn().mockResolvedValue(x)` は巻き上げで browser mode でだけ落ちる                                                          |
| 元のモジュールを残して一部の export だけを変える (partial mock)       | factory で `importOriginal()` を展開し、変える export だけ上書きする。`__mocks__` では書けない (「`__mocks__` の中で元のモジュールを読めない理由」)。実例は `docs/guides/testing/user-interactions.md`「debounce のある入力をテストする」 |

- 差し替えたモジュールは静的 import で受け、`vi.mocked(fn)` で戻り値を決める。`vi.mock` はファイルの先頭へ巻き上げられるので、`await import` で後から読まなくても差し替え後のモジュールが届く (vitest docs「vi.mock」の warning)
- `__mocks__` の export は元のモジュールと同じ名前を全部並べる。足し忘れると、その名前を import するファイルが `does not provide an export named` の SyntaxError で読み込みに失敗する
- `__mocks__` は coverage の分母から外す (`vitest.config.ts` の `coverage.exclude`)。vitest 4 は既定の除外が空で、外さないと出荷されないファイルが分母に入る (vitest docs「Migration Guide」の `coverage.all` の節)

## explanation

### `__mocks__` に寄せる理由

同じ factory を複数のテストに書くと、差し替え先のモジュールに export を足すたびに全部を同時に直すことになる。`__mocks__` に置けば直す場所は 1 つになる。

- factory も `__mocks__` も無い `vi.mock(path)` は、元のモジュールを読んで export を自動で mock する (vitest docs「vi.mock」、vitest-dev/vitest の issue 7733 のメンテナの回答)。元を読むので、元が引く依存も読まれる
- server function のファイルは Start の server runtime を引く。ブラウザで読むと `node:async_hooks` の読み込みで落ちる (2026-09-27、vitest 4.1.11 で `__mocks__` を外して実測)。factory か `__mocks__` で、元を読まずに差し替える必要がある
- browser mode でも、factory なしの `vi.mock` は `__mocks__` を使う (vitest-dev/vitest の PR 5765 が browser mode に module mocking を入れた)
- `@/` の alias で指しても `__mocks__` は解決される (2026-09-27、vitest 4.1.11 で実測)。alias で `__mocks__` が無視されるという報告 (vitest-dev/vitest の issue 8343) は、この構成では再現しない

### `__mocks__` の中で元のモジュールを読めない理由

Jest は manual mock の中で `jest.requireActual` を使って元のモジュールを読み、一部だけ差し替えて export する形を勧めている (Jest docs「Manual Mocks」)。このリポジトリの構成では、この形を取れない。

| 書き方 (`__mocks__` の中)                 | 結果 (2026-09-27、vitest 4.1.11 の browser mode で実測)                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `export * from "../<元>"`                 | 元のパスも差し替え対象として解決され、mock 自身を読む。元の export は届かない       |
| `vi.importActual("../<元>")` (相対パス)   | `Cannot resolve "../<元>" imported from "/src/..."` で落ちる                        |
| `vi.importActual("@/...")` (alias)        | 同じ `Cannot resolve` で落ちる                                                      |
| `vi.importActual("/src/...")` (root 起点) | 解決される。ただし元の export を名前で 1 つずつ並べ直すことになり、直す場所が増える |

- `importActual` は importer をブラウザ側の URL (`/src/...`) のまま解決へ渡しているように見える (`@vitest/mocker` の `node/resolver.ts`)。原因は確かめていない
- 一部だけ変えるなら、partial mock を各テストの factory で書く。factory の `importOriginal` はテストファイルを起点に解決されるので、この問題に当たらない
