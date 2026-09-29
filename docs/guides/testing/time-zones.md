# テストのタイムゾーン

テスト全体の基準のタイムゾーンと、タイムゾーンを変えてテストを走らせる方法を持つ。画面に日時を出すときの整形は `docs/guides/dates-and-time-zones.md` が持つ。

## how-to

### 基準のタイムゾーン

- テスト全体の TZ は `America/New_York` にする。root の `test.globalSetup` に登録した `vitest.global-setup.ts` が、メインプロセスの `TZ` に入れる。値は `scripts/lib/resolve-test-time-zone.ts` の `BASE_TIME_ZONE` が持つ
- 基準に依存するテストは、基準が `America/New_York` であることを前提にしてよい。効くことを確かめたのは unit・scripts・ブラウザの 3 つの project (「基準を root の globalSetup に置く理由」)
- ホストの `TZ` は使わない。`TZ=<IANA 名> vp test run` と渡しても基準で上書きされ、`vitest.global-setup.ts` が TZ ごとの実行のスクリプトを案内する警告を出す。ホストが自分の都合で `TZ` を持つ環境では警告が毎回出るので、`TZ` を空にして走らせる (`TZ= vp test run`)
- 基準の値を変えるときは、`APP_TIME_ZONE` とも UTC とも違う値にする (「基準を `America/New_York` にする理由」)。値を書いた箇所は `git grep -n America/New_York` で洗う。確認のテストの期待値は、実装から独立させるために書き写している

### Node で動くテストを TZ ごとに走らせる

- Node で動くテスト (unit project) のうち、`Date` のローカルの getter や TZ を指定しない date-fns を直接呼ぶモジュールと、ローカルの TZ に依存しないことを保証するモジュールのテストは、ファイルごと `src/**/*.tz.test.ts` にする。1 件ずつ TZ に依存するかで分けると、分け損ねたテストが基準の TZ でしか走らない
- 基準の TZ では `vp test run` (unit project) が、基準以外の TZ では `vp node scripts/time-zones/run-tests.ts` が走らせる。`.mise.toml` の verify タスクと CI は、この順に両方を呼ぶ
- スクリプトは TZ ごとに `TEST_TIME_ZONE` を渡したプロセスを並列に走らせる (「TZ ごとの実行を並列にする理由」)。落ちた TZ があれば、その TZ だけを走らせ直すコマンドを出して非ゼロで終える
- 1 つの TZ だけを走らせるときは、そのコマンド (`TEST_TIME_ZONE=<IANA 名> vp test run --project unit .tz.test.ts`) を打つ。`TEST_TIME_ZONE` はスクリプトとこのコマンドでだけ使う
- 止めるときは Ctrl-C を使う。親のプロセスだけを kill すると子が残る
- 走らせる TZ は `scripts/time-zones/run-tests.ts` の `TIME_ZONES` が持つ。UTC より進んだ側と遅れた側の両方を入れる
- テストの中で `vi.stubEnv("TZ", …)` や `process.env.TZ` への代入で切り替えない。threads と vmThreads の pool では `Date` に効かず、基準の TZ のまま無言で通る (「TZ ごとにプロセスを分ける理由」)
- `src/test/test-time-zone.tz.test.ts` は、`TEST_TIME_ZONE` (無ければ基準) が `Intl` の既定と `Date` のローカルの時刻に効いていることを確かめる。効かないまま走ると、どの TZ の実行も基準と同じ結果で通る

### ブラウザテストで切り替える

- `cdp().send("Emulation.setTimezoneOverride", { timezoneId: "<IANA 名>" })` で切り替える (`cdp` は `vite-plus/test/browser/context`)
- 戻すときは `timezoneId: ""` を送り、基準の `America/New_York` に戻る。[CDP「Emulation.setTimezoneOverride」][] の定義は "If empty, disables the override and restores default host system timezone."
- 戻す処理は `afterEach` に置く。戻さないと、同じファイルの次のテストに切り替えた TZ が残る
- `vi.stubEnv("TZ", …)` はブラウザの TZ を変えない
- `cdp()` は playwright provider の chromium でしか使えない ([Vitest docs「Context API」][] の `cdp`)

## explanation

### 基準のタイムゾーンを決める理由

テストでは、ローカル TZ に依存する実装 (`Date#getHours` 系で壁時計を組む整形など) を検出したい。ところが、ホストの TZ が `APP_TIME_ZONE` (`Asia/Tokyo`) と一致すると、壁時計の値を比べるテストはこの依存を見逃す。開発機が JST なら常に一致する。基準の TZ をホストから切り離して決めれば、壁時計の値を比べるテストだけで依存を検出できる。

2026-09-27 に vitest 4.1.11 と JST のホストで、`formatDateTime` を `Date#getHours` 系で組む実装に置き換えて、その日の `formatDateTime` のテスト 5 件 (基準の TZ で走る 4 件と、`vi.stubEnv("TZ")` で切り替える 1 件) を走らせた。

