# テストの設定

Vitest の設定の置き場所と、project の足し方・テストでだけ plugin を変える手順、その形にした理由を持つ。`vite.config.ts` へ切り出したファイルを組み込む形と、重い依存を遅らせて読み込む手順は `docs/guides/vite-configuration.md` が持つ。検査スクリプトの project の足し方は `docs/guides/testing/check-scripts.md` が持つ。

| 決定                                              | ADR      |
| ------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる | ADR-0004 |

## how-to

### 設定の置き場所

| 置くもの                                                | 置き場所                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `test` の中身 (project の一覧、`globalSetup`、coverage) | `tooling/test/config.ts` の `testConfig`。`vite.config.ts` の `test` がこれを読む |
| ブラウザテストの project                                | `tooling/test/browser-project.ts`                                                 |
| story の project                                        | `tooling/test/storybook-project.ts`                                               |
| project が共有する設定 (`envDir`、`resolve`)            | `vite.config.ts` のトップレベル。project はこれを継承する                         |
| テストでだけ外す plugin                                 | `vite.config.ts` の `plugins` の分岐 (「テストでだけ plugin を変える」)           |

`vitest.config.ts` は作らない (ADR-0004。仕組みは「`vitest.config.ts` を置かない理由」)。

### project を足す

1. `tooling/test/config.ts` の `projects` に inline で足す。ファイルのパスで並べない (「project を inline に並べる理由」)
2. `test.name` を付ける。名前が重なると Vitest がエラーで止まる ([Vitest docs「Test Projects」][]: "All projects must have unique names; otherwise, Vitest will throw an error.")
3. root の `plugins` にある plugin を project に書き直さない。inline の project は root の plugin を継承する ([Vitest docs「sharedViteServer」][]: "If every project repeats the same `plugins` entry, move it to the declaring config.")。project にだけ要る plugin は、その project の `plugins` に足す
4. playwright の provider や `@storybook/addon-vitest` の plugin のような重い依存を使う project は、project を返す関数にし、依存を関数の中で `import()` する。`browserProject` と `storybookProject` がこの形 (`docs/guides/vite-configuration.md`「重い依存を遅らせて読み込む」)
5. `vp test list --filesOnly` で、足した project に集まるファイルを見る。`include` に一致しないテストは、落ちることもなく 1 度も走らない

### テストでだけ plugin を変える

- root の plugin をテストで外すときは、`vite.config.ts` の `plugins` の `process.env.VITEST === "true"` の分岐から外す。config を分けない (「判定を `process.env.VITEST` で書く理由」)
- テストの分岐は `viteReact()` だけを返す。外す plugin ごとの理由は「テストの分岐で plugin を外す理由」
- `tailwindcss()` はテストの分岐に入れない。ブラウザと story の project が自分の `plugins` に足す。Node の project には要らない

### 設定の落とし穴

| 対象                                            | 起きること                                                                                                                 | 対処                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `vitest.config.ts` を足す                       | Vitest がそちらを優先し、`vite.config.ts` の設定を丸ごと黙って無視する (`test`、`envDir`、テストの分岐の plugin を含む)    | 足さない。中身は `tooling/test/` に書く |
| Vitest の `createVitest()` を直接呼んで起動する | config を読む時点で `process.env.VITEST` が立たず、テストに `tanstackStart()` などが入る (2026-09-30、vitest 5.0.1 で確認) | `VITEST=true` を渡して起動する          |

## explanation

### `vitest.config.ts` を置かない理由

決定は ADR-0004 が持つ。この節は、その形で組む前提になる Vite+ と Vitest の仕組みを持つ。

- Vite+ は Vitest の設定を `vite.config.ts` の `test` に置くよう勧める ([Vite+ docs「Test」][]: "We do not recommend using `vitest.config.ts` with Vite+.")
- `vitest.config.ts` があると、Vitest はそちらを優先して `vite.config.ts` の設定を無視する ([Vitest docs「Configuring Vitest」][]: "all options in your `vite.config` will be **ignored**")。`envDir` のような共有の設定を 2 つの config に写し続けることになる
- 中身は `tooling/test/` に切り出し、`vite.config.ts` には `test: testConfig` の 1 行だけを置く。切り出す形の理由は `docs/guides/vite-configuration.md`「別のファイルから組み立てる理由」

### project を inline に並べる理由

決定は ADR-0004 が持つ。この節は、継承の仕組みと、関数で渡す project の扱いを持つ。

- Vitest 5 では、inline の project だけが root の設定を継承する ([Vitest docs「Test Projects」][]: "Projects referenced as config files or directories do not inherit any options from the root config.")
- ファイルで参照する project でも、共有の設定ファイルを作って `mergeConfig` で合わせれば写さずに済む (同じページの "You can create a shared config file and merge it with the project config yourself")。ただし project ごとに merge を書き、root とは別の共有ファイルを持つことになる。inline なら何も書かずに root を継承する
- 関数で渡した project も inline の project として扱われる。docs に関数の例は無いが、`DEBUG=vitest:projects vp test list --filesOnly` が `inline project "browser" resolves its own Vite config` と出す (2026-09-30、vitest 5.0.1)。自前の Vite config を作りつつ、root の config ファイルを extends する

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
| `tailwindcss()`         | 外す                        | Node の project には要らない。ブラウザと story の project が自分の `plugins` に足す                                                                                                                                                     |
| `viteReact()`           | 残す。`compiler` は渡さない | テストは React Compiler を通らない。アプリの分岐とは別に置いた `viteReact()` なので、`compiler` を付けてもアプリの最適化には関係しない。付けるときは、テストで Compiler を通すかを先に決める                                            |

`tanstackStart()` を外している間は、`createIsomorphicFn` などの Start の変換がテストで効かない ([TanStack/router#6246][] のコメント)。[TanStack/router#6246][] が直ったら、テストの分岐に `tanstackStart()` を戻すかを決め直す。

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vite+ は 1.0.0、Vitest は 5.0.1 に固定した版を指す。

[Vite+ docs「Test」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/test.md
[Vitest docs「Configuring Vitest」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/index.md
[Vitest docs「Test Projects」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/guide/projects.md
[Vitest docs「sharedViteServer」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/sharedviteserver.md
[TanStack/router#6246]: https://github.com/TanStack/router/issues/6246
[TanStack/router#6074]: https://github.com/TanStack/router/pull/6074
