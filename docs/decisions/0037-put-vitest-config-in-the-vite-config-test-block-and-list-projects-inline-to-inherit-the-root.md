# ADR-0037: Vitest の設定は vite.config.ts の test に置き、project は inline に並べて root の設定を継承させる

- Status: Accepted
- Date: 2026-10-30
- 関連: ADR-0004 (ツールチェーンを Vite+ に寄せる)

## Context

Vitest の設定は、`vitest.config.ts` に分けても `vite.config.ts` の `test` に置いても動く。2 つには次の違いがある。

- Vite+ は `vite.config.ts` の `test` に置くよう勧め、`vitest.config.ts` を推奨しない (Vite+ docs「Test」: "We do not recommend using `vitest.config.ts` with Vite+.")
- `vitest.config.ts` があると Vitest はそちらを優先し、`vite.config.ts` の設定を無視する (Vitest docs「Configuring Vitest」: "all options in your `vite.config` will be **ignored**")。`envDir: false` (ADR-0004) のような共有の設定は、config ごとに写すことになる

テストでは `tanstackStart()` を外す必要がある。2026-10-14 に、テストの経路に `tanstackStart()` を戻して全 project を走らせると (`@tanstack/react-start` 1.168.60 と 1.169.1、React 19.3.0)、次の 2 つが起きた。どちらも、Start の route の code splitting を止めると消えた。

