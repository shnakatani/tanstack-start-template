# ADR-0032: テストの import を重くする依存のバレルは使わず、個別エントリポイントから引き、lint で止める

- Status: Accepted
- Date: 2026-09-27
- 関連: ADR-0008 (同じ `no-restricted-imports` の override を持つ)、ADR-0031 (暦の日付と Calendar の扱い)

## Context

依存が関数やロケールをまとめて再 export する入口 (バレル) から 1 つを import すると、使わない周辺のモジュールまで読み込まれる。テストはファイルごとに import をやり直すので、その時間がテストの実行時間に積み上がる。Vitest docs「Profiling Test Performance」は、テストの import が遅いときの手段として "Use Specific Entry Points"、"Use `resolve.alias` to Redirect Imports"、"Use the Dependency Optimizer" の 3 つを挙げ、最初の例に `date-fns` → `date-fns/format` を使う。

テンプレートの依存で最初に当たるのは date-fns である。2026-09-27 に date-fns 4.4.0 で数えると、`index.js` は 245 行、`locale.js` は 95 行の `export * from` を持つ。テンプレートで probe を 1 つずつ実行し、`--experimental.importDurations.print` で import の時間を測った (「調査結果」)。unit project と browser project の両方で、バレルと個別エントリポイントの差が回ごとのばらつきを超えた。

依存の中の import は、アプリのコードの書き方では変わらない。react-day-picker 10.0.1 は内部で date-fns のルートを import し (`dist/esm/classes/DateLib.js` の 2 行目)、`react-day-picker/locale/ja` は `date-fns/locale` のバレルを import する (`dist/esm/locale/ja.js` の 1 行目)。

## Decision

- 依存を import するときは、個別エントリポイントがあればそちらから引き、バレルを使わない
- 実測でバレルがテストの import を重くする依存を、`tooling/lint/config.ts` の `RESTRICTED_BARREL_IMPORTS` に名指しで足し、`no-restricted-imports` の `paths` で止める。メッセージで個別エントリポイントを案内する。足す手順は `docs/guides/dependencies-and-toolchain.md`「依存をバレルの禁止の対象に足す」にある
- 最初の対象は date-fns の `date-fns` と `date-fns/locale` である
- `RESTRICTED_BARREL_IMPORTS` はトップレベルの `rules` と、テスト専用コードの import 禁止の override (ADR-0008) の両方へ渡す。override は同じルールのオプションを置き換える (「調査結果」)
- 依存の中の経路 (react-day-picker が date-fns のルートを読む経路) は、手段を入れず、残った課題にする
- Calendar の locale は `date-fns/locale/ja` から組む (`src/components/parts/form-fields.tsx` の `CALENDAR_LOCALE`)。`react-day-picker/locale/ja` は使わない
- 型だけの import も止まる (`allowTypeImports` の既定は `false`)。型が要るときは、依存先の型 (react-day-picker の `DayPickerLocale`) か関数の引数の型から取る

### 検討した選択肢

| 案                                                                                                           | 効く範囲                                                             | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 採否     |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 個別エントリポイントから引き、名指しした依存のバレルを lint で止める (Vitest の "Use Specific Entry Points") | アプリのコードの import (unit と browser の両方のテスト、dev server) | import の書き方そのものが変わるので、実行環境ごとの設定が要らない。書き誤りは `vp lint` が記述時に止める。依存の中の import には届かない                                                                                                                                                                                                                                                                                                                                                                          | **採用** |
| 個別エントリポイントから引く規範だけを置き、lint で止めない                                                  | 同上                                                                 | バレルの import は動くので、誤ってもテストが遅くなるだけで何も壊れず、レビューでしか見つからない                                                                                                                                                                                                                                                                                                                                                                                                                  | 却下     |
| `resolve.alias` でバレルを別のファイルへ向ける (Vitest の "Use `resolve.alias` to Redirect Imports")         | 設定した project のテストだけ                                        | Calendar を描くテストで、import の中央値は手段なしの 63ms に対して 67ms で、手段の方が 4ms 遅く、差がばらつきを超えなかった (「調査結果」の (b))。アプリのコードの import の主手段にはしない。project に書いた alias はその project のテストにしか効かず、依存ごとに向け先を探して書く                                                                                                                                                                                                                            | 却下     |
| Dependency Optimizer でバレルを事前に束ねる (Vitest の "Use the Dependency Optimizer")                       | 設定した project のテストだけ                                        | Vitest docs の config「deps.optimizer」は `optimizer.client` を "`jsdom` and `happy-dom` environments" に使うと書き、browser mode には触れない。同じ節は "for web Vitest will extend `optimizeDeps`" と書く。browser project で `deps.optimizer.client` と Vite の `optimizeDeps.include` の両方を測り、どちらも差がばらつきを超えなかった (「調査結果」の (b))。`deps.optimizer.client` を入れると毎回 "Re-optimizing dependencies because vite config has changed" が出た。アプリのコードの import は変わらない | 却下     |
| 何もしない                                                                                                   | —                                                                    | unit project で、バレルの import の時間 (`Duration` の `import`) の中央値は個別エントリポイントより 905ms 長かった (「調査結果」の (a))                                                                                                                                                                                                                                                                                                                                                                           | 却下     |

