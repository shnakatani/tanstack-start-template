# ADR-0030: assert の予算をテストの予算と分けて宣言する

- Status: Accepted
- Date: 2026-09-22
- Revised: 2026-09-22 (`findElement()` に予算を渡す helper `src/test/find-element.ts` を撤去した。`src/` に呼び出しが無く、mount 待ちは `expect.element` で足りる。ルールは `browser-test/no-find-element` として呼び出しそのものを止める)
- 関連: ADR-0029 (assert には locator を渡す。その移行で肯定 assert が増え、予算の既定が問題として現れた)、ADR-0013 (待機を retry API に委ねる)、ADR-0004 (ルールの選定基準。自前ルールを `jsPlugins` で足す判断)

## Context

### 退行したときのテストが 15 秒かかる

ADR-0029 の移行で `expect.element` の肯定 assert が増え、「最初から出ないこと」の確認も `.not.toBeInTheDocument()` になった。この形は退行で赤になったとき、テストの残り予算を使い切る。移行前の `expect(x.query()).toBeNull()` は同期の 1 回読みで、赤は即座だった。テンプレートとして配るので、ブラウザテストが増えた先ほど効く。

### 設定値を読んでいるのは `expect.poll` だけ

`matchers.d.ts` の docstring と公式 docs は、`expect.element` の timeout が `expect.poll.timeout` を既定にすると書く。実装はそうなっていない。`expect.poll.timeout` を 200ms に設定して測った (2026-09-22)。

| assert                                                 | 所要                                   | 判定                                                |
| ------------------------------------------------------ | -------------------------------------- | --------------------------------------------------- |
| `expect.poll(() => false).toBe(true)`                  | 206ms                                  | 設定値が効いている                                  |
| `expect.element(存在する要素).not.toBeInTheDocument()` | 2938ms (`testTimeout` 3000 のテスト内) | 設定値を無視し、残り予算から 100ms を引いた値を使う |

既定の `testTimeout` (browser project は 15000) のまま同じ assert を測ると **14933ms** かかり、`{ timeout: 0 }` を渡すと **52ms** で落ちる。失敗の文言は変わらない。

