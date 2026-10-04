# テストの設定

Vitest の設定の置き場所と、project の足し方・テストでだけ plugin を変える手順・ブラウザと story の project に事前バンドルする依存を足す手順・部品を StrictMode の下で描く設定、その形にした理由を持つ。`vite.config.ts` へ切り出したファイルを組み込む形と、重い依存を遅らせて読み込む手順は `docs/guides/vite-configuration.md` が持つ。検査スクリプトの project の足し方は `docs/guides/testing/check-scripts.md` が持つ。

| 決定                                                                                                   | ADR      |
| ------------------------------------------------------------------------------------------------------ | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                                      | ADR-0004 |
| Vitest の設定は vite.config.ts の test に置き、project は inline に並べて root の設定を継承させる      | ADR-0037 |
| a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす | ADR-0028 |
| story とブラウザテストはアプリと同じく StrictMode の下で描く                                           | ADR-0039 |

## how-to

### 設定の置き場所

| 置くもの                                                                                                                              | 置き場所                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test` の中身 (project の一覧、全 project が共有する `exclude`・`setupFiles`・`unstubEnvs`・`unstubGlobals`、`globalSetup`、coverage) | `tooling/test/config.ts` の `testConfig`。`vite.config.ts` の `test` がこれを読む。project は `exclude` と `setupFiles` と `unstubEnvs` と `unstubGlobals` を継承し、`setupFiles` は project 自身のものと併せて走る ([Vitest docs「Test Projects」][] の Configuration の "arrays like `setupFiles` are concatenated, not overridden")。`globalSetup` は継承されず root で 1 回だけ走り、coverage は root だけが持つ (「project を inline に並べる理由」) |
| 全 project のテストの後に `vi.stubEnv` と `vi.stubGlobal` の値を戻す hook                                                             | `tooling/test/setup.ts`。`testConfig` の `setupFiles` に文字列のパスで登録し、`vite.config.ts` からは import しない。読み込みで `afterEach` を登録すること自体が役目なので、関数で包まない (包むと登録されず、`--no-isolate` でだけ値がファイルをまたいで残る)                                                                                                                                                                                            |
| テスト全体の実行前の準備 (タイムゾーン)                                                                                               | `tooling/test/global-setup.ts`。`testConfig` の `globalSetup` に文字列のパスで登録し、`vite.config.ts` からは import しない。default export の関数を Vitest がメインプロセスで呼ぶ                                                                                                                                                                                                                                                                        |
| ブラウザテストの project                                                                                                              | `tooling/test/browser-project.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| story の project                                                                                                                      | `tooling/test/storybook-project.ts`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ブラウザで走る project に共通する設定 (`tailwindcss()`、chromium を headless で動かす `browser`)                                      | `tooling/test/chromium-project.ts` の `chromiumProjectBase`。ブラウザと story の project は `mergeConfig` でこの上に重ねる                                                                                                                                                                                                                                                                                                                                |
| project が共有する Vite の設定 (`envDir`、`resolve`)                                                                                  | `vite.config.ts` のトップレベル。project はこれを継承する                                                                                                                                                                                                                                                                                                                                                                                                 |
| テストでだけ外す plugin                                                                                                               | `vite.config.ts` の `plugins` の分岐 (「テストでだけ plugin を変える」)                                                                                                                                                                                                                                                                                                                                                                                   |
| 部品を StrictMode で描く設定                                                                                                          | 「StrictMode の下で描く」                                                                                                                                                                                                                                                                                                                                                                                                                                 |

`vitest.config.ts` は作らない (ADR-0037。仕組みは「`vitest.config.ts` を置かない理由」)。

### project を足す