## Consequences

- 依存を足すか使い始めたときに、バレルしか使っていなければ測って判断する手間が増える。測り方はガイドにある
- `paths` は specifier の完全一致なので、`react-day-picker/locale` と `react-day-picker/locale/*` は止まらない。どちらも `date-fns/locale` のバレルを読む。Calendar に locale を渡すときは `date-fns/locale/<locale>` から組む
- `RESTRICTED_BARREL_IMPORTS` をトップレベルか override の片方からだけ外すと、外した側の範囲で無言で効かなくなる。`scripts/checks/integrity/lint-config.test.ts` はルールのオプションの中身を見ないので、この外し方を捕まえない (「調査結果」の壊し方 2)
- 残った課題:
  - react-day-picker が date-fns のルートを読む経路が残っている。Calendar を描くテストの import は 63ms (中央値) で、経路の分は内訳が出ず測れていない。`resolve.alias`、`deps.optimizer.client`、`optimizeDeps.include` はどれも差がばらつきを超えなかった (「調査結果」の (b))
  - 同じ測り方で測る候補: lucide-react など、テンプレートのコードがルートから import している依存。測って重ければ `RESTRICTED_BARREL_IMPORTS` に足す
- 再評価の条件: react-day-picker が date-fns を個別エントリポイントから引くようになったら、依存の中の経路の扱いを見直す。`react-day-picker/locale/ja` が `date-fns/locale` を読まなくなったら、`CALENDAR_LOCALE` をそれに置き換える

## 調査結果

### (a) date-fns のバレルと個別エントリポイント (2026-09-27、vitest 4.1.11、Node 24.21.0、date-fns 4.4.0、react-day-picker 10.0.1)

probe は `format` と `ja` だけを import して 1 回 `format` を呼ぶテスト 1 ファイル。`vp test run --project <project> <probe> --experimental.importDurations.print --experimental.importDurations.limit=10` で測った。差の判定は、比較する回の中央値の差が、両者の最大と最小の差の和を超えるかで行った。指標は `Duration` の `import` を主にし、内訳の self の和 (`Total import time` の self) を補助にした。Vitest docs は Self を "excluding static imports"、Total を "including static imports" と書く。内訳の total の和は、テストファイルの total が依存の total を含むので入れ子を二重に数え、指標にしない。

unit project (Node、pool forks)、3 回ずつ:

| probe                                                          | 回  | Total imports | Slowest import (total-time) | Total import time (self / total) | Duration の import |
| -------------------------------------------------------------- | --- | ------------- | --------------------------- | -------------------------------- | ------------------ |
| バレル (`date-fns`、`date-fns/locale`)                         | 1   | 4             | 938ms                       | 938ms / 1.87s                    | 943ms              |
| バレル                                                         | 2   | 4             | 952ms                       | 952ms / 1.90s                    | 958ms              |
| バレル                                                         | 3   | 4             | 957ms                       | 957ms / 1.91s                    | 963ms              |
| 個別エントリポイント (`date-fns/format`、`date-fns/locale/ja`) | 1   | 4             | 47ms                        | 47ms / 92ms                      | 53ms               |
| 個別エントリポイント                                           | 2   | 4             | 48ms                        | 48ms / 93ms                      | 53ms               |
| 個別エントリポイント                                           | 3   | 4             | 48ms                        | 48ms / 93ms                      | 53ms               |
| `react-day-picker/locale/ja`                                   | 1   | 4             | 961ms                       | 961ms / 1.92s                    | 966ms              |
| `react-day-picker/locale/ja`                                   | 2   | 4             | 951ms                       | 951ms / 1.90s                    | 957ms              |
| `react-day-picker/locale/ja`                                   | 3   | 4             | 952ms                       | 952ms / 1.90s                    | 957ms              |

`Duration` の `import` の中央値は、バレル 958ms、個別エントリポイント 53ms、`react-day-picker/locale/ja` 957ms。バレルと個別エントリポイントの差は 905ms で、ばらつき (20ms + 0ms) を超えた。self の和の中央値でも、バレル 952ms と個別エントリポイント 48ms の差 904ms が、ばらつき (19ms + 1ms) を超えた。バレルの 1 回目では self の和が 3ms + 486ms + 447ms + 2ms = 938ms、total の和が 938ms + 486ms + 447ms + 2ms = 1873ms (表示は 1.87s) で、total の和は date-fns の 2 モジュールを二重に数えている。バレルの 1 回目の内訳では、`date-fns/locale.js` が 486ms、`date-fns/index.js` が 447ms だった。

browser project (chromium)、4 回ずつ (比較は 2-4 回目)。`Import Duration Breakdown` は出なかったので、`Duration` の `import` だけを指標にした:

