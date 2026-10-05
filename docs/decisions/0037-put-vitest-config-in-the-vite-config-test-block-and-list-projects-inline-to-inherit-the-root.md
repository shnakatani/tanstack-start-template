# ADR-0037: Vitest の設定は vite.config.ts の test に置き、project は inline に並べて root の設定を継承させる

- Status: Accepted
- Date: 2026-09-30
- 関連: ADR-0004 (ツールチェーンを Vite+ に寄せる)

## Context

Vitest の設定は、`vitest.config.ts` に分けても `vite.config.ts` の `test` に置いても動く。2 つには次の違いがある。

- Vite+ は `vite.config.ts` の `test` に置くよう勧め、`vitest.config.ts` を推奨しない (Vite+ docs「Test」: "We do not recommend using `vitest.config.ts` with Vite+.")
- `vitest.config.ts` があると Vitest はそちらを優先し、`vite.config.ts` の設定を無視する (Vitest docs「Configuring Vitest」: "all options in your `vite.config` will be **ignored**")。`envDir: false` (ADR-0004) のような共有の設定は、config ごとに写すことになる

テストでは `tanstackStart()` を外す必要がある。test 環境にも `optimizeDeps` を注入して React を事前バンドルさせ、React が二重に読み込まれうるためで、hooks が壊れる (不具合の報告は TanStack/router#6246、仕組みの説明は修正の TanStack/router#6074 の本文。どちらも 2026-09-30 時点で open)。テスト用の config を分ければ plugin を別に持てるが、`vite.config.ts` の中でテストのときだけ設定を変える形も Vitest が示している (Vitest docs「Configuring Vitest」: "Use `process.env.VITEST` or `mode` property on `defineConfig` … to conditionally apply different configuration in `vite.config.ts`.")。

## Decision

**Vitest の設定は `vite.config.ts` の `test` に置き、中身は `tooling/test/` から import して組み立てる。project はどれも inline に並べて root の設定を継承させ、テストで外す plugin は `vite.config.ts` の `plugins` の `process.env.VITEST` の分岐で外す。**

- 組み立て方は Vite+ が示す形に従う (Vite+ docs「Monorepo」 の「Composing Configuration Files」)
- Vitest 5 では、inline の project だけが root の設定を継承する (Vitest docs「Test Projects」: "Projects referenced as config files or directories do not inherit any options from the root config.")。関数で渡した project も inline として扱われる。docs に関数の例は無く、`DEBUG=vitest:projects vp test list --filesOnly` の出力で確かめた (2026-09-30、vitest 5.0.1)
- 置き場所、project の足し方、分岐の書き方は `docs/guides/testing/configuration.md`、切り出したファイルの組み込み方と重い依存を遅らせる理由は `docs/guides/vite-configuration.md` にある

| 案                                                                                                              | 評価                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 採否     |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `vite.config.ts` の `test` に置き、`tooling/test/` の project を inline に並べる                                | Vite+ の推奨に沿う。共有の設定を root の 1 箇所に持ち、project が継承する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **採用** |
| `vitest.config.ts` を分けて持つ                                                                                 | Vite+ が推奨しない。`vite.config.ts` が無視されるので、共有の設定を写し続ける。`tanstackStart()` を外す目的は `vite.config.ts` の中の分岐で足りる                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 却下     |
| `vitest.config.ts` を分け、`mergeConfig` で `vite.config.ts` を引き継ぐ                                         | 写しは消えるが、Vite+ が推奨しない `vitest.config.ts` を置くことに変わりはない。`tanstackStart()` も一緒に引き継ぐので、外すには結局 `vite.config.ts` の側で分岐が要る                                                                                                                                                                                                                                                                                                                                                                                                                                            | 却下     |
| project を `test.projects` にファイルのパスで並べる                                                             | Vitest の書き方の 1 つだが、ファイルで参照した project は root を継承しない。共有の設定ファイルを `mergeConfig` で合わせる手もあるが、全 project が共有する設定まで project ごとに merge を書き、root とは別の共有ファイルを持つことになる。ブラウザで走る project だけが共有する設定を merge で重ねる形とは別の話 (`docs/guides/testing/configuration.md`「project を inline に並べる理由」)                                                                                                                                                                                                                     | 却下     |
| `test` の中身を `vite.config.ts` に直接書く                                                                     | `vite.config.ts` が長くなる。import で組み立てても Vite+ の推奨からは外れない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 却下     |
| `tanstackStart()` をテストでも残し、plugin の中で `optimizeDeps` の注入だけを止める (TanStack/router#6074 の形) | テストでも `createIsomorphicFn` などの Start の変換が効く。ただし TanStack/router#6074 は未マージで、いま採るには `@tanstack/react-start` に patch を当てることになる。テストに Start の 26 個の plugin (routeTree の生成、route の code splitting、import-protection など) が入り、browser mode と story の project で通るかは確かめていない。story の project は、`tanstackStart()` を載せずに Storybook の TanStack 専用の framework で Start を扱う前提 (storybookjs/storybook#33747) なので、別に外す仕組みが要る。事前バンドルする依存を手で足す手当ては残る (2026-09-30、`@tanstack/react-start` 1.168.58) | 却下     |

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
- `tanstackStart()` が test 環境にも `optimizeDeps` を注入する不具合: https://github.com/TanStack/router/issues/6246
- その修正と、React が二重に読み込まれる仕組みの説明: https://github.com/TanStack/router/pull/6074
