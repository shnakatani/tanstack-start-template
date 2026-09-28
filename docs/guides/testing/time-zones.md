# テストのタイムゾーン

テスト全体の基準のタイムゾーンと、タイムゾーンを変えてテストを走らせる方法を持つ。画面に日時を出すときの整形は `docs/guides/dates-and-time-zones.md` が持つ。

## how-to

### 基準のタイムゾーン

- テスト全体の TZ は `vitest.global-setup.ts` が `America/New_York` に決める。`vitest.config.ts` の root の `test.globalSetup` に登録してあり、メインプロセスの TZ を決める。確かめたのは unit・scripts・ブラウザの 3 つの project (「基準を root の globalSetup に置く理由」)
- 基準に依存するテストを書くときは、基準が `America/New_York` であることを前提にしてよい。ホストの TZ や `TZ` 環境変数には左右されない (`vitest.global-setup.ts` が上書きする)
- 環境変数 `TEST_TIME_ZONE` があれば、`vitest.global-setup.ts` は基準の代わりにその値を使う。TZ を変えて走らせるときだけに使う (次節)
- 基準の値を変えるときは、`APP_TIME_ZONE` とも UTC とも違う値にする (「基準を `America/New_York` にする理由」)

### Node で動くテストを TZ ごとに走らせる

- TZ を変えても結果が変わらないことを確かめるテストは `src/**/*.tz.test.ts` に置く。unit project が集めるので、`vp test run` は基準の TZ で走らせる
- 基準以外の TZ では `vp node scripts/time-zones/run-tests.ts` が走らせる。TZ ごとに `TEST_TIME_ZONE` を渡して `vp test run --project unit .tz.test.ts` を起動する。`.mise.toml` の verify タスクと CI が `vp test run` の後に呼ぶ
- 1 つの TZ だけで走らせるときは `TEST_TIME_ZONE=<IANA 名> vp test run --project unit .tz.test.ts` を打つ
- 走らせる TZ は `scripts/time-zones/run-tests.ts` の `TIME_ZONES` が持つ。UTC より進んだ側と遅れた側の両方を入れる
- テストの中で `vi.stubEnv("TZ", …)` や `process.env.TZ` への代入で切り替えない。threads と vmThreads の pool では `Date` に効かず、基準の TZ のまま無言で通る (「TZ ごとにプロセスを分ける理由」)
- `src/lib/test-time-zone.tz.test.ts` は、指定した TZ が `Date` と `Intl` に効いていることを確かめる。効かないまま走ると、どの TZ の実行も基準と同じ結果で通るため

### ブラウザテストで切り替える

- `cdp().send("Emulation.setTimezoneOverride", { timezoneId: "<IANA 名>" })` で切り替える (`cdp` は `vite-plus/test/browser/context`)。戻すときは `timezoneId: ""` を送る。CDP の定義は "If empty, disables the override and restores default host system timezone." で、基準の `America/New_York` に戻る
- 戻す処理は `afterEach` に置く。戻さないと、同じファイルの次のテストに切り替えた TZ が残る
- `vi.stubEnv("TZ", …)` はブラウザの TZ を変えない
- `cdp()` は playwright provider の chromium でしか使えない (Vitest docs「Context API」の `cdp`)

## explanation

### 基準のタイムゾーンを決める理由

テストでは、ローカル TZ に依存する実装 (`Date#getHours` 系で壁時計を組む整形など) を検出したい。ところが、ホストの TZ が `APP_TIME_ZONE` (`Asia/Tokyo`) と一致すると、壁時計の値を比べるテストはこの依存を見逃す。開発機が JST なら常に一致する。基準の TZ をホストから切り離して決めれば、壁時計の値を比べるテストだけで依存を検出できる。

2026-09-27 に vitest 4.1.11 と JST のホストで、`formatDateTime` を `Date#getHours` 系で組む実装に置き換えて `src/lib/format-date-time.test.ts` (5 件) を走らせた。

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

Node.js は、メインスレッドで設定した `TZ` だけを反映する。worker thread からの変更は `process.env` には見えるが、`Date` には効かない (Vitest docs「Common Errors」の Time Zone Does Not Change in Worker Threads)。基準は worker が起動する前に、メインプロセスで決める必要がある。

| 置き場所                                            | 効く範囲                                                                   | 採否                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| root の `test.globalSetup`                          | worker の起動前にメインプロセスで走る。Vitest docs は "work in every pool" | 採用。実行前の準備のための hook で、用途が一致する                                                                                      |
| `vitest.config.ts` の先頭で `process.env.TZ` に代入 | 効く範囲は root の globalSetup と同じ                                      | 却下。用途の合う hook があるので、config は設定の宣言に留め、読み込みに副作用を持たせない                                               |
| package.json の script (`TZ=… vitest`)              | script を通した起動だけ                                                    | 却下。`vp test run`、`.mise.toml` の verify タスク、CI は script を通らない。エディタの拡張も通らない (vitest の issue 1575 のコメント) |
| project の `test.globalSetup`                       | その project のテストを含む実行でだけ走る                                  | 却下。走ると他の project の TZ も変わるので、ブラウザテストの TZ が選んだファイルで変わる                                               |
| project の `test.env`                               | forks と vmForks でだけ効く                                                | 却下。pool への依存が残る。Vitest docs「env」は "`TZ` set here does not change the time zone in `threads` and `vmThreads` pools"        |

