# vite.config.ts の組み立て

`vite.config.ts` に集める設定の置き方と、長くなった block を別のファイルへ切り出す手順、重い依存を遅らせて読み込む手順、その形にした理由を持つ。block ごとの中身の書き方は、テストの設定を `docs/guides/testing/configuration.md`、lint の設定を `docs/guides/lint/configuration.md` が持つ。

| 決定                                                                                              | ADR      |
| ------------------------------------------------------------------------------------------------- | -------- |
| 開発環境のツールチェーンは mise と Vite+ に寄せる                                                 | ADR-0004 |
| Vitest の設定は vite.config.ts の test に置き、project は inline に並べて root の設定を継承させる | ADR-0037 |

## how-to

### 設定の置き場所

Vite+ が読む設定は、ツールごとの設定ファイルに分けず `vite.config.ts` に集める (「1 つの `vite.config.ts` に集める理由」)。block を切り出すときは `tooling/<block>/` に置き、`vite.config.ts` はそれを import して組み立てる (「別のファイルから組み立てる理由」)。

| block                                           | 置き場所                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `test`                                          | `tooling/test/config.ts` の `testConfig`。project の組み方は `docs/guides/testing/configuration.md`        |
| `lint`                                          | `tooling/lint/config.ts` の `lintConfig`。ルールとプラグインの足し方は `docs/guides/lint/configuration.md` |
| `fmt`、`staged`、`resolve`、`envDir`、`plugins` | `vite.config.ts`                                                                                           |

### block を別のファイルへ切り出す

1. `tooling/<block>/` にモジュールを作り、block の中身をオブジェクトで export する。型は `satisfies` で付ける。`test` は `vite-plus/test/config` の `TestUserConfig`、`lint` は `vite-plus/lint` の `OxlintConfig` を使う。override の一部だけを切り出すなら `Omit<OxlintOverride, 'files'>` にし、`files` は override を組み立てる側 (`tooling/lint/config.ts` の `overrides`) に残す (`OxlintOverride` の `files` は省けない)
2. block 全体は `vite.config.ts` で import して渡す (`test: testConfig`、`lint: lintConfig`)。override の一部を切り出したときは、override を組み立てる側 (`tooling/lint/config.ts`) で import し、`overrides` の要素へ spread で組み込む ([Vite+ docs「Monorepo」][] の「Composing Configuration Files」の例)
3. 設定の中の文字列のパスは、切り出したモジュールの位置から書かない。Vitest の `include`、`globalSetup`、`setupFiles` は root から解決され ([Vitest docs「include」][]、[Vitest docs「globalSetup」][]、[Vitest docs「setupFiles」][])、Oxlint の `jsPlugins` の specifier、`overrides` の `files` / `excludeFiles`、`ignorePatterns` は、`vite.config.ts` (Oxlint から見た config ファイル) のあるディレクトリから解決される ([Oxlint docs「JS Plugins」][]、[oxlint 1.85.0 の configuration_schema.json][] の `GlobSet` と `ignorePatterns` の説明。2026-10-01 に確認)
4. 切り出したモジュールに、読み込むだけで起きる副作用 (警告の出力、環境変数の書き換え) を持たせない (「読み込むだけで起きる副作用を持たせない理由」)。条件つきの警告は、その block を使う経路でだけ呼ばれる関数の中で出す。`tooling/test/config.ts` の `storybookProjects` が返す project の関数が、Storybook 経由の縮退を知らせる警告をこの形で出す
5. `vp check` と、その block を使うコマンド (`vp test list --filesOnly`、`vp lint --print-config`) の出力が切り出す前と変わらないことを確かめる。`vp lint --print-config` の `jsPlugins` の並びは、内容が同じでもチェックアウトした場所で変わる (2026-10-01 に oxlint 1.85.0 で観測)。`vp lint --print-config | jq '.jsPlugins |= sort_by(.name)'` の出力どうしを比べる

### 重い依存を遅らせて読み込む