| probe                        | 1 回目 | 2 回目 | 3 回目 | 4 回目 | 中央値 (2-4 回目) |
| ---------------------------- | ------ | ------ | ------ | ------ | ----------------- |
| バレル                       | 562ms  | 66ms   | 67ms   | 67ms   | 67ms              |
| 個別エントリポイント         | 10ms   | 10ms   | 10ms   | 10ms   | 10ms              |
| `react-day-picker/locale/ja` | 529ms  | 26ms   | 25ms   | 26ms   | 26ms              |

バレルと個別エントリポイントの差は 57ms で、ばらつき (1ms + 0ms) を超えた。バレルと `react-day-picker/locale/ja` の 1 回目は、Vite の "dependencies optimized" と "optimized dependencies changed. reloading" を出した。

### (b) Calendar を描くテスト (react-day-picker が date-fns のルートを読む経路) (2026-09-27、vitest 4.1.11、Node 24.21.0、date-fns 4.4.0、react-day-picker 10.0.1)

`src/components/ui/calendar.tsx` の `Calendar` を 1 つ描くテスト 1 ファイルを、browser project で 6 回ずつ測った (比較は 2-6 回目)。`Import Duration Breakdown` は出なかったので、`Duration` の `import` を指標にした。browser project の `optimizeDeps.include` には、測った時点で `react-day-picker` が入っている。

| 手段                                              | 1 回目 | 2 回目 | 3 回目 | 4 回目 | 5 回目 | 6 回目 | 中央値 (2-6 回目) | 最大 − 最小 |
| ------------------------------------------------- | ------ | ------ | ------ | ------ | ------ | ------ | ----------------- | ----------- |
| なし                                              | 64ms   | 63ms   | 62ms   | 63ms   | 64ms   | 64ms   | 63ms              | 2ms         |
| `resolve.alias` (`date-fns` → `index.cjs`)        | 64ms   | 67ms   | 68ms   | 66ms   | 67ms   | 67ms   | 67ms              | 2ms         |
| `deps.optimizer.client` (`include: ["date-fns"]`) | 61ms   | 64ms   | 61ms   | 61ms   | 61ms   | 62ms   | 61ms              | 3ms         |
| `optimizeDeps.include` に `date-fns` を足す       | 62ms   | 62ms   | 63ms   | 63ms   | 64ms   | 64ms   | 63ms              | 2ms         |

手段なしと比べた中央値は、`resolve.alias` が 4ms 遅く (ばらつき 4ms)、`deps.optimizer.client` が 2ms 速く (ばらつき 5ms)、`optimizeDeps.include` が同じ (差 0ms、ばらつき 4ms) で、どれも差がばらつきを超えなかった。`deps.optimizer.client` を入れた回は 6 回とも "Re-optimizing dependencies because vite config has changed" を出し、`Duration` は 996ms から 1.02s だった (手段なしは 755ms から 764ms)。

### override によるオプションの置き換え (2026-09-27、oxlint 1.82.0)

バレルを import する probe を、import 禁止の override の範囲 (`src/lib/`) と範囲外 (`src/test/`) に 1 つずつ置き、`vp lint -f unix` の `no-restricted-imports` の診断を数えた。probe は `date-fns`、`date-fns/format`、`date-fns/locale` を 1 行ずつ import する。

| 設定                                  | `src/lib/` の probe                    | `src/test/` の probe |
| ------------------------------------- | -------------------------------------- | -------------------- |
| 両方に `paths`                        | 2 件 (`date-fns` と `date-fns/locale`) | 2 件 (同じ)          |
| 両方から `paths` を消す (壊し方 1)    | 0 件                                   | 0 件                 |
| トップレベルだけに `paths` (壊し方 2) | 0 件                                   | 2 件                 |

どの設定でも `date-fns/format` の行は診断されなかった。壊し方 2 の下でも `scripts/checks/integrity/lint-config.test.ts` は 7 件とも通った。

## 出典

| 出典                                                                                                              | 使った内容                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest「Profiling Test Performance」 https://vitest.dev/guide/profiling-test-performance                          | import の時間の測り方と 3 つの手段                                                                                                                                                                                                                                                                                      |
| Vitest config「experimental.importDurations」 https://vitest.dev/config/experimental#experimental-importdurations | "Self: the time it took to import the module, excluding static imports;"、"Total: the time it took to import the module, including static imports."                                                                                                                                                                     |
| Vitest config「deps.optimizer」 https://vitest.dev/config/deps#deps-optimizer                                     | "By default, Vitest uses `optimizer.client` for `jsdom` and `happy-dom` environments, and `optimizer.ssr` for `node` and `edge` environments."、"This options also inherits your `optimizeDeps` configuration (for web Vitest will extend `optimizeDeps`, for ssr - `ssr.optimizeDeps`)." browser mode には触れていない |
| oxlint「no-restricted-imports」 https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports.html    | `paths` は完全一致、`allowTypeImports` の既定は `false`                                                                                                                                                                                                                                                                 |
