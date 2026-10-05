# テストの設定

Vitest の設定の置き場所と、project の足し方・テストでだけ plugin を変える手順・React Compiler を通さない project の範囲・ブラウザと story の project に事前バンドルする依存を足す手順・部品を StrictMode の下で描く設定、その形にした理由を持つ。`vite.config.ts` へ切り出したファイルを組み込む形と、重い依存を遅らせて読み込む手順は `docs/guides/vite-configuration.md` が持つ。検査スクリプトの project の足し方は `docs/guides/testing/check-scripts.md` が持つ。

| 決定                                                                                                   | ADR      |
| ------------------------------------------------------------------------------------------------------ | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                                      | ADR-0004 |
| Vitest の設定は vite.config.ts の test に置き、project は inline に並べて root の設定を継承させる      | ADR-0037 |
| a11y の自動検査は story を `error` でテーマごとに走らせ、`incomplete` は描画を統制できる層でだけ落とす | ADR-0028 |
| story とブラウザテストはアプリと同じく StrictMode の下で描く                                           | ADR-0039 |
| メモ化は React Compiler に委ね、予防的なメモ化を強制しない                                             | ADR-0014 |

## how-to

### 設定の置き場所

| 置くもの                                                                                                                              | 置き場所                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test` の中身 (project の一覧、全 project が共有する `exclude`・`setupFiles`・`unstubEnvs`・`unstubGlobals`、`globalSetup`、coverage) | `tooling/test/config.ts` の `testConfig`。`vite.config.ts` の `test` がこれを読む。project は `exclude` と `setupFiles` と `unstubEnvs` と `unstubGlobals` を継承し、`setupFiles` は project 自身のものと併せて走る ([Vitest docs「Test Projects」][] の Configuration の "arrays like `setupFiles` are concatenated, not overridden")。`globalSetup` は継承されず root で 1 回だけ走り、coverage は root だけが持つ (「project を inline に並べる理由」) |
| 全 project のテストの後に `vi.stubEnv` と `vi.stubGlobal` の値を戻す hook                                                             | `tooling/test/setup.ts`。`testConfig` の `setupFiles` に文字列のパスで登録し、`vite.config.ts` からは import しない。読み込みで `afterEach` を登録すること自体が役目なので、関数で包まない (包むと登録されず、`--no-isolate` でだけ値がファイルをまたいで残る)                                                                                                                                                                                            |
| テスト全体の実行前の準備 (タイムゾーン)                                                                                               | `tooling/test/global-setup.ts`。`testConfig` の `globalSetup` に文字列のパスで登録し、`vite.config.ts` からは import しない。default export の関数を Vitest がメインプロセスで呼ぶ                                                                                                                                                                                                                                                                        |
| ブラウザテストの project                                                                                                              | `tooling/test/browser-project.ts`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| story の project                                                                                                                      | `tooling/test/storybook-project.ts`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ブラウザで走る project に共通する設定 (React の plugin、`tailwindcss()`、chromium を headless で動かす `browser`)                     | `tooling/test/chromium-project.ts` の `chromiumProjectBase`。React Compiler を通すかを引数で受ける。ブラウザと story の project は `mergeConfig` でこの上に重ねる                                                                                                                                                                                                                                                                                         |
| React の plugin (`@vitejs/plugin-react`)                                                                                              | `tooling/plugins/react.ts` の `reactPlugin`。アプリの `plugins` と `chromiumProjectBase` の両方がここから作る (「テストでだけ plugin を変える」)                                                                                                                                                                                                                                                                                                          |
| project が共有する Vite の設定 (`envDir`、`resolve`)                                                                                  | `vite.config.ts` のトップレベル。project はこれを継承する                                                                                                                                                                                                                                                                                                                                                                                                 |
| テストでだけ外す plugin                                                                                                               | `vite.config.ts` の `plugins` の分岐 (「テストでだけ plugin を変える」)                                                                                                                                                                                                                                                                                                                                                                                   |
| 部品を StrictMode で描く設定                                                                                                          | 「StrictMode の下で描く」                                                                                                                                                                                                                                                                                                                                                                                                                                 |

`vitest.config.ts` は作らない (ADR-0037。仕組みは「`vitest.config.ts` を置かない理由」)。

### project を足す

1. `tooling/test/config.ts` の `projects` に inline で足す。ファイルのパスで並べない (「project を inline に並べる理由」)
2. `test.name` を付ける。名前が重なると Vitest がエラーで止まる ([Vitest docs「Test Projects」][]: "All projects must have unique names; otherwise, Vitest will throw an error.")
3. root の `plugins` にある plugin を project に書き直さない。inline の project は root の plugin を継承する ([Vitest docs「sharedViteServer」][]: "If every project repeats the same `plugins` entry, move it to the declaring config.")。project にだけ要る plugin は、その project の `plugins` に足す。React の plugin は root に置かず、ブラウザで走る project が `chromiumProjectBase` から足す (「テストでだけ plugin を変える」)
4. playwright の provider や `@storybook/addon-vitest` の plugin のような重い依存を使う project は、project を返す関数にし、依存を関数の中で `import()` する。`browserProject` と `storybookProject` がこの形 (`docs/guides/vite-configuration.md`「重い依存を遅らせて読み込む」)
5. ブラウザで走る project は、`mergeConfig(chromiumProjectBase({ compiler: true }), defineProject({ ... }))` で共通の設定に重ねる。React の plugin・`tailwindcss()`・`browser` の共通部分を写さない (「project を inline に並べる理由」)。`compiler: false` は `NO_COMPILER_DIR` を集める project にだけ渡す (「React Compiler を通さない project を足す」)
6. `vp test list --filesOnly` で、足した project に集まるファイルを見る。`include` に一致しないテストは、落ちることもなく 1 度も走らない

### テストでだけ plugin を変える

- root の plugin をテストで外すときは、`vite.config.ts` の `plugins` の `process.env.VITEST === "true"` の分岐から外す。config を分けない (「判定を `process.env.VITEST` で書く理由」)
- テストの分岐は plugin を返さない。外す plugin ごとの理由は「テストの分岐で plugin を外す理由」
- React の plugin は `tooling/plugins/react.ts` の `reactPlugin` から作り、テストの分岐と project で別の `viteReact()` を書かない。`viteReact` の作り方を 1 か所にし、アプリとテストの違いを `compiler` と `logDiagnostics` の 2 つに限る。別に書くと、ほかの option がアプリとテストで食い違っても、テストは全部通る
- React の plugin と `tailwindcss()` は、ブラウザで走る project の共通部分 (`chromiumProjectBase`) が足す。Node の project には要らない。`.tsx` は Vite+ の既定の JSX 変換が扱う
- `logDiagnostics` はアプリの分岐だけが立てる (「テストでも React Compiler を通す理由」)

### React Compiler を通さない project を足す

`src/components/ui/` は、Compiler を通す project と通さない project の両方で走らせる (「テストでも React Compiler を通す理由」)。範囲は `tooling/test/chromium-project.ts` の `NO_COMPILER_DIR` (`src/components/ui`) が持ち、通さない 2 つの project はどちらもここから組み立てる。通さない project は次のとおり。

| project                       | 集めるもの                        | 組み方                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser-no-compiler`         | `src/components/ui/**/*.test.tsx` | `browserProject({ compiler: false })`。`NO_COMPILER_DIR` から `include` を組み立てて絞る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `storybook-light-no-compiler` | `src/components/ui/` の story     | `storybookProject({ theme: "light", compiler: false })`。`@storybook/addon-vitest` は `test.include` を無視する (`The values you passed to "test.include" will be ignored`) ので、`.storybook/main.ts` の `stories` と `NO_COMPILER_DIR` から `test.exclude` を組み立て (`scripts/lib/storybook-stories.ts` の `excludeStoriesOutside`)、範囲の外の story を除く。`stories` が `../<起点>/**/<ファイル名の glob>` の 1 つだけの配列でないときと、`NO_COMPILER_DIR` が起点の直下に無いときは、設定の解決で止まる。事前バンドルの `cacheDir` も project ごとに分ける (「story の project の `cacheDir` を分ける理由」) |

