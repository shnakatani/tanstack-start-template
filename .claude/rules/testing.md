---
paths:
  - "src/**/*.test.*"
  - "src/**/*.test-d.*"
  - "scripts/**/*.test.*"
  - "src/test/**"
  - "**/*.test-helpers.*"
---

# テストルール

## 進め方

- TDD で進める。failing test を書き `vp test run <path>` で fail を確かめ、最小実装で pass させ、テストを変えずにリファクタする
- 新規テストの前に、同じ関数・スキーマをテストする既存ファイルを `grep -rn "<name>" src/ scripts/` で探す
- `describe` / `it` / `expect` / `vi` は `vite-plus/test` から import する。`vitest` を直接 import しない (`vite-plus/test` が re-export する)

## テストの種別と置き場所

壊れる原因が違うものを同じ project に混ぜない。混ざると、失敗したときに直す対象がアプリかスクリプトか設定か読み取れない。

| 種別                   | 壊れる原因                   | 置き場所                                            | 実行                                                                                            |
| ---------------------- | ---------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| アプリの単体テスト     | アプリのコード変更           | `src/**/*.test.ts`                                  | `vp test run --project unit`                                                                    |
| TZ ごとの単体テスト    | アプリのコード変更           | `src/**/*.tz.test.ts`                               | 基準の TZ は `vp test run --project unit`、基準以外は `vp node scripts/time-zones/run-tests.ts` |
| アプリのブラウザテスト | アプリのコード変更           | `src/**/*.test.tsx`                                 | `vp test run --project browser`                                                                 |
| アプリの型テスト       | アプリの型の変更             | `src/**/*.test-d.ts`                                | `vp check` (`vp test run` は集めない)                                                           |
| スクリプトの単体テスト | スクリプト自身の変更         | `scripts/**/*.test.ts` (`scripts/checks/**` を除く) | `vp test run --project scripts-tools`                                                           |
| 整合検査               | 設定・ドキュメントの更新漏れ | `scripts/checks/integrity/`                         | `vp test run --project checks-integrity`                                                        |
| 成果物の検査           | ビルド結果に現れる挙動の欠落 | `scripts/checks/runtime/`                           | `vp node scripts/checks/runtime/<name>.ts`                                                      |

- `expectTypeOf` だけのテストは `*.test-d.ts` に置き、実行するテストと同じファイルに書かない。`*.test.ts(x)` に書くと、型しか確かめないテストが `vp test run` で pass として数えられる (`docs/guides/testing/type-tests.md`「`*.test-d.ts` に分ける理由」)

スクリプトの純粋関数・定数・fixture の置き場所は消費者で決める。上から順に当て、最初に当たった行で止める。

| 対象                                                                | 置き場所                     | 理由                                                                       |
| ------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| 検査の判定、または実行口の外 (config / 別ディレクトリ) から使うもの | `scripts/lib/`               | 実行口を 1 つ動かしても付いて回らない (`response-headers.ts`)              |
| テストだけが使う fixture                                            | そのテストと同じディレクトリ | `scripts/lib/` に置くと共有物と見分けが付かない (`git-test-utils.ts`)      |
| 1 つの実行口だけが使い、実行口と拡張子が違う                        | `scripts/<ツール>/` 直下     | 拡張子で見分けが付く (`derive-dev-port.sh` と隣の `.ts`)                   |
| 1 つの実行口だけが使い、実行口と拡張子が同じ                        | `scripts/<ツール>/lib/`      | 直接実行するファイルと読まれるだけのファイルが見分けられない (`contrast/`) |