この食い違いは上流でも報告されている。どちらの issue も OPEN である (2026-09-22 時点。#8308 は `closedByPullRequestsReferences` が空であることを同日に確認した)。

| issue                                                     | 表題                                     | この ADR が使う記述                                                                                                                         |
| --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [#8308](https://github.com/vitest-dev/vitest/issues/8308) | expect.poll.timeout not being respected  | 報告者以外にも再現報告があり、4.0.15 でも再現している                                                                                       |
| [#9751](https://github.com/vitest-dev/vitest/issues/9751) | Unify and simplify timeout configuration | 内部で `testTimeout - elapsedTime - 100ms` を計算していることを "Hidden dynamic adjustment" と呼び、"Users are unaware this happens" と書く |

#8308 のコメントは回避策として Playwright provider の `actionTimeout` を挙げる。この設定を入れると `expect.poll.timeout` が `expect.element` にも効く。

**予算の宣言は「最初から出ない」否定 assert の無駄待ちを解かない。** 待って成立しない条件にはどんな予算を渡しても使い切るためで、そちらは呼び出しごとに打ち切る形が要る (ADR-0031 の `expectAbsent`)。本 ADR が決めるのは、待つ意味のある assert の上限だけである。

## Decision

**assert の予算をテストの予算と分けて宣言する。** `vitest.browser.config.ts` に `expect.poll.timeout` と `browser.providerOptions.actionTimeout` を対で置き、値は 5000ms にする。その値はリポジトリ内の 1 か所が持ち、config と helper の両方がそこから読む。

| 規範                                                                                              | 守らないと何が壊れるか                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `expect.poll.timeout` と `actionTimeout` を対で置く                                               | `actionTimeout` を消すと残り予算を使い切る側へ戻り、`expect.poll.timeout` を消すと vitest の既定 1000ms になる               |
| 予算の値を持つのは 1 か所だけにする (現在は `src/test/assert-budget.ts` の `ASSERT_TIMEOUT_MS`)   | 数字を 2 か所に置くと、重い画面を持つ利用者が上げる場所が 2 つになる                                                         |
| `testTimeout` は動かさない                                                                        | 締めるべきは assert の予算であって、テストの予算ではない。短くすると待つべき assert の予算も一緒に縮み、遅い環境で緑が落ちる |
| `locator.findElement()` を呼ばない。mount は `expect.element(locator).toBeInTheDocument()` で待つ | `actionTimeout` があると `findElement()` の待ち時間が上限なしになる。`Test timed out` で落ち、locator 名が消える             |

## Consequences

### この設定を置いた状態が、公式ドキュメントどおりの挙動である

4 ページを突き合わせた (2026-09-22)。

| ページ                                      | 記述                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `expect.element` (browser の assertion API) | timeout は "Defaults to `expect.poll.timeout` config option" |
| `findElement` (browser の locators API)     | "By default, the timeout matches the test timeout"           |
| `actionTimeout` (playwright provider)       | Playwright の操作についてのみ。他 2 つへの影響に言及が無い   |
| `testTimeout`                               | 既定値のみ。browser で 15000                                 |

`actionTimeout` を置かない状態では `expect.element` が `expect.poll.timeout` を読まず、1 ページ目の記述と食い違う。それが #8308 である。置くと記述どおりになる。**回避策で挙動を曲げているのではなく、文書化された既定へ戻している。**

**この対はメンテナが提示した形そのものである。** #9157 で `actionTimeout` を 5000 にしても効かないという報告に対し、メンテナは「`actionTimeout` is not applied to assertions. They are controlled by `expect.poll.timeout`」と答え、`expect.poll.timeout: 5_000` と `playwright({ actionTimeout: 5_000 })` を両方足す diff を示している (2026-09-22 に `gh issue view 9157 --repo vitest-dev/vitest` で確認)。対も値も本 ADR の設定と一致する。

同じ回答は第 3 のノブ `browser.expect` にも触れているが、4.1.11 のこれは `toMatchScreenshot` しか持たず `poll` を持たない (`vitest/dist/chunks/reporters.d.*.d.ts` の `BrowserConfigOptions` を 2026-09-22 に確認)。予算の置き場はこの版では 1 つだけである。

どちらの設定も、上流が意図した用途で使っている。

| 設定                                    | 上流の位置づけ                                                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expect.poll.timeout`                   | `actionTimeout` を作った issue #6983 で、メンテナが `expect.element()` について「which can be already configured by `expect.poll.timeout`」と書いている。`expect.element` の予算を決める口はこれ                                  |
| `browser.providerOptions.actionTimeout` | 同 issue で「CI is quite often slower and locators take more than the default... it would be nice to be able to set larger timeouts at a config level」を動機に要望され、PR #6984 が足した。Playwright の同名オプションに対応する |

`actionTimeout` を置くと Playwright の操作にも上限が付く。これは副作用ではなく利得の側でもある。残り予算からの計算は、action の timeout がテストを跨いで持ち越されるのを止めるために入った (#7871 のメンテナ回答「The actions timeouts are now affected by the test timeout. Previously they would carry over to other tests if the test timed out.」)。その代わりテストの後半ほど予算が縮み、同 issue は `Timeout 581ms exceeded` のような説明のつかない失敗を報告している。固定値を置くとこの縮みが消える。

### 値は Playwright の既定を写す

Playwright は同じ分け方を公式に持ち、「Auto-retrying assertions like `expect(locator).toHaveText()` have a separate timeout, 5 seconds by default. Assertion timeout is unrelated to the test timeout.」と書いて assertion 側の既定を 5000ms と文書化している。`expect.poll.timeout` はその対応物なので、`ASSERT_TIMEOUT_MS` は 5000 にする。

このリポジトリのテストへ当てて決めた数字ではない。当てた結果は下表で、5000 は足りている側にある (2026-09-22、全 project 同時実行)。

| `expect.poll.timeout` | 結果                                          |
| --------------------- | --------------------------------------------- |
| 1000 (vitest の既定)  | 12 件が赤                                     |
| 2000                  | 6 件が赤                                      |
| 3000                  | 緑                                            |
| 5000 (採用)           | 緑。肯定 assert の赤は 14942ms から 5038ms へ |

`testTimeout` の browser 既定 15000 は vitest 公式が文書化した値で、テストの予算としては妥当である (単独実行の最遅テストは 605ms だが、全 project 同時実行では 3595ms まで伸びる)。ただしこの既定値は版で動く。メンテナは #9157 で、docs の数字が PR #8705 で意図せず変わった可能性に触れている。このリポジトリの 4.1.11 では 15000 で、肯定 assert の赤 14942ms と整合する (2026-09-22 実測)。版を上げたときは docs の数字を写さず測り直す。

### 代償は `findElement` に出る

`actionTimeout` があると vitest は呼び出し側の options をそのまま返し、`findElement` の待機ループには既定が無くなる。要素が現れないと回り続け、テスト全体が `Test timed out` で落ちて locator の名前が出力から消える (2026-09-22 実測。`actionTimeout` なしでは 7905ms で `Cannot find element with locator: page.getByText('ない')`)。この相互作用は docs のどのページにも書かれておらず、上流の issue にも無い (同日に検索)。

対処は呼ばないことである。mount を待つ用途は `expect.element(locator).toBeInTheDocument()` で足り、実測は `expect.poll` のコールバックで `element()` を読めば retry する (ADR-0029)。2026-09-22 時点で `src/` に `findElement()` の呼び出しは無い。

同日の導入時は `src/test/find-element.ts` に `{ timeout: ASSERT_TIMEOUT_MS }` を持たせる形を採り、文書化された既定 (テストの予算) を復元せず assert の予算を代わりに置いた。移行を終えると消費者がゼロになり、使い手のいない helper と自己テストを残す理由が無いので撤去した。

代償のもう 1 つは、mount に `ASSERT_TIMEOUT_MS` 以上かかる要素を `expect.element` で待てなくなることである。このリポジトリでは全 project 同時実行の最遅テストが 3595ms なので届いているが、より重い画面を持つ利用者は値を上げる。

### `findElement()` は lint で止める

`locator.findElement()` を書けば同じ穴に戻る。しかも失敗は「テストが `Test timed out` で落ちる」形なので、原因が locator だと読めない。規範と docstring だけでは気づけない種類の壊れ方なので、`browser-test/no-find-element` が止める。ルールの置き方は ADR-0029「機械強制は oxlint の JS plugin で書く」に従う。

導入時の違反は 0 件である。2026-09-22 の移行前は呼び出しが 16 箇所あり、`actionTimeout` を足した時点で全部が上限なしになっていた (2026-09-22)。退行の記録はそれで足りる。

```bash
git grep -n '\.findElement(' main -- src/
```

ルールは呼び出し元の場所を見ず、除外を置かない。正当な呼び出しは無い。

壊し方を 2 つ当てた (2026-09-22)。素の呼び出しを 1 つ持つファイルへ `vp lint` を当てると 1 件報告され、`lint.rules` で `off` にすると 0 件、ルールのメソッド名の判定を壊しても 0 件になる。

### 呼び出しごとの指定は残る

`expectAbsent` (ADR-0031) が渡す `{ timeout: 0 }` はこの設定と独立に効く (2026-09-22 実測で 53ms)。呼び出しごとの指定が先に読まれるためで、予算を宣言しても「待たない」は書ける。

### 再評価の条件

- #8308 が閉じて `expect.poll.timeout` が単独で `expect.element` へ効くようになったら、`actionTimeout` の指定が要るかを測り直す
- #9751 が timeout の設定を 1 か所へ集約し、`expect.element` の既定を宣言できるようになったら、`expectAbsent` が `{ timeout: 0 }` を持つ必要があるかを測り直す

## 検討した選択肢

| 案                                                          | 評価                                                                                                     | 採否     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| `actionTimeout` を設定して `expect.poll.timeout` を効かせる | assert の予算をテストの予算から分けられる。値は Playwright が文書化した assertion 側の既定 5000ms を写す | **採用** |
| 何もしない (vitest の既定のまま)                            | 赤になった assert 1 件が 14942ms かかる。テンプレートとして配るので、ブラウザテストが増えた先ほど効く    | 却下     |
| `testTimeout` を短くして赤のコストを抑える                  | 待つべき assert の予算も一緒に縮む。遅い環境で緑のテストが落ちる                                         | 却下     |
| `findElement` の既定を 15000 で復元する                     | 待機の予算が assert と 2 つに割れる。`findElement` がするのは肯定 assert と同じ種類の待機である          | 却下     |
| `findElement()` に予算を渡す helper を置く                  | 2026-09-22 に採用したが、移行後に呼び出しが 0 件になり撤去した。mount 待ちは `expect.element` で足りる   | 撤回     |

## 出典

- vitest browser の assertion API: <https://vitest.dev/guide/browser/assertion-api>
- vitest browser の locator: <https://vitest.dev/guide/browser/locators>
- 同梱の `@vitest/browser` 4.1.11 の `context.d.ts` (`findElement` の docstring) と `matchers.d.ts` (`expect.element` が受ける timeout の docstring)
- vitest-dev/vitest#8308 (OPEN。`expect.poll.timeout` が `expect.element` に効かない): <https://github.com/vitest-dev/vitest/issues/8308>
- vitest-dev/vitest#9751 (OPEN。timeout 設定の集約): <https://github.com/vitest-dev/vitest/issues/9751>
- vitest-dev/vitest#6983 / PR #6984 (`actionTimeout` の導入と、`expect.poll.timeout` が `expect.element` の口だというメンテナ回答): <https://github.com/vitest-dev/vitest/issues/6983>
- vitest-dev/vitest#7871 (action の timeout がテストの残り予算で縮む): <https://github.com/vitest-dev/vitest/issues/7871>
- vitest-dev/vitest#9157 (`testTimeout` の既定が docs と食い違う可能性): <https://github.com/vitest-dev/vitest/issues/9157>
- Playwright の Test timeouts (assertion timeout を test timeout と分ける): <https://playwright.dev/docs/test-timeouts>