- React が "This library called use() to suspend in a previous render but did not call use() when it finished" を出す。Start を入れた 16 run のすべてで出て、テストは通る。preload されない `lazyRouteComponent` が初回の mount で suspend すると出る上流の不具合で (TanStack/router#8487、修正の TanStack/router#8549。どちらも 2026-10-30 時点で open)、component の chunk の読み込みを握るテスト (`docs/guides/testing/real-router.md`「component の chunk の読み込みを握る」) が、Start が分割した component を `lazyRouteComponent` で包み直すとこの形になる
- ダイアログの route を開くテストで、先頭のテストが click の timeout (`locator.click: Timeout 5000ms exceeded`) で落ちる。1.168.60 で Start ありは 8 回中 4 回、なしは 8 回中 0 回だった。落ちたときはリンクが pending の表示のままだった。split を止める (`codeSplittingOptions.defaultBehavior: []`) と 3 回中 0 回で、use() の警告も消えた。3 回では弱く、split が原因かは特定していない

試行の 1.169.1 の組と 1.169.4 の組の間で、TanStack の実行時のパッケージで変わったのは `@tanstack/router-core` の `manifest.js` と `@tanstack/start-server-core` の `early-hints.js` だけである (2026-10-30 に tarball を比べた。1.168.60 の組とは比べていない)。React は 19.3.0 から 19.3.1 に、code splitting を行う build の plugin (`@tanstack/router-plugin` 1.168.45 から 1.168.48、`@tanstack/start-plugin-core` 1.171.52 から 1.171.55) も版が上がっている。2 つが 1.169.4 でも起きるかは測っていない。

`tanstackStart()` は 1.169.4 でも、client の environment に `optimizeDeps` (`react`、`react-dom` などの `include`) を無条件に注入する (`tanstack-react-start:config` plugin の `configEnvironment` の `needsOptimizeDeps`)。この注入で React が二重に読み込まれて hooks が壊れるという報告 (TanStack/router#6246) は、2026-10-11 に報告者が "Seems like this is is working now" (原文のまま) とだけ書いて閉じ、close のイベントに commit は無い。同じ試行でも、その症状 (Invalid hook call、React の二重の読み込み、再最適化) は、Start を入れた 16 run を含む全 21 run で 0 回だった。TanStack/router#6074 は、plugin を変えずにテストを足すだけの PR である (2026-10-30 時点で open。本文は "No production plugin changes" と書き、jsdom で、plugin を変えないままテストが通ったとする)。

テスト用の config を分ければ plugin を別に持てるが、`vite.config.ts` の中でテストのときだけ設定を変える形も Vitest が示している (Vitest docs「Configuring Vitest」: "Use `process.env.VITEST` or `mode` property on `defineConfig` … to conditionally apply different configuration in `vite.config.ts`.")。

## Decision

**Vitest の設定は `vite.config.ts` の `test` に置き、中身は `tooling/test/` から import して組み立てる。project はどれも inline に並べて root の設定を継承させ、テストで外す plugin は `vite.config.ts` の `plugins` の `process.env.VITEST` の分岐で外す。**

- 組み立て方は Vite+ が示す形に従う (Vite+ docs「Monorepo」 の「Composing Configuration Files」)
- Vitest 5 では、inline の project だけが root の設定を継承する (Vitest docs「Test Projects」: "Projects referenced as config files or directories do not inherit any options from the root config.")。関数で渡した project も inline として扱われる。docs に関数の例は無く、`DEBUG=vitest:projects vp test list --filesOnly` の出力で確かめた (2026-09-30、vitest 5.0.1)
- 置き場所、project の足し方、分岐の書き方は `docs/guides/testing/configuration.md`、切り出したファイルの組み込み方と重い依存を遅らせる理由は `docs/guides/vite-configuration.md` にある

| 案                                                                                                          | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 採否     |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `vite.config.ts` の `test` に置き、`tooling/test/` の project を inline に並べる                            | Vite+ の推奨に沿う。共有の設定を root の 1 箇所に持ち、project が継承する                                                                                                                                                                                                                                                                                                                                                                              | **採用** |
| `vitest.config.ts` を分けて持つ                                                                             | Vite+ が推奨しない。`vite.config.ts` が無視されるので、共有の設定を写し続ける。`tanstackStart()` を外す目的は `vite.config.ts` の中の分岐で足りる                                                                                                                                                                                                                                                                                                      | 却下     |
| `vitest.config.ts` を分け、`mergeConfig` で `vite.config.ts` を引き継ぐ                                     | 写しは消えるが、Vite+ が推奨しない `vitest.config.ts` を置くことに変わりはない。`tanstackStart()` も一緒に引き継ぐので、外すには結局 `vite.config.ts` の側で分岐が要る                                                                                                                                                                                                                                                                                 | 却下     |
| project を `test.projects` にファイルのパスで並べる                                                         | Vitest の書き方の 1 つだが、ファイルで参照した project は root を継承しない。共有の設定ファイルを `mergeConfig` で合わせる手もあるが、全 project が共有する設定まで project ごとに merge を書き、root とは別の共有ファイルを持つことになる。ブラウザで走る project だけが共有する設定を merge で重ねる形とは別の話 (`docs/guides/testing/configuration.md`「project を inline に並べる理由」)                                                          | 却下     |
| `test` の中身を `vite.config.ts` に直接書く                                                                 | `vite.config.ts` が長くなる。import で組み立てても Vite+ の推奨からは外れない                                                                                                                                                                                                                                                                                                                                                                          | 却下     |
| `tanstackStart()` をテストでも残し、root から全 project に継承させる                                        | テストでも `createIsomorphicFn` などの Start の変換が効く。2026-10-14 の試行で、Context の 2 つが起きた。story の project にも Start の plugin が入る。Storybook の TanStack 専用の framework が Start の plugin を外す処理 (`viteFinal`) は addon-vitest の経路で効かず、story は Start の plugin を載せたまま走った (Storybook 10.6.1)。story の project は Start を Storybook の TanStack 専用の framework で扱う前提 (storybookjs/storybook#33747) | 却下     |
| `tanstackStart()` を `browserProject()` にだけ足す                                                          | story と Node の project に Start の plugin が入らない。Context の 2 つはブラウザテストで起きるので残る                                                                                                                                                                                                                                                                                                                                                | 却下     |
| `tanstackStart()` を戻し、route の code splitting だけを止める (`codeSplittingOptions.defaultBehavior: []`) | 試行では 2 つとも消えた (timeout は 3 回だけの観測)。Router docs「How to Test File-Based Routing」の Vitest の設定例も `tanstackRouter()` を `autoCodeSplitting` なしで使う。テストの route の読み込みが、split する本番と変わる。それを受け入れるかを決める材料 (timeout の原因) がまだ無く、今は採らない                                                                                                                                             | 却下     |
| plugin の中で `optimizeDeps` の注入だけを止める                                                             | 注入を止める上流の修正は無く (TanStack/router#6074 は plugin を変えない)、採るには `@tanstack/react-start` に patch を当てることになる。試行の 2 つは split を止めると消えたもので、注入を止めても残る見込みである。事前バンドルする依存を手で足す手当ても残る (2026-09-30、`@tanstack/react-start` 1.168.58)                                                                                                                                          | 却下     |

## Consequences

- `envDir: false` は `vite.config.ts` に 1 つだけ書けば、ビルドとテストの両方に効く
- テストは `tanstackStart()` を通らないので、`createIsomorphicFn` などの Start の変換はテストで効かない (TanStack/router#6246 のコメント)
- テストの分岐は root の plugin を全部外し、React の plugin はブラウザで走る project が足す。継承した plugin は project で外せないので (Vitest docs「Test Projects」: "arrays like `setupFiles` are concatenated, not overridden")、React Compiler の有無は project ごとに決まる。ブラウザで走る project のテストは Compiler を通り、`src/components/ui/` は Compiler を通さない project でも走る。理由は `docs/guides/testing/configuration.md`「テストでも React Compiler を通す理由」にある
- `process.env.VITEST` が立たない経路 (Vitest の `createVitest()` を直接呼ぶ) では `tanstackStart()` が外れない。経路ごとの扱いは `docs/guides/testing/configuration.md`「判定を `process.env.VITEST` で書く理由」にある
- ブラウザの project も、Vite+ の `defineConfig` が root に足す test 用の plugin (`vite-plus:vitest-resolver` など) を継承し、その plugin がブラウザの project に `vitest` などの alias を足す。`vite-plus` が export する `defineProject` の docstring は、ブラウザの project がこの plugin を受け取らないと pnpm strict や Yarn PnP で `vitest` を解決できないことがあると書いている

## 出典

- Vite+ が Vitest の設定を `vite.config.ts` の `test` に置くよう勧めること (Vite+ docs「Test」、1.0.0): https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/test.md
- 設定を別のファイルから import して組み立てる形 (Vite+ docs「Monorepo」の「Composing Configuration Files」、1.0.0): https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/monorepo.md
- `vitest.config.ts` が `vite.config.ts` を無視することと、`process.env.VITEST` か `mode` でテストだけ設定を変える形 (Vitest docs「Configuring Vitest」、5.0.1): https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/index.md
- inline の project だけが root を継承すること (Vitest docs「Test Projects」、5.0.1): https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/projects.md
- `tanstackStart()` が test 環境にも `optimizeDeps` を注入して hooks が壊れるという報告と、報告者による修正の commit の無い close (2026-10-11): https://github.com/TanStack/router/issues/6246
- plugin を変えずに、`tanstackStart()` を入れた Vitest のテストを足す PR (2026-10-30 時点で open): https://github.com/TanStack/router/pull/6074
- preload されない `lazyRouteComponent` が初回の mount で suspend すると、React が use() の警告を出す不具合 (2026-10-30 時点で open): https://github.com/TanStack/router/issues/8487
- その修正 (2026-10-30 時点で open): https://github.com/TanStack/router/pull/8549