| 依存の種類                                                             | 遅らせ方                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins` に並べる plugin                                              | `lazyPlugins` に渡す関数の中で呼ぶ ([Vite+ docs「Troubleshooting」][])。足した plugin は、「重い依存を遅らせる理由」の plugin の計測と同じく `vp lint` と `vp fmt --check` を 11 回ずつ走らせ、先頭で import した形と関数の中で `import()` した形を比べる。両方のコマンドで、初回を除いた `real` の範囲が重ならずに縮むものだけを、関数の中で `import()` する |
| `plugins` 以外で使う依存 (Vitest の project が使う provider や plugin) | その依存を使う設定を関数にし、関数の中で外部のパッケージを `import()` する。project の例は `tooling/test/browser-project.ts`                                                                                                                                                                                                                                  |

`import()` するのは外部のパッケージそのものにする。`tooling/` のモジュールを `import()` しても遅れない (「重い依存を遅らせる理由」)。

`lazyPlugins` に渡す関数を async にすると、plugin は全部まとめて 1 つの Promise に包まれて Vite へ渡る ([voidzero-dev/vite-plus#1215][]: "Async callbacks have their Promise wrapped in an array internally for Vite's `asyncFlatten`"。vite-plus 1.0.0 の `lazyPlugins` で 2026-09-30 に確認)。Promise の中を見ずに plugin を絞る側は、絞りそこねる。`@storybook/tanstack-react` 10.6.0 がそうで、TanStack Start の plugin が残って `storybook build` が `[plugin tanstack-start:start-manifest-capture-client-build] Error: multiple entries detected` で落ちる (2026-09-30 に観測) のを、`pnpm-workspace.yaml` の `patchedDependencies` の patch で補っている。patch が外れるか当たらなくなってこの失敗が戻ると、`mise run verify` と CI の `vp exec storybook build` が落ちる。

## explanation

### 1 つの `vite.config.ts` に集める理由

- Vite+ は設定を `vite.config.ts` の 1 か所に集める形を取る ([Vite+ docs「Configuring Vite+」][]: "Vite+ keeps project configuration in one place: `vite.config.ts`")
- ツールごとの設定ファイル (`vitest.config.ts`、`oxlint.config.ts`、`.oxlintrc.json`) は、Vite+ がどれも推奨しない ([Vite+ docs「Test」][]: "We do not recommend using `vitest.config.ts` with Vite+."、[Vite+ docs「Lint」][]: "We do not recommend using `oxlint.config.ts` or `.oxlintrc.json` with Vite+.")
- 併用したときにどちらが効くかは、ツールごとに違う。Vitest は `vitest.config.ts` を優先して `vite.config.ts` を無視し (`docs/guides/testing/configuration.md`「`vitest.config.ts` を置かない理由」)、`vp lint` はサブディレクトリの `.oxlintrc.json` を読まない (`docs/guides/lint/configuration.md`「設定の落とし穴」)

### 別のファイルから組み立てる理由

- Vite+ は、長い設定を別のファイルから import して組み立てる形を示している ([Vite+ docs「Monorepo」][]: "You can split configuration across your repository and compose them using JavaScript imports.")
- メンテナも、共有する設定を定数へ切り出し object spread で組み立てる形を勧めている ([voidzero-dev/vite-plus#1769][]: "we recommend extracting shared config into constants and composing `overrides` with object spread")
- ツールごとの設定ファイル (`vitest.config.ts`、`oxlint.config.ts`、`.oxlintrc.json`) へ分ける形と違い、ツールが読む入口は `vite.config.ts` のまま変わらない。どの block がどこにあるかは、`vite.config.ts` の import を辿れば分かる

### 読み込むだけで起きる副作用を持たせない理由

`vite.config.ts` は、Vite を動かすコマンドだけでなく、`lint` や `fmt` の block を読むだけのコマンドとエディタ連携のたびに読まれる。読み込み時の副作用は、その block を使わない経路でも毎回起きる ([Vite+ docs「Troubleshooting」][]: "This can make config loading slow and may trigger plugin setup side effects, such as reading files, starting watchers, or connecting to services.")。警告なら、lint を打つたびに関係の無い警告が出る。

### 重い依存を遅らせる理由

`vite.config.ts` は、Vite を動かすコマンドだけでなく、`lint` や `fmt` の block を読むだけのコマンドとエディタ連携も読む。先頭で import した依存は、そのたびに評価される ([Vite+ docs「Troubleshooting」][]: "When `vite.config.ts` imports plugins at the top level, they are evaluated for every command, including `vp lint`, `vp fmt`, editor integrations, and long-lived background processes.")。

ローカルのモジュールを `import()` しても遅れない。Vite は config を 1 つのファイルへ bundle する (`@voidzero-dev/vite-plus-core` 1.0.0 の `bundleConfigFile` は `codeSplitting: false`。2026-09-30 に確認)。そのため、`import()` したモジュールが import する外部の依存も、読み込み時に評価される。

2026-09-30 に、テストの設定を切り出したときの形ごとに `/usr/bin/time -p vp lint src/lib/app-name.ts` を 4 回、`/usr/bin/time -p vp fmt --check src/lib/app-name.ts` を 3 回走らせ、初回を除いた `real` の範囲 (vite-plus 1.0.0、Node 24.21.0):

| 形                                                | `vp lint`  | `vp fmt --check` |
| ------------------------------------------------- | ---------- | ---------------- |
| `vite.config.ts` がテストの設定を import しない形 | 0.80-0.82s | 0.43-0.44s       |
| `tooling/test/` のモジュールを `import()`         | 0.99-1.01s | 0.60s            |
| project の関数の中で外部の依存を `import()`       | 0.81-0.82s | 0.43-0.44s       |

2026-09-30 に、`plugins` の plugin を読み込む形ごとに `/usr/bin/time -p vp lint src/lib/app-name.ts` と `/usr/bin/time -p vp fmt --check src/lib/app-name.ts` を 11 回ずつ走らせ、初回を除いた `real` の範囲 (vite-plus 1.0.0、Node 24.21.0、`@tanstack/react-start` 1.168.58、`nitro` 3.0.260610-beta、`@tanstack/devtools-vite` 0.8.5、`@tailwindcss/vite` 4.3.3、`@vitejs/plugin-react` 6.1.1)。「全部の plugin を先頭で import」は、テストの設定の計測の「project の関数の中で外部の依存を `import()`」と同じ形である。`@vitejs/plugin-react` は遅らせても範囲が重なったので、先頭で import する:

| 形                                                                                    | `vp lint`  | `vp fmt --check` |
| ------------------------------------------------------------------------------------- | ---------- | ---------------- |
| 全部の plugin を先頭で import                                                         | 0.80-0.87s | 0.43-0.44s       |
| `tanstackStart`・`nitro`・`devtools` を関数の中で `import()`                          | 0.61-0.63s | 0.23-0.24s       |
| さらに `tailwindcss` を `import()` (`vite.config.ts` と `chromiumProjectBase` の両方) | 0.58-0.60s | 0.21s            |
| さらに `@vitejs/plugin-react` を `import()`                                           | 0.58-0.61s | 0.20-0.21s       |

## 出典

本文の出典の名前がリンクになっている。名前と URL の対応は、この節のソースにあるリンクの定義が持つ。Vite+ は 1.0.0、Vitest は 5.0.1 に固定した版を指す。

[Vite+ docs「Configuring Vite+」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/config/index.md
[Vite+ docs「Test」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/test.md
[Vite+ docs「Lint」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/lint.md
[Vite+ docs「Monorepo」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/monorepo.md
[Vite+ docs「Troubleshooting」]: https://github.com/voidzero-dev/vite-plus/blob/v1.0.0/docs/guide/troubleshooting.md
[Vitest docs「include」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/include.md
[Vitest docs「globalSetup」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/globalsetup.md
[Vitest docs「setupFiles」]: https://github.com/vitest-dev/vitest/blob/v5.0.1/docs/config/setupfiles.md
[Oxlint docs「JS Plugins」]: https://oxc.rs/docs/guide/usage/linter/js-plugins.html
[oxlint 1.85.0 の configuration_schema.json]: https://github.com/oxc-project/oxc/blob/oxlint_v1.85.0/npm/oxlint/configuration_schema.json
[voidzero-dev/vite-plus#1215]: https://github.com/voidzero-dev/vite-plus/pull/1215
[voidzero-dev/vite-plus#1769]: https://github.com/voidzero-dev/vite-plus/issues/1769
