# テストのタイムゾーン

テスト全体の基準のタイムゾーンと、テストの中でタイムゾーンを切り替える方法を持つ。画面に日時を出すときの整形は `docs/guides/dates-and-time-zones.md` が持つ。

## how-to

### 基準のタイムゾーン

- テスト全体の TZ は `vitest.global-setup.ts` が `America/New_York` に決める。`vitest.config.ts` の root の `test.globalSetup` に登録してあり、メインプロセスの TZ を決める。確かめたのは unit・scripts・ブラウザの 3 つの project (「基準を root の globalSetup に置く理由」)
- 基準に依存するテストを書くときは、基準が `America/New_York` であることを前提にしてよい。ホストの TZ や `TZ` 環境変数には左右されない (`vitest.global-setup.ts` が上書きする)
- 基準の値を変えるときは、`APP_TIME_ZONE` とも UTC とも違う値にする (「基準を `America/New_York` にする理由」)

### Node で動くテストで切り替える

- `vi.stubEnv("TZ", "<IANA 名>")` で切り替え、同じ describe に `afterEach(() => vi.unstubAllEnvs())` を置く。実例は `src/lib/format-date-time.test.ts`
- 切り替えるテストは、pool が `forks` か `vmForks` の project に置く。unit project は `pool: "forks"` に固定してある。`threads` と `vmThreads` では切り替えが `Date` に効かず、基準の TZ のまま無言で通る (Vitest docs「Common Errors」の Time Zone Does Not Change in Worker Threads)
- `vp test run --pool threads` のように CLI で pool を渡すと、project の `pool` を上書きする。TZ を切り替えるテストを threads で走らせない

### ブラウザテストで切り替える

- `cdp().send("Emulation.setTimezoneOverride", { timezoneId: "<IANA 名>" })` で切り替える (`cdp` は `vite-plus/test/browser/context`)。戻すときは `timezoneId: ""` を送る。CDP の定義は "If empty, disables the override and restores default host system timezone." で、基準の `America/New_York` に戻る
- 戻す処理は `afterEach` に置く。戻さないと、同じファイルの次のテストに切り替えた TZ が残る
- `vi.stubEnv("TZ", …)` はブラウザの TZ を変えない
- `cdp()` は playwright provider の chromium でしか使えない (Vitest docs「Context API」の `cdp`)

## explanation

### 基準のタイムゾーンを決める理由

テストでは、ローカル TZ に依存する実装 (`Date#getHours` 系で壁時計を組む整形など) を検出したい。ところが、ホストの TZ が `APP_TIME_ZONE` (`Asia/Tokyo`) と一致すると、固定値を比べるテストはこの依存を見逃す。開発機が JST なら常に一致する。基準の TZ をホストから切り離して決めれば、固定値のテストだけで依存を検出できる。

2026-09-27 に vitest 4.1.11 と JST のホストで、`formatDateTime` を `Date#getHours` 系で組む実装に置き換えて `src/lib/format-date-time.test.ts` を走らせた。

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

### テストの中の切り替えが効く範囲

2026-09-27 に vitest 4.1.11 で、基準を固定した状態から切り替えて `getHours()` と `Intl.DateTimeFormat().resolvedOptions().timeZone` を読んだ。

| 手段                                | 走る場所            | 効くか   | 戻したあと                                                                                            |
| ----------------------------------- | ------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `vi.stubEnv("TZ", …)`               | forks / vmForks     | 効く     | `vi.unstubAllEnvs()` で基準に戻る                                                                     |
| `vi.stubEnv("TZ", …)`               | threads / vmThreads | 効かない | —                                                                                                     |
| `vi.stubEnv("TZ", …)`               | ブラウザ (chromium) | 効かない | —                                                                                                     |
| CDP `Emulation.setTimezoneOverride` | ブラウザ (chromium) | 効く     | `timezoneId: ""` で基準に戻る。戻さないと同じファイルの次のテストに残る。別のファイルには残らなかった |

CDP の上書きがファイルをまたがないのは、Vitest がテストファイルごとにブラウザの context を作るためと見られる。Vitest docs「playwright」の `contextOptions` の節は "the context is created for every _test file_, not every _test_" と書く。

ブラウザの TZ を project 全体で変える手段には、playwright provider の `contextOptions.timezoneId` もある (同じ節)。project ごとに 1 つの TZ に決まるので、テストごとの切り替えには使わない。