| 基準の固定                                          | pool    | 結果                                                      |
| --------------------------------------------------- | ------- | --------------------------------------------------------- |
| なし                                                | forks   | 1 failed \| 4 passed。TZ を切り替えるテストだけが検出する |
| なし                                                | threads | 5 passed。見逃す                                          |
| `America/New_York`                                  | forks   | 4 failed \| 1 passed                                      |
| `America/New_York`                                  | threads | 4 failed \| 1 passed                                      |
| `America/New_York`、ホストで `TZ=Asia/Tokyo` を指定 | threads | 4 failed \| 1 passed                                      |

### 基準を `America/New_York` にする理由

| 候補               | 採否 | 理由                                                                                                        |
| ------------------ | ---- | ----------------------------------------------------------------------------------------------------------- |
| `Asia/Tokyo`       | 却下 | `APP_TIME_ZONE` と一致し、ローカル TZ への依存を見逃す                                                      |
| `UTC`              | 却下 | オフセットが 0 なので、UTC への変換漏れを見逃す                                                             |
| `America/New_York` | 採用 | `APP_TIME_ZONE` とも UTC とも違う。UTC より遅れているので、日付が前日にずれる不具合も表に出る。夏時間がある |

### 基準を root の globalSetup に置く理由

Node.js は、メインスレッドで設定した `TZ` だけを反映する。worker thread からの変更は `process.env` には見えるが、`Date` には効かない ([Vitest docs「Common Errors」][] の Time Zone Does Not Change in Worker Threads)。基準は worker が起動する前に、メインプロセスで決める必要がある。

| 置き場所                                            | 効く範囲                                                                                        | 採否                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| root の `test.globalSetup`                          | worker の起動前にメインプロセスで走る。[Vitest docs「Common Errors」][] は "work in every pool" | 採用。実行前の準備のための hook で、用途が一致する                                                                                          |
| `vitest.config.ts` の先頭で `process.env.TZ` に代入 | 効く範囲は root の globalSetup と同じ                                                           | 却下。用途の合う hook があるので、config は設定の宣言に留め、読み込みに副作用を持たせない                                                   |
| package.json の script (`TZ=… vitest`)              | script を通した起動だけ                                                                         | 却下。`vp test run`、`.mise.toml` の verify タスク、CI は script を通らない。エディタの拡張も通らない ([vitest の issue 1575][] のコメント) |
| project の `test.globalSetup`                       | その project のテストを含む実行でだけ走る                                                       | 却下。走ると他の project の TZ も変わるので、ブラウザテストの TZ が選んだファイルで変わる                                                   |
| project の `test.env`                               | forks と vmForks でだけ効く                                                                     | 却下。pool への依存が残る。[Vitest docs「env」][] は "`TZ` set here does not change the time zone in `threads` and `vmThreads` pools"       |

2026-09-27 に vitest 4.1.11 で、各 project に `getHours()` を読むテストを置き、選ぶファイルを変えて測った。

| 置き場所                    | 実行したファイル       | unit   | scripts     | ブラウザ    |
| --------------------------- | ---------------------- | ------ | ----------- | ----------- |
| unit project の globalSetup | 3 project のファイル   | 基準   | 基準        | 基準        |
| unit project の globalSetup | scripts とブラウザだけ | 対象外 | ホストの TZ | ホストの TZ |
| root の globalSetup         | 3 project のファイル   | 基準   | 基準        | 基準        |
| root の globalSetup         | scripts とブラウザだけ | 対象外 | 基準        | 基準        |

### TZ ごとにプロセスを分ける理由

worker からの `TZ` の変更は `Date` に効かない (「基準を root の globalSetup に置く理由」)。[Vitest docs「Common Errors」][] は、テストの中で TZ を変えたいときの手段として "use `pool: 'forks'` or `pool: 'vmForks'`, where each worker is a separate process, or pass the `timeZone` option to `Intl.DateTimeFormat` instead of changing `TZ`" と書く。

| 手段                                                              | 公式か自前か                                                                                           | 採否                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| forks か vmForks の pool で、テストの中で `TZ` を変える           | 公式 (Common Errors が挙げる)                                                                          | 却下。threads と vmThreads では効かないまま通る。この形は threads でも通ることを目指す                         |
| TZ ごとの project に `test.env` の `TZ` と `pool: "forks"` を置く | 公式の設定の組み合わせ                                                                                 | 却下。CLI の `--pool threads` と `vitest doctor` の threads の候補が project の pool を上書きし、TZ が効かない |
| `Intl.DateTimeFormat` に `timeZone` を渡す                        | 公式 (Common Errors が挙げる)                                                                          | 実装の側で採る (`formatDateTime`)。ローカルの TZ に依存しないことを確かめるテストは残る                        |
| TZ ごとにプロセスを起動し、globalSetup が `TEST_TIME_ZONE` を読む | globalSetup で決めるのは公式 (Common Errors の "work in every pool")。プロセスを束ねるスクリプトは自前 | 採用。[date-fns の `tz.ts`][] も TZ ごとに `vitest run` を起動する                                             |