- `src/components/ui/` の外のテストと story を、Compiler を通さない project に入れない。アプリのコードのブラウザモードのテストは、Compiler を通す project だけで走らせる
- story の Compiler を通さない project は light だけにし、dark を足さない (「テストでも React Compiler を通す理由」)
- Storybook 経由の実行 (`VITEST_STORYBOOK` が真) では、story の Compiler を通さない project を作らない。addon が project 名を `storybook:<configDir>` へ上書きするので、作ると `Project name ... is not unique` で止まる (`scripts/lib/storybook-env.ts` の docstring)
- 足したあとは `vp test list --filesOnly` で、Compiler を通さない project に `NO_COMPILER_DIR` のファイルだけが集まることを見る
- `src/components/ui/` のテストを手で走らせるときは、`--project` を付けずにファイルを指定する (`vp test run src/components/ui/calendar.test.tsx`)。指定したファイルを集めるすべての project で走る (`*.test.tsx` は 2 つ、story は 3 つ)。`--project browser` で絞ると、Compiler を通す側だけになる

### ブラウザと story の project に事前バンドルする依存を足す

テストの実行中に次のどれかが出たら、その依存が事前バンドルから漏れている。仕組みは「project に `optimizeDeps` を書く理由」にある。

- `dependency optimized: <依存>` か `dependencies optimized` のあとに page が reload する
- `Vite unexpectedly reloaded a test` が出る
- React の hook が `Cannot read properties of null (reading 'useContext')` のように落ちる
- Vitest が `please add mentioned dependencies to your config's optimizeDeps.include field` と警告する