2026-09-27 に vitest 4.1.11 で、各 project に `getHours()` を読むテストを置き、選ぶファイルを変えて測った。

| 置き場所                    | 実行したファイル       | unit   | scripts     | ブラウザ    |
| --------------------------- | ---------------------- | ------ | ----------- | ----------- |
| unit project の globalSetup | 3 project のファイル   | 基準   | 基準        | 基準        |
| unit project の globalSetup | scripts とブラウザだけ | 対象外 | ホストの TZ | ホストの TZ |
| root の globalSetup         | 3 project のファイル   | 基準   | 基準        | 基準        |
| root の globalSetup         | scripts とブラウザだけ | 対象外 | 基準        | 基準        |

### TZ ごとにプロセスを分ける理由

Node.js は、メインスレッドで設定した `TZ` だけを `Date` に反映する。テストの中で `TZ` を変える手段は pool に依存し、threads と vmThreads では効かないまま通る。Vitest のメンテナは、テストの中で動的に変える方法は無く `TZ=` を付けて起動するよう答えている (vitest の issue 1575)。

| 手段                                                              | pool への依存         | 採否                                                                                           |
| ----------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| テストの中で `vi.stubEnv("TZ", …)`                                | forks と vmForks だけ | 却下。project に `pool: "forks"` を固定しても、CLI の `--pool threads` が上書きし、無言で通る  |
| TZ ごとの project に `test.env` の `TZ`                           | forks と vmForks だけ | 却下。同じ依存が残る。Vitest docs「env」は `threads` と `vmThreads` では TZ が変わらないと書く |
| TZ ごとにプロセスを起動し、globalSetup が `TEST_TIME_ZONE` を読む | なし                  | 採用。Vitest docs「Common Errors」が挙げる、worker の起動前にメインプロセスで決める方法の 1 つ |

TZ ごとにプロセスを起動する形は、日付ライブラリにも先行例がある。date-fns は `pkgs/core/scripts/test/tz.sh` で `env TZ=<IANA 名> node <テスト>` を並べ、react-day-picker は `test:tz` の script で `TZ=Australia/Adelaide jest` を起動する。

2026-09-28 に vitest 5.0.1 で、`parseCalendarDate` を `new Date(value)` (UTC の 0 時になる) に置き換え、`--pool threads` を付けて `*.tz.test.ts` を走らせた。

| `TEST_TIME_ZONE`    | 結果                 |
| ------------------- | -------------------- |
| なし (基準)         | 3 failed \| 5 passed |
| `UTC`               | 8 passed。見逃す     |
| `Asia/Tokyo`        | 1 failed \| 7 passed |
| `Pacific/Pago_Pago` | 3 failed \| 5 passed |

`vitest.global-setup.ts` を `TEST_TIME_ZONE` を読まない形に戻して `TEST_TIME_ZONE=Asia/Tokyo` で走らせると、`src/lib/test-time-zone.tz.test.ts` だけが落ちた (1 failed \| 7 passed)。

### テストの中の切り替えが効く範囲

「TZ ごとにプロセスを分ける理由」の比較の根拠にした実測である。2026-09-27 に vitest 4.1.11 で、基準を固定した状態から切り替えて `getHours()` と `Intl.DateTimeFormat().resolvedOptions().timeZone` を読んだ。

| 手段                                | 走る場所            | 効くか   | 戻したあと                                                                                            |
| ----------------------------------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `vi.stubEnv("TZ", …)`               | forks / vmForks     | 効く     | `vi.unstubAllEnvs()` で基準に戻る                                                                     |
| `vi.stubEnv("TZ", …)`               | threads / vmThreads | 効かない | —                                                                                                     |
| `vi.stubEnv("TZ", …)`               | ブラウザ (chromium) | 効かない | —                                                                                                     |
| CDP `Emulation.setTimezoneOverride` | ブラウザ (chromium) | 効く     | `timezoneId: ""` で基準に戻る。戻さないと同じファイルの次のテストに残る。別のファイルには残らなかった |

CDP の上書きがファイルをまたがないのは、Vitest がテストファイルごとにブラウザの context を作るためと見られる。Vitest docs「playwright」の `contextOptions` の節は "the context is created for every _test file_, not every _test_" と書く。

ブラウザの TZ を project 全体で変える手段には、playwright provider の `contextOptions.timezoneId` もある (同じ節)。project ごとに 1 つの TZ に決まるので、テストごとの切り替えには使わない。