- 検査は `scripts/checks/` の下へ置く。外へ置くと `scripts-tools` へ合流し、落ちたときに直す対象が読めなくなる
- project を足したら `vitest.config.ts` の `projects` に追加する。include に一致しないテストは無言で 1 度も走らない
- `src/` 全体へ当てるソース検査は、先に lint (必要なら `jsPlugins`) で表せないかを見る。字面走査より対象の実体に近い (ADR-0023)
- ソース検査を作るなら `scripts/checks/source/` と `checks-source` project を対で作り、判定は `scripts/lib/` に置いて単体テストを別に持つ (`docs/guides/testing/check-scripts.md`「検査スクリプトを足す」)
- 落ちたときに判断が要らない検査は作らない。期待値の書き換えしか選択肢が無い検査は上流更新のたびに鳴り、判断を鈍らせる (`docs/guides/testing/check-scripts.md`「検査スクリプトを分けて置く理由」)
- ビルド成果物が要る検査は vitest の project にせず、`vp build` の後の独立した step にする。project は build との順序を持てない
- 成果物の検査の判定ロジックは `scripts/lib/` へ切り出して単体テストを持つ (実行側 `scripts/checks/runtime/security-headers.ts` / 判定 `scripts/lib/response-headers.ts`)
- 固定 port を使う検査は、起動前にその origin が応答しないことを確かめる。前回の残骸が答えると古い成果物の検査が緑になる
- テスト全体の TZ は root の globalSetup (`vitest.global-setup.ts`) で決め、`APP_TIME_ZONE` と違う値にする。一致すると、ローカル TZ に依存する実装を壁時計の値のテストが見逃す (`docs/guides/testing/time-zones.md`「基準のタイムゾーンを決める理由」)
- `Intl.DateTimeFormat` で整形した日時を固定の文字列と比べない。`format()` の出力は実装ごとに違ってよい。壁時計は数字の並びで比べ、画面の期待値は `formatDateTime` で作る。date-fns の `format` は Intl を使わないので、固定の文字列と比べてよい (`docs/guides/dates-and-time-zones.md`「整形した日時をテストで確かめる」)
- Node で動くテスト (unit project) のうち、`Date` のローカルの getter や TZ を指定しない date-fns を直接呼ぶモジュールと、ローカルの TZ に依存しないことを保証するモジュールのテストは、ファイルごと `src/**/*.tz.test.ts` にする。1 件ずつ分けると、分け損ねたテストが基準の TZ でしか走らない (`docs/guides/testing/time-zones.md`「Node で動くテストを TZ ごとに走らせる」)
- テストの中で `vi.stubEnv("TZ", …)` で TZ を切り替えず、TZ ごとの実行はスクリプト (`scripts/time-zones/run-tests.ts`) に任せる。threads / vmThreads の pool ではテストの中の切り替えが `Date` に効かず、無言で通る (`docs/guides/testing/time-zones.md`「TZ ごとにプロセスを分ける理由」)
- ブラウザテストの TZ の切り替えは CDP の `Emulation.setTimezoneOverride` で行い、`afterEach` で `timezoneId: ""` を送って戻す。`vi.stubEnv` はブラウザの TZ を変えない (`docs/guides/testing/time-zones.md`「ブラウザテストで切り替える」)

## a11y の検査は tag で分ける

- `axe` で「アクセシブルか」を問うテストに `{ tags: ["a11y"] }` を付ける。単独実行は `--tags-filter a11y`。`--tags-filter '!a11y'` で外しても、挙動テストに相乗りした assert は走る (vitest の Test Tags)
- tag が効くのは browser project だけ。story の a11y は `addon-a11y` が当てるので、`--tags-filter a11y` は story を走らせない (vitest の Test Tags)
- tag の定義は `vitest.browser.config.ts` の `test.tags`。定義に無い tag はエラーで落ちる (vitest の Test Tags の `strictTags`)
- 挙動テストの途中の状態を測る `expectNoA11yViolations` には `a11y` の tag を付けない。専用テストへ降ろすと操作の再現が重複する (`docs/guides/accessibility.md`「a11y の tag を付ける」)
- `expectNoA11yViolations` を呼ぶテストには `{ tags: ["axe"] }` を付ける。`mise run a11y:incomplete` がこの tag で絞り、付け忘れると helper が落ちる (`docs/guides/accessibility.md`「a11y の tag を付ける」)

## 境界値

- 境界値テストは期待値の数式をコメントで先に書く (例: `// 900 + 200 = 1100 → slice(-1000) で先頭 100 件破棄`)
- cap の境界値は `cap-1 / cap / cap+1` の 3 点で見る

## 状態のアサートは semantic matcher を先に探す

`toHaveAttribute` か `querySelector` を書く前に下表を見る。ユーザーから見た状態を先に見る (Testing Library の Guiding Principles)。

| 見たいもの                                    | 使うもの                                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 検証エラー (`aria-invalid` / `checkValidity`) | `toBeInvalid()`                                                                                                                                     |
| 選択状態 (`aria-checked` / native checked)    | `toBeChecked()`                                                                                                                                     |
| native `disabled`                             | `toBeDisabled()` / `toBeEnabled()`                                                                                                                  |
| `aria-disabled` と Base UI の `Checkbox`      | `toHaveAttribute("aria-disabled", "true")`。Checkbox の native `disabled` は a11y tree に出ない隠し input が持つ (Base UI 1.8.0 で実測、2026-09-20) |
| `aria-describedby` が指す文言                 | `toHaveAccessibleDescription()`                                                                                                                     |
| accessible name                               | `toHaveAccessibleName()`                                                                                                                            |