| 出た project                                                         | 足す先                                                        | 足すもの                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `browser` / `browser-no-compiler`                                    | `tooling/test/browser-project.ts` の `optimizeDeps.include`   | テストで初めて到達した依存                                                                                |
| `storybook-light` / `storybook-dark` / `storybook-light-no-compiler` | `tooling/test/storybook-project.ts` の `optimizeDeps.include` | 静的な走査で見つからない依存 (`import()` で読まれるもの) だけ。story から静的に辿れる依存は走査で見つかる |

- story の project の `optimizeDeps.exclude` に `@tanstack/react-start` 系を書かない。書かなくても実パッケージへ届かない
- `browser` の `include` を外せるかは、出口条件の issue が動いたときに見直す。`include` を外して `browser` project を回し、上の症状が出ないことで判定する。issue が閉じたことだけを根拠に外さない

### StrictMode の下で描く

StrictMode で包む口と効く範囲は次のとおり (ADR-0039)。

- ブラウザテストは `src/test/browser/browser-setup.tsx` の `configure({ reactStrictMode: true })` が、`render` と `renderHook` の全部に効かせる。テストごとに `<StrictMode>` で包み直さない
- story は `.storybook/preview.tsx` の decorator が包む。decorators の最後に置き、preview の他の decorator を内側に入れる。addon と framework が足す decorator は preview の decorator の外側に来るので、StrictMode の外になる (router の decorator は除く)。`.storybook/main.ts` の `framework.options.strictMode` では代えない。vitest 経由の story に届かない (ADR-0039)
- mount 直後の effect の付け直し (setup → cleanup → setup) が起きるのはブラウザテストだけで、story では起きない。`configure` は StrictMode を root に置き、decorator は story の部品の中に置くため。cleanup の欠けは story では見つからない (ADR-0039)
- 部品のテストで、描画中に起こす副作用 (warn、通知、外への書き込み) の回数が StrictMode で 2 回になったら、期待値を 2 に合わせず、副作用をイベントハンドラへ、置けるハンドラが無ければ effect へ移す。純粋な計算は 2 回呼ばれても結果が変わらないので、呼び出しの回数で確かめない ([React docs「Keeping Components Pure」][] の「Detecting impure calculations with StrictMode」と「Where you can cause side effects」)
- ブラウザテストで StrictMode が効いていることは `src/test/browser/strict-mode.test.tsx` が確かめる

### 設定の落とし穴

