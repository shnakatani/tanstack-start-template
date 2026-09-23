# ADR-0010: testing-library のルールは story と story helper にだけ当てる

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0009 (lint ルールの選定基準)、ADR-0032 (`jsPlugins` で足すもう 1 つのプラグイン)

## Context

story は `storybook/test` 経由で testing-library の API をそのまま使う。oxlint は testing-library をネイティブに持たないため、`jsPlugins` で ESLint plugin として載せる。

## Decision

| プラグイン        | 基準                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testing-library` | eslint-plugin-testing-library の `flat/react`。適用は story 本体と story 専用の helper に限る (対象は `companion-files.ts` の `storyGlobs` が唯一の定義) |

`testing-library` は oxlint ネイティブではなく `jsPlugins` で載せるが、基準は上流の `flat/react` を写す。`@shadcn/lint` と違い上流に recommended があるためである。

適用を story に限るのは、緩和ではなく適用範囲の確定である。対象は `*.stories.{ts,tsx}` と `*.story-helpers.{ts,tsx}` の両方で、play を helper へ切り出したときにルールが外れないようにする。種別も拡張子も字面で並べ直さず `companion-files.ts` の `storyGlobs` から引く。`.storybook/main.ts` が ts / tsx の両方を story として扱うので、片方だけに絞るとルールが無言で外れる。`*.test.tsx` は `vitest-browser-react` の locator API を使い、`screen.container` や `getByText(...).query()` が testing-library の同名 API と意味が違う。当てると誤検出が出る。支配的なのは `render-result-naming-convention` で、`vitest-browser-react` は render の結果を `screen` と名付けて locator を返すが、testing-library はその名前も戻り値も別物として扱う。件数は `vite.config.ts` の `files` を `*.test.tsx` へ広げて `vp lint` を走らせれば出る。story 側は `storybook/test` が testing-library をそのまま re-export しており、Aggressive Reporting が module の判定を解決する。

基準からの逸脱は下表のとおりで、外すものと severity を上げるものがある。

| ルール                  | 外す理由                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prefer-screen-queries` | play が受け取る `canvas` を render 結果の分割代入と誤読する。`canvas` は Storybook が渡す query 済みオブジェクトで、上流の `write-story` skill が「✅ Correct: Use canvas directly」と指定している形                                                                                                                                                                           |
| `no-node-access`        | `flat/react` の中でこれだけが strict 判定 (`isTestingLibraryImported(true)`) で Aggressive Reporting を迂回し、`storybook/test` 経由の story では一度も発火しない。`settings` の `testing-library/utils-module` を足せば発火するが、その形は `.claude/rules/testing.md`「状態のアサートは semantic matcher を先に探す」が `querySelector` を条件付きで許しているのと両立しない |

`no-debugging-utils` は upstream が `warn` だが `error` へ上げる。`vp check` は warn で exit 1 にならないため、`warn` のままだと commit された `screen.debug()` が素通りする。
`no-node-access` を有効のまま残すと、設定上は error でも無検査になる。

このプラグインは ESLint 本体を依存へ持ち込む。`packageExtensions` で peer を optional にしても外さない。`@typescript-eslint/utils` のルート import が `eslint` を実行時に読むため、外せたとしてもプラグインが落ちるからである (2026-09-20 に 3 通り試して実測)。機序 (`eslint` を必須 peer に持つ依存が連鎖すること) は `pnpm-workspace.yaml` のコメントが持つ。oxlint の jsPlugins が読み込む中でだけ動き、出荷物には入らない。撤去条件は typescript-eslint#11939 (`utils` から `eslint` の import を外し `/ts-eslint` を型専用にする) が入ることで、oxc-project/oxc#17734 が oxlint 側の追跡先である。

## Consequences

- `eslint-plugin-testing-library` の追加で dev 依存が増え、`eslint` が展開される。増分は `git diff pnpm-lock.yaml` の `packages:` の差で数える。外すと `Failed to load JS plugin: eslint-plugin-testing-library / Cannot find module 'eslint'` で config のパースごと落ちるため fail-closed である

## 出典

- oxlint の JS plugins (alpha 扱いと `{ name, specifier }` の指定形): https://oxc.rs/docs/guide/usage/linter/js-plugins.html
