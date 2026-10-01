# React を通さずに置いた DOM の後始末

ブラウザテストの本文で、React を通さずに `document` へ置いた要素を外す手順と、その形にしている理由を持つ。

## how-to

### 置いた DOM を外す

`render()` で描いたものは、次のテストの前に vitest-browser-react の `cleanup()` が外す ([vitest-browser-react の README][] の "performs cleanup of the component before the test begins")。テストの本文で `document.body` や `document.head` へ `append` した要素は、この後始末の対象にならず、どこからも外されない。置いたテストが自分で外す。理由は「`onTestFinished` で外す理由」にある。

| 場面                                                           | 書き方                                                                                                                                                                             | 例                                                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| テストの本文で置く                                             | 置いた直後に `onTestFinished(() => { el.remove(); })` を書く                                                                                                                       | `src/test/assert/resolve-color-token.test.tsx` の「scope の祖先にある .dark を見て値を切り替える」                                     |
| 同じものを複数のテストで置く                                   | 置いて後始末を登録する関数にする ([Vitest docs「Hooks」][] の onTestFinished にある、使い回す処理の例と同じ形)。並行のテストからも呼ぶなら、文脈の `onTestFinished` を引数で受ける | `src/test/assert/resolve-color-token.test.tsx` の `appendProbeScope`、`src/test/browser/animations.test.tsx` の `stretchExitAnimation` |
| 並行のテスト (`.concurrent` を付けた `describe` / `it`) で置く | テストの文脈から受け取った `onTestFinished` を使う (`async ({ onTestFinished }) => …`)。import した `onTestFinished` は並行のテストを区別できない                                  | `src/test/a11y/a11y.test.tsx` の「並行で走るテスト」                                                                                   |

- `src/test/browser/animations.ts` の `disableAnimations()` が `document.head` へ置く style は外さない。setup の `beforeEach` が毎テスト呼び、既定として立て直す (`docs/guides/testing/user-interactions.md`「animation を無効にして走らせる理由」)

## explanation

### `onTestFinished` で外す理由

外し忘れた要素は、後のテストへ残る。

| 実行                   | 残る先                             | 根拠                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定 (`isolate: true`) | 同じファイルの後のテスト           | [Vitest docs「Configuring Playwright」][] の "Vitest opens a _single_ page to run all tests that are defined in the same file. This means that isolation is restricted to a single test file, not to every individual test." |
| `--no-isolate`         | 同じページで続けて走る後のファイル | 外し忘れたファイルと、それを読むファイルを `--no-isolate --no-file-parallelism` で走らせると、後のファイルが要素を見つけた。`--no-file-parallelism` だけでは見つけなかった (vitest 5.0.1、2026-10-01 に実測)                 |

外し方は次の案から選んだ。

| 案                                                                      | 評価                                                                                                                                                                                                                                                                                         | 採否     |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 置いた直後に `onTestFinished` で登録する                                | 失敗でも timeout でも外れる ([Vitest docs「Hooks」][] の "This hook is always called after the test has finished running")。置く行と外す行が並ぶ                                                                                                                                             | **採用** |
| `try` / `finally` で検査を包む                                          | 失敗では外れるが、timeout では外れるのが遅れるか、外れない。Vitest がテストを打ち切っても本文は止まらず、待ちが決着した時点 (後のテストの途中) で `finally` が走る。決着しない待ちでは走らない (vitest 5.0.1、2026-10-01 に実測)                                                             | 却下     |
| `afterEach` で外す (fixture を使わない形)                               | 置いた要素をテストの外の変数で受け渡すことになる。並行のテストは同じ変数を書き換え合う                                                                                                                                                                                                       | 却下     |
| fixture (`test.extend` と `onCleanup`) で置いて外す                     | 公式の手段で、テストごとに作って外し、並行のテストでも文脈を渡さずに済む ([Vitest docs「Test Context」][] の Extend Test Context)。1 回きりの場面まで fixture にすると、置く中身ごとに fixture を定義することになる。1 回きりの場面を `onTestFinished` のまま残すと、書き方が 2 通りに割れる | 却下     |
| setup の `afterEach` で、テストの間に増えた `body` と `head` の子を外す | 書き忘れても外れるが、並行のテストでは隣のテストが置いた要素まで外す。setup が毎テスト置く既定 (`disableAnimations()` の style) を除く判定も自前で持つことになる                                                                                                                             | 却下     |
| 置いて外す共有の helper を `src/test/` に作る                           | 呼び出しは短くなるが、Vitest の hook の代わりに自前の名前を覚えることになる。並行のテストでは、文脈の `onTestFinished` を引数で渡す口も要る                                                                                                                                                  | 却下     |

並行のテストで import した `onTestFinished` を使わないのは、[Vitest docs「Hooks」][] が "If you are running tests concurrently, you should always use `onTestFinished` hook from the test context since Vitest doesn't track concurrent tests in global hooks" と求めるためである。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。

[vitest-browser-react の README]: https://github.com/vitest-community/vitest-browser-react/blob/v2.3.0/README.md
[Vitest docs「Hooks」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/hooks.md
[Vitest docs「Configuring Playwright」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/browser/playwright.md
[Vitest docs「Test Context」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/test-context.md