- `aria-busy` に相当する matcher は無い。`getByRole(..., { busy: true })` で絞るか属性で見る
- Base UI の styling hook (`data-checked` 等) は見た目を駆動する属性なので属性で見てよい。ARIA 側と重ねるときは別々に付くことをコメントに残す
- `querySelector` で掴むのは accessibility tree に差が出ない対象に限り、理由を実装近傍に書く。書けないならそのアサートは消す
- 置き換えたら mutant で検出力を測る。semantic matcher の方が弱くなることがある (`ActionButtonShell` の `toHaveAccessibleName`)

## assertion helper と型ナローイング

- assertion を実行するヘルパーは `expect*` で命名する。`vitest/expect-expect` が assertion と認めるのは `expect*` と名指しした関数だけ (ADR-0007)
- assert を含むヘルパー (操作のあとに待つものを含む) は `vi.defineHelper` で包む。包まないと失敗の位置が helper の中を指し、どのテストのどの行から落ちたかが読めない。包んだ helper を包まない helper から呼んでも同じになる (vitest docs の api/vi「vi.defineHelper」)
- 値を得るために呼ぶヘルパー内の `expect.assert` は改名しない代わりに、そのヘルパーだけで終わるテストを書かない
- ヘルパーが受け取る引数の前提検査は `throw` のままにする。テストが測る値ではなくヘルパーの誤用を止めるガード
- テストの中で残す注意 (合否に入れないが読ませたいもの) は、テストの文脈の `annotate(message, "warning")` で残し、`console.warn` に出さない。`console.warn` は PR の画面に出ない (`docs/guides/testing/annotations.md`「`console.warn` ではなく注釈で残す理由」)
- 注釈を残す helper はテストの文脈を引数で受ける。`TestRunner.getCurrentTest()` は並行するテストで別のテストを指す (`docs/guides/testing/annotations.md`「helper にテストの文脈を渡す理由」)
- 手元の default reporter は通ったテストの注釈を出さない。a11y の注釈は `mise run a11y:incomplete` で読み、ほかは `--reporter=verbose` を付けて走らせる (`docs/guides/testing/annotations.md`「注釈を読む」)
- Storybook の画面でも動く story の helper は、テストの文脈が無いので `console.warn` だけで残す (vitest docs の guide/test-context の annotate)
- テスト内の型ナローイングは `expect.assert` を使う。`toBeTruthy()` / `toBeDefined()` は型を絞らない (vitest docs の recipes「Type Narrowing in Tests」)
- announcer の通知は `expectAnnouncements` / `readAnnouncements` で呼び出しの履歴を読み、配列を丸ごと比べる。live region のノードは寿命で消え、region を読むと後から出た同じ文言の通知と取り違える (`docs/guides/testing/waiting-and-assertions.md`「状態と通知を検証する」)
- 通知が出なかったことは後に出る通知までの並びで示し、後の通知が無いか出る時点を確かめるときだけ、肯定 assert を待ってから 1 回読む。肯定 assert を待たない 1 回読みは、まだ出ていないだけの状態で通る (`docs/guides/testing/waiting-and-assertions.md`「状態と通知を検証する」)

## mock の注意点