- CLI の `--pool` は project の `pool` を上書きする。[Vitest docs「Advanced API」][] の「Project Configuration Resolution」は、`--pool` を含む CLI の一部のオプションを "applied to every project at the highest priority" と書く
- 2026-09-29 に vitest 5.0.1 で、TZ ごとの project を `--pool threads` で走らせると、`src/test/test-time-zone.tz.test.ts` の 2 件が各 project で落ちた。TZ ごとの project を 1 つ足して `vitest doctor` を走らせると、`pool: 'threads'` の候補がその project の同じ 2 件で failed になり、推奨の後に "Doctor overrides options for all projects at once" と出た
- 2026-09-29 に `parseCalendarDate` を `new Date(value)` (UTC の 0 時になる) に置き換えて `*.tz.test.ts` (22 件) を走らせると、基準で 7 件、`Asia/Tokyo` で 4 件、`Pacific/Pago_Pago` で 7 件、`UTC` で 3 件が落ちた。3 件は暦に無い日付を throw しなくなるのでどの TZ でも落ち、残りは TZ によって見つかる
- `vitest.global-setup.ts` では `TEST_TIME_ZONE` の名前を検査しない。IANA の名前として効かない値 (`Asia/Tokio`、`asia/tokyo`、`JST-9`) を `TZ` に入れると `Intl` の既定の TZ が決まらず、`src/test/test-time-zone.tz.test.ts` が落ちる (2026-09-29、Node 24.21.0 で実測)

### TZ ごとの実行を並列にする理由

1 回の実行の大半は、テストではなく `vp` と Vitest の起動に使われる。TZ 5 つを 8 コアで走らせると、直列で 5.05 秒、並列で 2.03 秒だった (2026-09-29、vitest 5.0.1 / vp 1.0.0)。

- 既定の `maxWorkers` は利用できる並列数を全部使う ([Vitest docs「maxWorkers」][])。各プロセスに `VITEST_MAX_WORKERS=1` を渡して、プロセスの数と掛け算で worker が増えないようにする。[Vitest docs「Improving Performance」][] の shard の例と、[date-fns の `tz.ts`][] も同じ形
- 端末の Ctrl-C はプロセスグループ全体に届くので、子も止まる (vp 1.0.0、2026-09-29 に実測)。親のプロセスだけに signal を送ると子が残る

### テストの中の切り替えが効く範囲

「TZ ごとにプロセスを分ける理由」の比較の根拠にした実測である。2026-09-27 に vitest 4.1.11 で、基準を固定した状態から切り替えて `getHours()` と `Intl.DateTimeFormat().resolvedOptions().timeZone` を読んだ。

| 手段                                | 走る場所            | 効くか   | 戻したあと                                                                                            |
| ----------------------------------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `vi.stubEnv("TZ", …)`               | forks / vmForks     | 効く     | `vi.unstubAllEnvs()` で基準に戻る                                                                     |
| `vi.stubEnv("TZ", …)`               | threads / vmThreads | 効かない | —                                                                                                     |
| `vi.stubEnv("TZ", …)`               | ブラウザ (chromium) | 効かない | —                                                                                                     |
| CDP `Emulation.setTimezoneOverride` | ブラウザ (chromium) | 効く     | `timezoneId: ""` で基準に戻る。戻さないと同じファイルの次のテストに残る。別のファイルには残らなかった |

CDP の上書きがファイルをまたがないのは、Vitest がテストファイルごとにブラウザの context を作るためと見られる。[Vitest docs「Configuring Playwright」][] の `contextOptions` の節は "the context is created for every _test file_, not every _test_" と書く。

ブラウザの TZ を project 全体で変える手段には、playwright provider の `contextOptions.timezoneId` もある ([Vitest docs「Configuring Playwright」][] の `contextOptions` は [Playwright docs「browser.newContext」][] の引数を渡す。`timezoneId` はその 1 つ)。project ごとに 1 つの TZ に決まるので、テストごとの切り替えには使わない。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vitest は 5.0.1 に固定した版を指す。

[Vitest docs「Common Errors」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/common-errors.md
[Vitest docs「maxWorkers」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/maxworkers.md
[Vitest docs「Improving Performance」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/improving-performance.md
[Vitest docs「Advanced API」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/advanced/index.md#project-configuration-resolution
[Vitest docs「env」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/env.md
[Vitest docs「Context API」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/api/browser/context.md
[Vitest docs「Configuring Playwright」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/browser/playwright.md
[vitest の issue 1575]: https://github.com/vitest-dev/vitest/issues/1575
[CDP「Emulation.setTimezoneOverride」]: https://chromedevtools.github.io/devtools-protocol/tot/Emulation/#method-setTimezoneOverride
[date-fns の `tz.ts`]: https://github.com/date-fns/date-fns/blob/main/pkgs/dev/src/test/tz.ts
[Playwright docs「browser.newContext」]: https://playwright.dev/docs/api/class-browser#browser-new-context