1. `tooling/test/config.ts` の `projects` に inline で足す。ファイルのパスで並べない (「project を inline に並べる理由」)
2. `test.name` を付ける。名前が重なると Vitest がエラーで止まる ([Vitest docs「Test Projects」][]: "All projects must have unique names; otherwise, Vitest will throw an error.")
3. root の `plugins` にある plugin を project に書き直さない。inline の project は root の plugin を継承する ([Vitest docs「sharedViteServer」][]: "If every project repeats the same `plugins` entry, move it to the declaring config.")。project にだけ要る plugin は、その project の `plugins` に足す
4. playwright の provider や `@storybook/addon-vitest` の plugin のような重い依存を使う project は、project を返す関数にし、依存を関数の中で `import()` する。`browserProject` と `storybookProject` がこの形 (`docs/guides/vite-configuration.md`「重い依存を遅らせて読み込む」)
5. ブラウザで走る project は、`mergeConfig(chromiumProjectBase(), defineProject({ ... }))` で共通の設定に重ねる。`tailwindcss()`・`browser` の共通部分を写さない (「project を inline に並べる理由」)
6. `vp test list --filesOnly` で、足した project に集まるファイルを見る。`include` に一致しないテストは、落ちることもなく 1 度も走らない

### テストでだけ plugin を変える

- root の plugin をテストで外すときは、`vite.config.ts` の `plugins` の `process.env.VITEST === "true"` の分岐から外す。config を分けない (「判定を `process.env.VITEST` で書く理由」)
- テストの分岐は `viteReact()` だけを返す。外す plugin ごとの理由は「テストの分岐で plugin を外す理由」
- `tailwindcss()` はテストの分岐に入れない。ブラウザで走る project の共通部分 (`chromiumProjectBase`) が足す。Node の project には要らない

### ブラウザと story の project に事前バンドルする依存を足す

テストの実行中に次のどれかが出たら、その依存が事前バンドルから漏れている。仕組みは「project に `optimizeDeps` を書く理由」にある。

- `dependency optimized: <依存>` か `dependencies optimized` のあとに page が reload する
- `Vite unexpectedly reloaded a test` が出る
- React の hook が `Cannot read properties of null (reading 'useContext')` のように落ちる
- Vitest が `please add mentioned dependencies to your config's optimizeDeps.include field` と警告する

| 出た project                         | 足す先                                                        | 足すもの                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `browser`                            | `tooling/test/browser-project.ts` の `optimizeDeps.include`   | テストで初めて到達した依存                                                                                |
| `storybook-light` / `storybook-dark` | `tooling/test/storybook-project.ts` の `optimizeDeps.include` | 静的な走査で見つからない依存 (`import()` で読まれるもの) だけ。story から静的に辿れる依存は走査で見つかる |

- story の project の `optimizeDeps.exclude` に `@tanstack/react-start` 系を書かない。書かなくても実パッケージへ届かない
- `browser` の `include` を外せるかは、出口条件の issue が動いたときに見直す。`include` を外して `browser` project を回し、上の症状が出ないことで判定する。issue が閉じたことだけを根拠に外さない

### StrictMode の下で描く

story とブラウザテストは、アプリと同じく StrictMode の下で描く (ADR-0039)。

- ブラウザテストは `src/test/browser/browser-setup.tsx` の `configure({ reactStrictMode: true })` が、`render` と `renderHook` の全部に効かせる。テストごとに `<StrictMode>` で包み直さない
- story は `.storybook/preview.tsx` の decorator が包む。decorators の最後に置き、preview の他の decorator を内側に入れる。addon が足す decorator は、どこに置いても StrictMode の外になる。`.storybook/main.ts` の `framework.options.strictMode` では代えない。vitest 経由の story に届かない (ADR-0039)
- 呼び出しの回数を確かめるテストが StrictMode で 2 回を見たら、期待値でも StrictMode でもなく部品を直す。直し方は `docs/guides/react/effects.md`「開発時の二重実行が示すもの」
- mount 直後の effect の付け直し (setup → cleanup → setup) が起きるのはブラウザテストだけで、story では起きない。`configure` は StrictMode を root に置き、decorator は story の部品の中に置くため。cleanup の欠けは story では見つからない (ADR-0039)
- StrictMode が効いていることは、ブラウザテストは `src/test/browser/strict-mode.test.tsx`、story は `src/components/strict-mode.stories.tsx` が確かめる。decorator や `configure` を外すと落ちる

### 設定の落とし穴