- `mock.calls` を受けるヘルパーの引数は `unknown[][]` で型注釈する
- `vi.stubEnv` を使ったら `afterEach(() => vi.unstubAllEnvs())`
- 同じモジュールを複数のテストで丸ごと差し替えるなら、隣の `__mocks__/<同名>` に置き、factory なしの `vi.mock(import(...))` で読む。無いと元を読んで automock し、ブラウザで読めないものは落ちる (`docs/guides/testing/mocking.md`「`__mocks__` に寄せる理由」)
- 実時間の待ち (debounce の `wait`) に依存するテストは、定数を `vi.mock(import(...))` の partial mock で広げる。literal 型に固めない。browser mode では locator の操作が fake timer を進めない (vitest-dev/vitest#10058)
- 引数ごとに応答を変える mock は `vi.when(vi.mocked(fn), { onUnmatched: "throw" })` で書き、`mockImplementation` に引数の分岐を手書きしない。想定外の引数で呼ばれたことを見逃さない (`docs/guides/testing/mocking.md`「戻り値を決める」)
- `vi.when` で登録した引数が全部呼ばれたことを、戻り値の `toHaveBeenExhausted()` で閉じる。`onUnmatched: "throw"` は、登録した呼び出しが来なかったことを捕まえない (`docs/guides/testing/mocking.md`「戻り値を決める」)

## optimistic update は決着を握って観測する

- optimistic state は `src/test/app/defer-mock.ts` の `deferMock` で決着を握って観測する。`mockRejectedValue` は即 reject して中間状態が見えない
- assertion の順序は、optimistic state の確認 → `reject()` → ロールバックの確認

## テスト環境制約に遭遇したら

1. 代替手段を検討する
2. 実行環境で条件分岐できるなら `skipIf` を使う
3. 恒久的に無効化するなら、`it.skip` の直前に理由付きの `oxlint-disable-next-line vitest/no-disabled-tests` を置く (`it.todo` は `vitest/warn-todo`)
4. 完全に削除するなら、コミットメッセージに未テスト範囲を書く

## クリックの発火方法

手段は場面で決める。1 が弾かれたら Playwright のエラー文言が示す条件を読み、対応する行へ移る。通るまで手段を替えると実物で起きない事象を固定する (`docs/guides/testing/user-interactions.md`「クリックを発火する」)。

| 順  | 場面                                                  | 使うもの                                                                          |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | 既定                                                  | `.click()`                                                                        |
| 2   | Playwright に弾かれ、キーボードで同じ活性化が起こせる | `userEvent.tab()` で対象へフォーカスを移し `userEvent.keyboard("{Enter}")`        |
| 3   | Playwright に弾かれ、pointer 経由の click が要る      | `.click({ force: true })`。対象に `pointer-events: none` が無いことを先に確かめる |
| -   | 無効化された要素が反応しないことの検証                | `pointer-events` と状態属性で見る。ライブラリ内部のガードまで見に行かない         |
| -   | 決着前の二重発火の検証                                | 1 → 2 の実イベントを 2 回。同一要素への同期 2 連射は実イベントで起きない          |

- `force: true` はブラウザのヒットテストを越えない。`pointer-events: none` の対象ではイベントが下の要素へ落ち、ハンドラは呼ばれない (`docs/guides/testing/user-interactions.md`「クリックを発火する」)
- 合成イベント (`element.dispatchEvent(new MouseEvent(...))`) は使わない。実物では起きない経路を固定する (`docs/guides/testing/user-interactions.md`「クリックを発火する」)
- `sr-only` のテキストは 1px + clip で viewport 判定に落ちる。`getByRole(..., { name })` で本体を掴む (`docs/guides/testing/user-interactions.md`「クリックを発火する」)
- `userEvent.wheel` をスクロールの手段にしない。要素を表示させるのは locator の操作の自動スクロールに任せ、位置が要るなら `scrollTop` か `scrollIntoView()` で作る (`docs/guides/testing/user-interactions.md`「スクロールさせる」)

## locator の扱い

同期読みを `expect()` へ渡す形、`findElement()`、素の不在 assert、リテラルとの否定スタイル比較は lint (`browser-test/*`) が止める。

- matcher の無い実測 (rect / computed style / `matches()`) は `expect.poll` の中で読む。基準値を 1 回だけ読むときは先に `expect.element` で mount を待つ (`docs/guides/testing/waiting-and-assertions.md`「同期読みを書き換える」)
- 待つ口は 3 つ。locator の状態は `expect.element`、値や mock を比べるなら `expect.poll`、処理そのものが throw しなくなるのを待って戻り値を受け取るなら `vi.waitFor` (`docs/guides/testing/waiting-and-assertions.md`「待つ口を選ぶ」)
- assert は `vi.waitFor` で待たず `expect.poll` で待つ。`vi.waitFor` は assert の予算を読まず 1000ms で打ち切る (`docs/guides/testing/waiting-and-assertions.md`「待つ口を選ぶ」)
- 件数は `expect.element(locator).toHaveLength(n)`、フォーカスは `expect.element(locator).toHaveFocus()` で見る (`docs/guides/testing/waiting-and-assertions.md`「同期読みを書き換える」)
- assert の予算は `src/test/browser/assert-budget.ts` の `ASSERT_TIMEOUT_MS` で変える。config へ直接書くと helper 側が追随しない (`docs/guides/testing/waiting-and-assertions.md`「assert の予算を宣言する」)
- `testTimeout` は動かさない。締めるのは assert の予算で、テストの予算を縮めると遅い環境で緑のテストが落ちる (`docs/guides/testing/waiting-and-assertions.md`「assert の予算を宣言する」)
- 「最初から出ないこと」は `expectAbsent(locator)` の前に、同じ操作の効果を表す肯定 assert を置く。単独では何も検証しない (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- `expectAbsent` に文字列で引く locator を渡すなら `exact: false` を付ける。既定の完全一致では、その文字列を含む長い文が出ていても不在として通る (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- 在る要素が消えるのを待つのは `expectRemoved(locator)` (`src/test/assert/absent.ts`)。`expectAbsent` と取り違えない (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- `toHaveLength` も一致ゼロで通るので、描画を待つ肯定 assert を先に置く (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- `toHaveTextContent` は受け取った側の NBSP を空白に置き換え、期待値側は置き換えない。NBSP を確かめるなら `element().textContent` を読む (`docs/guides/testing/waiting-and-assertions.md`「待つ口を選ぶ」)
- locator は複数一致で throw する。「1 件だけ」を assert の前提に使うなら、依拠を実装近傍に書く。書かないと前提ごと消される

## ブラウザテストの CSS とレイアウト実測

ブラウザテストでは Tailwind が実 CSS に解決される。レイアウト回帰は className の `toContain` ではなく、実測で守る。

- viewport 定数と `expectWithinViewport` は `src/test/assert/viewport.ts`。`page.viewport()` で変えたら `afterEach` で `DEFAULT_VIEWPORT` へ戻す (`docs/guides/testing/waiting-and-assertions.md`「viewport に収まることを測る」)
- 全体が viewport に収まることは `expectWithinViewport(locator)` で見る。`toBeInViewport({ ratio: 1 })` は使わない。sub-pixel の誤差で、収まっていても落ちる実行がある (w3c/IntersectionObserver#477)
- 既定 viewport は `vitest.browser.config.ts` の `browser.viewport` と `DEFAULT_VIEWPORT` を一致させる
- スタイルの比較は `toHaveStyle("prop: value")` の文字列形式で、複数プロパティは `;` で 1 つにまとめる。オブジェクト形式は差分が出ない (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- 1 つの文字列に同じプロパティを 2 度書かない。shorthand で longhand を覆わない。後勝ちで先の宣言が黙って消える (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- スタイルは肯定で確かめる。「描かれている」は数値を出して `toBeGreaterThan(0)`、token が分かれば `resolveColorToken()` と比べる (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- `getComputedStyle` を `expect.poll` で読むのは、2 回の観測の比較・数値の大小・擬似要素・期待値側の要素にも当たる `!important` (`*` など) の 4 つだけ (`docs/guides/testing/waiting-and-assertions.md`「否定を肯定で書く」)
- 操作前から在る要素は `element()` で読んでよい。`render()` が `act` で flush する (`docs/guides/testing/waiting-and-assertions.md`「待つ口を選ぶ」)
- animation は `browser-setup.tsx` が毎テスト止める。窓を検証するテストだけ冒頭で `enableAnimations()` を呼ぶ (`docs/guides/testing/user-interactions.md`「animation を戻すテストを書く」)
- animation を戻したテストでは、変化する側の値を先に待ってから「変化しないこと」を見る (`docs/guides/testing/user-interactions.md`「animation を戻すテストを書く」)
- popup を閉じた後に `expectNoA11yViolations()` を呼ぶときは、先に popup の要素を `expectRemoved()` で待つ (`docs/guides/testing/user-interactions.md`「animation を戻すテストを書く」)
- 溢れるコンテンツを flex column の中に作るときは `minHeight` を使う。flex item は縮むので `height` では溢れない
- マウス位置を動かすテストは、overlay が閉じる前に `parkMouse()` で戻す。露出した要素の hover 配色と transition を axe が測り、色の実測が揺れる
- モジュール最上位で描画や算出値を読まない。`beforeEach` より前に走り、既定が立つ前の状態を読む (`docs/guides/testing/user-interactions.md`「animation を戻すテストを書く」)

## ブラウザ操作ツールの使い分け

見た目の確認は claude-in-chrome、`mousedown` / `mousemove` / `mouseup` の間隔に依存する操作 (長押し、ドラッグ開始) は playwright-cli で検証する。claude-in-chrome は操作の間隔を制御できない。
