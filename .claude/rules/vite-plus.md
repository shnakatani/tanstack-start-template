---
paths:
  - "vite.config.*"
  - "package.json"
  - ".mise.toml"
  - ".github/workflows/**"
  - "tooling/**"
  - "pnpm-workspace.yaml"
  - "patches/**"
---

# Vite+ ツールチェーン設定

## staged 設定 (pre-commit hook)

- `--no-error-on-unmatched-pattern` を外さない。staged が `ignorePatterns` の生成ファイルだけのコミットで、対象ゼロが error になり commit が止まる (`docs/guides/dependencies-and-toolchain.md`「commit hook を扱う」)
- `vp staged` は `.vite-hooks/pre-commit` から呼び、hook は `package.json` の `prepare` の `vp config` が入れる。自前の skip スクリプトを間に挟まない (`docs/guides/dependencies-and-toolchain.md`「commit hook を扱う」)
- hook は止める範囲で手段を選ぶ。環境ごと (CI のビルドコンテナ等) なら `VP_GIT_HOOKS=0`、環境を受け継がないプロセス (デーモン等) ならマシンの init script で `VP_GIT_HOOKS=0`、1 つの clone なら `vp hooks disable` で止める (`docs/guides/dependencies-and-toolchain.md`「commit hook を扱う」)

## script とタスク

- マージ前検証を `vp run` のタスクへまとめない。Vite Task は親の環境変数を素通しせず、結果をキャッシュして gate がリプレイされる (ADR-0004)
- built-in と同名の script は、`start` と対の入口 (`pnpm run build` → `pnpm start`) の `build` だけを置き、開発者の入口 (`check` / `test` / `dev`) は足さない。開発者は global の `vp` を入れるので公式が script を勧める利点が当てはまらず、同名の script があると `vp <name>` のたびに stderr に note が出る (ADR-0004)
- ビルド成果物を起動する検査は `vp build` の後に置く。CI も同じ順序で workflow に並べる (`docs/guides/testing/check-scripts.md`「検査スクリプトを足す」)

## 型検査

- `typescript` を直接の依存に置かない。型検査は `vp check` の type-aware lint (tsgolint) が担い、`typescript` は推移依存として入る。直接の依存へ戻すのは、リポジトリのコードが `typescript` を import するときだけ (`docs/guides/dependencies-and-toolchain.md`「`typescript` を直接の依存に置かない理由」)

## Vitest の設定 (`vite.config.ts` の `test`)