| 対象                                            | 起きること                                                                                                                                                          | 対処                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest.config.ts` を足す                       | Vitest がそちらを優先し、`vite.config.ts` の設定を丸ごと黙って無視する (`test`、`envDir`、テストの分岐の plugin を含む)                                             | 足さない。中身は `tooling/test/` に書く                                                                                               |
| Vitest の `createVitest()` を直接呼んで起動する | config を読む時点で `process.env.VITEST` が立たず、テストに `tanstackStart()` などが入る (2026-09-30、vitest 5.0.1 で確認)                                          | `VITEST=true` を渡して起動する                                                                                                        |
| story の project に `browser.viewport` を書く   | `@storybook/addon-vitest` が story ごとに viewport を決め直すので効かない。viewport を選ばない story は、ブラウザテストの `DEFAULT_VIEWPORT` とは別の寸法で描かれる | 寸法を前提にする story は story の側で viewport を選ぶ (`docs/guides/storybook.md`「vitest 経由の story の viewport が決まる仕組み」) |

## explanation

### `vitest.config.ts` を置かない理由

決定は ADR-0037 が持つ。この節は、その形で組む前提になる Vite+ と Vitest の仕組みを持つ。

- Vite+ は Vitest の設定を `vite.config.ts` の `test` に置くよう勧める ([Vite+ docs「Test」][]: "We do not recommend using `vitest.config.ts` with Vite+.")
- `vitest.config.ts` があると、Vitest はそちらを優先して `vite.config.ts` の設定を無視する ([Vitest docs「Configuring Vitest」][]: "all options in your `vite.config` will be **ignored**")。`envDir` のような共有の設定を 2 つの config に写し続けることになる
- 中身は `tooling/test/` に切り出し、`vite.config.ts` には `test: testConfig` の 1 行だけを置く。切り出す形の理由は `docs/guides/vite-configuration.md`「別のファイルから組み立てる理由」

### project を inline に並べる理由

決定は ADR-0037 が持つ。この節は、継承の仕組みと、関数で渡す project の扱いを持つ。

- Vitest 5 では、inline の project だけが root の設定を継承する ([Vitest docs「Test Projects」][]: "Projects referenced as config files or directories do not inherit any options from the root config.")
- root の `globalSetup` は、inline の project にも継承されない。実行ごとに root で 1 回だけ走る ([Vitest docs「Test Projects」][]: "`globalSetup` is not inherited from the root config: the root-level `globalSetup` already runs once per test run")。coverage は project の設定に書けず、root が全体で 1 回取る (同じページの "`coverage`: coverage is done for the whole process")
- ファイルで参照する project でも、共有の設定ファイルを作って `mergeConfig` で合わせれば写さずに済む (同じページの "You can create a shared config file and merge it with the project config yourself")。ただし project ごとに merge を書き、root とは別の共有ファイルを持つことになる。inline なら何も書かずに root を継承する
- 関数で渡した project も inline の project として扱われる。docs に関数の例は無いが、`DEBUG=vitest:projects vp test list --filesOnly` が `inline project "browser" resolves its own Vite config` と出す (2026-09-30、vitest 5.0.1)。自前の Vite config を作りつつ、root の config ファイルを extends する
- ブラウザで走る project (ブラウザテストと story) だけが共有する設定 (`tailwindcss()`、`browser` の共通部分) は root に置けない。置くと Node の project まで `tailwindcss()` と `browser.enabled` を継承する。`extends` は root か 1 つの config ファイルしか指せず ([Vitest docs「Test Projects」][]: "The `extends` option also accepts a path to another config file")、inline の project は入れ子の project を持てない (同じページの "The `projects` option inside an inline configuration is not supported.")。そこで `tooling/test/chromium-project.ts` の `chromiumProjectBase` に置き、各 project が `mergeConfig` で重ねる。同じページがファイルで参照する project 向けに示す、共有の設定を merge する形 ("You can create a shared config file and merge it with the project config yourself") を、inline の project の一部に当てたもの

### 判定を `process.env.VITEST` で書く理由

Vitest は、`vite.config.ts` の中でテストだけ設定を変える形として `process.env.VITEST` と `mode` の 2 つを示している ([Vitest docs「Configuring Vitest」][]: "Use `process.env.VITEST` or `mode` property on `defineConfig` (will be set to `test` if not overridden with `--mode`) to conditionally apply different configuration in `vite.config.ts`.")。

| 判定                 | 評価                                                                                                                                                              | 採否     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `process.env.VITEST` | 上流の修正の PR ([TanStack/router#6074][]。2026-09-30 時点で open) も `process.env.VITEST !== 'true'` で判定している。`vite.config.ts` をオブジェクトのまま書ける | **採用** |
| `mode`               | `vp test --mode <name>` で `test` 以外に変わると、テストに `tanstackStart()` が戻る。`defineConfig` を関数の形にする必要がある                                    | 却下     |

`process.env.VITEST` を `"true"` にする経路は次のとおり。

| 起動の経路                                            | `process.env.VITEST`                                                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp test`                                             | Vitest の CLI が立てる                                                                                                                                                                  |
| Storybook の test panel と `storybook tools test run` | `@storybook/addon-vitest` が起動する子プロセスの env に渡す (10.6.0 の preset)。`storybook tools test run` で全 story が通り、`tanstackStart()` が外れていることを確かめた (2026-09-30) |
| `createVitest()` を直接呼ぶ                           | config を読む時点では立たない (2026-09-30、vitest 5.0.1 で確認)。「設定の落とし穴」を参照                                                                                               |