| 対象                                            | 起きること                                                                                                                                                          | 対処                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest.config.ts` を足す                       | Vitest がそちらを優先し、`vite.config.ts` の設定を丸ごと黙って無視する (`test`、`envDir`、テストの分岐の plugin を含む)                                             | 足さない。中身は `tooling/test/` に書く                                                                                               |
| Vitest の `createVitest()` を直接呼んで起動する | config を読む時点で `process.env.VITEST` が立たず、テストに `tanstackStart()` などが入る (2026-09-30、vitest 5.0.1 で確認)                                          | `VITEST=true` を渡して起動する                                                                                                        |
| story の project に `browser.viewport` を書く   | `@storybook/addon-vitest` が story ごとに viewport を決め直すので効かない。viewport を選ばない story は、ブラウザテストの `DEFAULT_VIEWPORT` とは別の寸法で描かれる | 寸法を前提にする story は story の側で viewport を選ぶ (`docs/guides/storybook.md`「vitest 経由の story の viewport が決まる仕組み」) |
| `vp test run --coverage` のカバレッジ           | ブラウザモードの project が読んだ部品では、Compiler が足したコードも数えられ、カバレッジが下がる                                                                    | カバレッジに閾値を置くときは、Compiler を通した数値で決める (「テストでも React Compiler を通す理由」)                                |

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

| plugin                  | テストの分岐での扱い | 理由                                                                                                                                                                                                                                    |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tanstackStart()`       | 外す                 | test 環境にも `optimizeDeps` を無条件に注入して React を事前バンドルさせ、React が二重に読み込まれうる。hooks が壊れる ([TanStack/router#6246][]。仕組みの説明は修正の PR の [TanStack/router#6074][]。どちらも 2026-09-30 時点で open) |
| `devtools()`、`nitro()` | 外す                 | テストの経路で使わない                                                                                                                                                                                                                  |
| `tailwindcss()`         | 外す                 | Node の project には要らない。ブラウザで走る project の共通部分 (`chromiumProjectBase`) が足す                                                                                                                                          |
| `viteReact()`           | 外す                 | ブラウザで走る project が、アプリと同じ `reactPlugin` から Compiler の有無ごとに足す。Node の project には要らない (「テストでも React Compiler を通す理由」)                                                                           |

`tanstackStart()` を外している間は、`createIsomorphicFn` などの Start の変換がテストで効かない ([TanStack/router#6246][] のコメント)。[TanStack/router#6246][] が直ったら、テストの分岐に `tanstackStart()` を戻すかを決め直す。

### テストでも React Compiler を通す理由

ブラウザで動くのは Compiler が変換したコードで、Compiler に起因する実行時の問題は変換後のコードでしか表に出ない。[React docs「Debugging and Troubleshooting」][] は、その原因を 2 つ挙げる。

- Compiler が検出できない Rules of React の違反を、誤って変換する ("This typically happens when your code violates the Rules of React in subtle ways that the compiler couldn't detect, and the compiler mistakenly compiled a component it should have skipped.")
- メモ化に正しさを頼るコードを、Compiler が手で書いたのと違う形でメモ化する ("Since the compiler may memoize differently than your manual approach, this can lead to unexpected behavior like effects over-firing, infinite loops, or missing updates.")

アプリのコードと `src/components/ui/` で、走らせる project を分ける。

| 対象                 | 走らせる project                                                                                                                                        | 理由                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アプリのコード       | ブラウザモードでは、Compiler を通す project (`browser`、`storybook-light`、`storybook-dark`) だけ。Node の `unit` は Compiler を通らない (この節の末尾) | 上の 2 つは、Compiler を通したテストでしか見つからない。Compiler の担当者は、実験的リリースの方針の投稿で、アプリの変換後の版を手元で確かめるよう書いている (docs ではなく 2024-04-11 の discussion の投稿。[reactwg/react-compiler#1][]: "Test the compiled version of the site locally.")。アプリのコードがメモ化に正しさを頼らないことは、`docs/guides/react/memoization.md`「手動メモ化を書く」の規範で守り、Compiler を通さない project には入れない |
| `src/components/ui/` | Compiler を通す project と、通さない project (`browser-no-compiler`、`storybook-light-no-compiler`) の両方                                              | registry から取り込んだ部品で、ライブラリと同じ立場にある。react.dev は、ライブラリのテストを両方で走らせるよう勧める ([React docs「Compiling Libraries」][]: "Test your library both with and without compilation to ensure compatibility. Run your existing test suite against the compiled code, and also create a separate test configuration that bypasses the compiler.")。Compiler は、上流の部品の欠陥を隠すことがある。下の calendar の例を参照  |

Compiler が上流の欠陥を隠す例は、`calendar.tsx` の上流の版 (`docs/registry-baseline/calendar.tsx`) である。上流は `components` の `Root`・`Chevron`・`WeekNumber` を描画中にインラインの関数で定義する。描画中に部品を定義する欠陥で、[shadcn-ui/ui#11134][] の本文は "This violates the React rule against defining components during render" と書く。Compiler はこれを関数の外出しとメモ化で隠す。2026-10-05 に `oxc-transform-react` 0.147.0 で上流の `calendar.tsx` を変換すると、`Root`・`Chevron`・`WeekNumber` はモジュールの関数へ外出しされ、`DayButton` は `locale` でメモ化された。同じ日に上流の `calendar.tsx` を部品の位置に置いて `calendar.test.tsx` を走らせると、再描画のテストは `browser` で通り、`browser-no-compiler` で落ちた。

Compiler の有無は、project ごとに React の plugin を持たせて切り替える。

| 切り替え方                                                                          | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 採否     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ブラウザで走る project が、Compiler の有無ごとに React の plugin を持つ             | Vitest は、project ごとに plugin の振る舞いを変えるなら server を共有しない形を示す ([Vitest docs「sharedViteServer」][]: "If a plugin needs to behave differently per project, disable this option or don't share the server for that project")。ブラウザで走る project は `browser` を持つので、もともと自分の server を持つ (同じページ)。`vp test run` の 1 回で両方が走り、`mise run verify` と CI に手順を足さない。ブラウザテストの project の `cacheDir` は Vitest が project 名のハッシュで分ける (vitest 5.0.1 の `VitestCache.resolveCacheDir`)。ライブラリにも同じ形の先行例がある ([sanity-io/react-rx の vitest.config.ts][]、[starbeamjs/starbeam の vitest.config.mts][]) | **採用** |
| root の `plugins` に React の plugin を置き、Compiler を通さない project でだけ外す | 継承した配列は連結されるので ([Vitest docs「Test Projects」][]: "Note that arrays like `setupFiles` are concatenated, not overridden.")、継承した plugin を project で外せない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 却下     |
| 環境変数で Compiler を外し、`src/components/ui/` を別の実行として走らせる           | 実行の手順を `mise run verify` と CI に足すことになる。同じ project 名のまま Compiler の有無が変わるので、事前バンドルの `cacheDir` を分ける手当てが要り、シェルに残った環境変数で Compiler が黙って外れる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 却下     |

Compiler を通さない story の project は light だけにする。テーマを 2 つ持つのは a11y の色の検査のためで (ADR-0028)、Compiler が変えるのはメモ化であり、描く色はテーマで決まる。色の検査は Compiler を通す 2 つの project が持つ。

| 手放すもの       | 中身                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| カバレッジの数値 | Compiler が足したコードもカバレッジに数えられ、数値が下がる。2026-10-05 に `browser` の project を `--coverage` で測ると、branch の総数が 572 から 2252 に増え、branch は 60.31% から 56.12%、lines は 69.15% から 59.02% になった (`oxc-transform-react` 0.147.0、`@vitest/coverage-v8` 5.0.1)。同じ低下を [oxc-project/oxc#26810][] が報告している (2026-10-05 時点で open)。このテンプレートは coverage を `mise run verify` にも CI にも入れておらず、閾値も無い |
| 実行時間         | Compiler を通さない 2 つの project の分だけ延びる。2026-10-05 に `vp test run` 全体と、その 2 つを除いた project だけの実行を交互に 3 回ずつ走らせ、`real` は全体が 52.7〜57.4 秒、除いた実行が 37.5〜39.5 秒だった (Vitest 5.0.1、Node 24.20.0、Apple M3 の 8 コア。直前の実行の負荷が残り、1 分の load average は 2.4〜20.6)                                                                                                                                       |

Compiler がかかる範囲と、診断の扱いは次のとおり。

- `@vitejs/plugin-react` 6.1.1 は、Vite の environment の consumer が `server` でないときだけ Compiler をかけ、`node_modules` を変換しない (`dist/index.js` の `createReactCompilerPlugin` の `isClient` と、`defaultExcludeRE`)。2026-10-05 に、変換後の `src/components/ui/separator.tsx` に `_c(` が、Compiler を通す project (`browser`、`storybook-light`、`storybook-dark`) では現れ、通さない project (`browser-no-compiler`、`storybook-light-no-compiler`) では現れないことを確かめた
- Node の project は React の plugin を持たず、Compiler を通らない
- テストでは `logDiagnostics` を立てない。テストで出すと、そのファイルを読むブラウザモードの project ごとに同じ bail out を出し直す。bail out はビルドログと `vp lint -D react/todo` で読む (`docs/guides/react/memoization.md`「React Compiler の診断を読む」)

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

### story の project の `cacheDir` を分ける理由

`storybookTest()` は `configDir` のハッシュから `cacheDir` を導く (`@storybook/addon-vitest` の vitest-plugin が `oneWayHash(configDir)` を projectId にする。10.6.0 の `dist` で 2026-09-30 に確かめた)。story の project はどれも同じ `configDir` を渡すので、分けないと事前バンドルのキャッシュを 1 つ共有し、実行中に別々の依存を見つけて互いのキャッシュを無効化し合う (2026-09-20 に `@storybook/addon-vitest` 10.6.0、vitest 4.1.11 で観測。story 53 件、`include` を `axe-core` だけにした状態で、共有のままでは 106 ファイル中 62 が失敗して reload が 8 回、分けると全て通り reload は 0 回)。分けておけば、走査の結果が project ごとに違っても互いのキャッシュを壊さない。Compiler を通さない project は、同じテーマの project とも分ける。事前バンドルする依存が違い、Compiler を通す project だけが `react/compiler-runtime` を足す (`@vitejs/plugin-react` 6.1.1 の `createReactCompilerPlugin` の `config` フック)。

| 組み方                                                                                                                         | 理由                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order: "post"` の config フックを持つ plugin で `cacheDir` を上書きする                                                       | addon は `cacheDir` を順序指定の無い config フックで入れるので、post 順のフックが後から上書きできる。同じ手で project 名は戻せない (ADR-0028)                                           |
| 固定のパス (`node_modules/.cache/storybook-vitest/<theme>`、Compiler を通さない project は `<theme>-no-compiler`) で組み立てる | browser mode は config を読み直すので、既存の `cacheDir` から相対で作ると `light/light` のように入れ子になる (2026-09-21 までに `@storybook/addon-vitest` 10.6.0、vitest 4.1.11 で観測) |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vite+ は 1.0.0、Vitest は 5.0.1 に固定した版を指す。sanity-io/react-rx と starbeamjs/starbeam の設定は、2026-10-05 に読んだ commit に固定した。

[Vite+ docs「Test」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/test.md
[Vitest docs「Configuring Vitest」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/index.md
[Vitest docs「Test Projects」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/projects.md
[Vitest docs「sharedViteServer」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/sharedviteserver.md
[TanStack/router#6246]: https://github.com/TanStack/router/issues/6246
[TanStack/router#6074]: https://github.com/TanStack/router/pull/6074
[vitest-dev/vitest#10775]: https://github.com/vitest-dev/vitest/issues/10775
[storybookjs/storybook#33875]: https://github.com/storybookjs/storybook/pull/33875
[React docs「Keeping Components Pure」]: https://react.dev/learn/keeping-components-pure
[React docs「Debugging and Troubleshooting」]: https://react.dev/learn/react-compiler/debugging
[React docs「Compiling Libraries」]: https://react.dev/reference/react-compiler/compiling-libraries
[reactwg/react-compiler#1]: https://github.com/reactwg/react-compiler/discussions/1
[shadcn-ui/ui#11134]: https://github.com/shadcn-ui/ui/issues/11134
[sanity-io/react-rx の vitest.config.ts]: https://github.com/sanity-io/react-rx/blob/c346d3fd008bea09b63e18bb3ebe4c286a0e4002/packages/react-rx/vitest.config.ts
[starbeamjs/starbeam の vitest.config.mts]: https://github.com/starbeamjs/starbeam/blob/c2781eb9a4357d01e51b504e618adf5c69adf32d/vitest.config.mts
[oxc-project/oxc#26810]: https://github.com/oxc-project/oxc/issues/26810