- Vitest の設定は `tooling/test/` に書き、`vite.config.ts` の `test` から読ませる。全 project が共有する設定を root の 1 か所に持ち、project が継承する (ADR-0037)
- project は `test.projects` に inline で並べる。ファイルのパスで並べた project は `vite.config.ts` の設定 (`envDir`、`resolve`、テスト時の `plugins`) を継承しない (`docs/guides/testing/configuration.md`「project を inline に並べる理由」)
- `maxWorkers` は `tooling/test/config.ts` の `testConfig` にだけ書き、project には書かない (`docs/guides/testing/configuration.md`「ブラウザで走る project の並列数を決める」)
- `maxWorkers` は割合で書き、`1 / ブラウザで走る project の数` に合わせる。vitest 5.0.x はブラウザで走る project ごとに `maxWorkers` 枚のページを開くので、合わせないとページがコア数から外れ、多くなる側に外れると全体の実行で locator の操作が timeout で落ちる (`docs/guides/testing/configuration.md`「ブラウザで走る project の並列数を決める」)
- `maxWorkers` を外すのは、ページの合計を `maxWorkers` に収める版 (vitest-dev/vitest#11525 を含む版) へ上げたときだけにする (`docs/guides/testing/configuration.md`「ブラウザで走る project の並列数を決める」)
- テストでだけ root の plugin を外すときは、`vite.config.ts` の `plugins` の `process.env.VITEST` の分岐で外す。config を分けない (`docs/guides/testing/configuration.md`「判定を `process.env.VITEST` で書く理由」)

## `vite.config.ts` の組み立て

- block を切り出すときは `tooling/<block>/` に置き、`vite.config.ts` から import して組み立てる (`docs/guides/vite-configuration.md`「別のファイルから組み立てる理由」)
- ツールごとの設定ファイル (`vitest.config.ts`、`oxlint.config.ts`、`.oxlintrc.json`) に分けない。併用するとどちらが効くかがツールごとに違い、`vitest.config.ts` があると `vite.config.ts` が丸ごと黙って無視される (`docs/guides/vite-configuration.md`「1 つの `vite.config.ts` に集める理由」)
- `vite.config.ts` が import するモジュールに、読み込むだけで起きる副作用 (警告の出力、環境変数の書き換え) を持たせない。`vite.config.ts` は `vp lint` / `vp fmt` / `vp build` のたびに読まれる (`docs/guides/vite-configuration.md`「読み込むだけで起きる副作用を持たせない理由」)
- `lazyPlugins` には同期の関数を渡し、plugin は先頭で import する。async にすると `@storybook/tanstack-react` が TanStack Start の plugin を外せず `storybook build` が落ち、`mise run verify` はそれを捕まえない (`docs/guides/vite-configuration.md`「plugin を先頭で import する理由」)
- project が使う重い依存 (playwright の provider、`@storybook/addon-vitest` の plugin) は、project を作る関数の中で動的 import する。先頭で import すると `vp lint` / `vp fmt` のたびに評価される (`docs/guides/vite-configuration.md`「重い依存を遅らせる理由」)
- root の `plugins` と同じパッケージ (`chromiumProjectBase` の `tailwindcss`) は、project でも先頭で import する。root が先頭で import している間は、遅らせても同じ module が読まれる (`docs/guides/vite-configuration.md`「plugin を先頭で import する理由」)
- 動的 import で遅らせるのは外部のパッケージそのものにする。`tooling/` のモジュールを動的 import しても、Vite が config を 1 ファイルへ bundle するので遅れない (`docs/guides/vite-configuration.md`「重い依存を遅らせる理由」)

## React Compiler (`vite.config.ts` の `plugins`、`tooling/plugins/react.ts`)

- アプリの分岐の `reactPlugin` の `compiler: true` を外さない。外しても全部通り、最適化だけが無言で落ちる (ADR-0014)
- アプリの分岐の `reportDiagnostics: true` を外さない。外すと、Compiler が諦めた箇所がビルドログに出なくなる (ADR-0014)
- React の plugin は `tooling/plugins/react.ts` の `reactPlugin` から作り、テストの分岐と project で別の `viteReact()` を書かない。`viteReact` のほかの option がアプリとテストで食い違っても、テストは全部通る (`docs/guides/testing/configuration.md`「テストでだけ plugin を変える」)
- テストの分岐は React の plugin を返さず、ブラウザで走る project が `chromiumProjectBase` から足す。root に置くと、継承した plugin を Compiler を通さない project で外せない (`docs/guides/testing/configuration.md`「テストでだけ plugin を変える」)
- Compiler を通さない project には `src/components/ui/` のテストと story だけを集める (`docs/guides/testing/configuration.md`「React Compiler を通さない project を足す」)
- `browser-no-compiler` の project を外さない。Compiler は上流の部品が描画中に部品を定義する欠陥を隠すので、`calendar.test.tsx` の再描画のガードは Compiler を通さない project でしか落ちない (`docs/guides/testing/configuration.md`「テストでも React Compiler を通す理由」)
- bail out のログは `vp build` では `[plugin vite:react-compiler]` だけで `error` / `warn` を含まない。ビルドログは `react-compiler` で grep する (`docs/guides/react/memoization.md`「React Compiler の診断を読む」)
- babel を経路に置かない。壊れたときも版を下げて凌ぐ (ADR-0014)

## 依存の patch (`pnpm-workspace.yaml` の `patchedDependencies`)

- patch のコメントには、理由と撤去条件と、効いていることの確かめ方を書く。`mise run verify` が捕まえない patch は、確かめ方が無いと壊れても気づけない (`docs/guides/dependencies-and-toolchain.md`「patch を当てる」)
- キーはパッケージ名だけ (`"<pkg>"`) にする。版や範囲を付けたキーは外れた版で使われず、Dependabot の lockfile の更新が落ちて、その依存だけが同じグループの PR から黙って外れる (`docs/guides/dependencies-and-toolchain.md`「patch のキーをパッケージ名だけにする理由」)