### テストの分岐で plugin を外す理由

| plugin                  | テストの分岐での扱い        | 理由                                                                                                                                                                                                                                    |
| ----------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tanstackStart()`       | 外す                        | test 環境にも `optimizeDeps` を無条件に注入して React を事前バンドルさせ、React が二重に読み込まれうる。hooks が壊れる ([TanStack/router#6246][]。仕組みの説明は修正の PR の [TanStack/router#6074][]。どちらも 2026-09-30 時点で open) |
| `devtools()`、`nitro()` | 外す                        | テストの経路で使わない                                                                                                                                                                                                                  |
| `tailwindcss()`         | 外す                        | Node の project には要らない。ブラウザで走る project の共通部分 (`chromiumProjectBase`) が足す                                                                                                                                          |
| `viteReact()`           | 残す。`compiler` は渡さない | テストは React Compiler を通らない。アプリの分岐とは別に置いた `viteReact()` なので、`compiler` を付けてもアプリの最適化には関係しない。付けるときは、テストで Compiler を通すかを先に決める                                            |

`tanstackStart()` を外している間は、`createIsomorphicFn` などの Start の変換がテストで効かない ([TanStack/router#6246][] のコメント)。[TanStack/router#6246][] が直ったら、テストの分岐に `tanstackStart()` を戻すかを決め直す。

### project に `optimizeDeps` を書く理由

事前バンドルから漏れた依存に、テストの実行中に初めて到達すると、Vite が依存を最適化し直して page を reload する。reload をまたいで React が二重に解決され、hook が `Cannot read properties of null` で落ちる。`optimizeDeps.include` に挙げた依存は、テストを始める前にまとめて事前バンドルされる。

`browser` project での観測は次のとおり。

| 観測日     | 走らせたテスト                                                     | 症状                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-17 | notes 画面のテスト                                                 | 2 回起きた。1 回は 9 case が全滅し、もう 1 回は `dependency optimized: date-fns` と Vitest の `please add mentioned dependencies to your config's optimizeDeps.include field` の警告が出た |
| 2026-09-27 | `src/components/parts/form-fields.tsx` の `FormDateField` のテスト | `@base-ui/react/popover` と `react-day-picker` に初めて到達したところで `dependencies optimized` と reload が出た                                                                          |

`include` に `@base-ui/react/popover` と `react-day-picker` があるのは、2026-09-27 の観測のとおり、`FormDateField` のテストが実行中に初めて到達する依存だからである。

`browser` の `include` は対症療法である。アプリの分岐では `tanstackStart()` が Vite に事前バンドルの設定を渡すが ([TanStack/router#6246][])、テストの分岐では外している (「テストの分岐で plugin を外す理由」)。出口条件は次の 2 つで、状態は 2026-09-30 に確かめた。

| issue                       | 中身                                                                                             | 状態                | 出口にするか                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TanStack/router#6246][]    | `tanstackStart()` が test 環境にも `optimizeDeps` を無条件に注入し、React が二重に読み込まれうる | open                | する。直ったら、テストの分岐に `tanstackStart()` を戻すかと合わせて、`include` を外せるかを見る                                                                                                           |
| [vitest-dev/vitest#10775][] | Browser Mode で、テストファイルを読んでいる間に Vite が依存を最適化すると、その suite を失う     | closed (2026-07-14) | close は出口にしない。報告者が自分で閉じ、ただ 1 つのコメントは報告者が自分のテストの mock していない HTTP 呼び出しを mock して直したという報告で、close のイベントに commit が無い (`commit_id` が null) |

issue の状態ではなく症状で判定するのは、[vitest-dev/vitest#10775][] のように、上流の修正を経ずに閉じる issue があるためである。判定の手順は「ブラウザと story の project に事前バンドルする依存を足す」にある。

`browser` の `optimizeDeps.exclude` に Start のパッケージ (`@tanstack/react-start`、`@tanstack/react-start-server`、`@tanstack/start-server-core`) を置くのは、`tanstackStart()` の無いテストでは、それらが import する `#tanstack-*-entry` の仮想モジュールを解決できないためである。

story の project の `optimizeDeps` は、次の 2 点で `browser` と違う。どちらも各パッケージの 10.6.0 の `dist` で 2026-09-30 に確かめた。

| 設定      | 中身                                                 | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `include` | 静的な走査で見つからない依存 (`axe-core`) だけを持つ | `@storybook/builder-vite` は story と preview annotation を `optimizeDeps.entries` に積むので ([storybookjs/storybook#33875][])、story から静的に辿れる依存は走査で見つかる。`axe-core` は `@storybook/addon-a11y` の preview が使う `run` が `import("axe-core")` で読むので、静的な走査に出ない                                                                                                                                                                                                            |
| `exclude` | Start のパッケージを書かない                         | `@storybook/tanstack-react` の preset (`viteFinal`) の `moduleInterceptionPlugin` が、`@tanstack/react-start`、`@tanstack/react-start/server`、`@tanstack/react-start-server`、`@tanstack/start-server-core` への import を `resolveId` でモック (`export-mocks/start.js`) へ差し替え、同じ 4 つを自分の `optimizeDeps.exclude` にも入れる。`storybookTest()` はこの `viteFinal` を通るので (`@storybook/addon-vitest` の vitest-plugin が `presets.apply("viteFinal", ...)` を呼ぶ)、実パッケージへ届かない |

### story の project の `cacheDir` をテーマで分ける理由

`storybookTest()` は `configDir` のハッシュから `cacheDir` を導く (`@storybook/addon-vitest` の vitest-plugin が `oneWayHash(configDir)` を projectId にする。10.6.0 の `dist` で 2026-09-30 に確かめた)。テーマ違いの 2 つの project は同じ `configDir` を渡すので、分けないと事前バンドルのキャッシュを 1 つ共有し、実行中に別々の依存を見つけて互いのキャッシュを無効化し合う (2026-09-20 に `@storybook/addon-vitest` 10.6.0、vitest 4.1.11 で観測。story 53 件、`include` を `axe-core` だけにした状態で、共有のままでは 106 ファイル中 62 が失敗して reload が 8 回、分けると全て通り reload は 0 回)。分けておけば、走査の結果が 2 つの project で違っても互いのキャッシュを壊さない。

| 組み方                                                                   | 理由                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order: "post"` の config フックを持つ plugin で `cacheDir` を上書きする | addon は `cacheDir` を順序指定の無い config フックで入れるので、post 順のフックが後から上書きできる。同じ手で project 名は戻せない (ADR-0028)                                           |
| 固定のパス (`node_modules/.cache/storybook-vitest/<theme>`) で組み立てる | browser mode は config を読み直すので、既存の `cacheDir` から相対で作ると `light/light` のように入れ子になる (2026-09-21 までに `@storybook/addon-vitest` 10.6.0、vitest 4.1.11 で観測) |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vite+ は 1.0.0、Vitest は 5.0.1 に固定した版を指す。

[Vite+ docs「Test」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/test.md
[Vitest docs「Configuring Vitest」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/index.md
[Vitest docs「Test Projects」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/projects.md
[Vitest docs「sharedViteServer」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/sharedviteserver.md
[TanStack/router#6246]: https://github.com/TanStack/router/issues/6246
[TanStack/router#6074]: https://github.com/TanStack/router/pull/6074
[vitest-dev/vitest#10775]: https://github.com/vitest-dev/vitest/issues/10775
[storybookjs/storybook#33875]: https://github.com/storybookjs/storybook/pull/33875
