# ADR-0008: テスト専用コードの import は `no-restricted-imports` で止める

- Status: Accepted
- Date: 2026-09-20
- Revised: 2026-09-30 (止める対象に story と story 専用の helper を含め、`.storybook/**` を範囲の外に置く理由を書いた)
- 関連: ADR-0007 (lint ルールの選定基準と「基準から外れる名指し」)。テストファイルの緩和は `docs/guides/lint/configuration.md`「テストファイルの緩和」

## Context

テスト専用のコード (`*.test-helpers.*`、`src/test/`) は、アプリのコードと同じツリーに置く。
story (`*.stories.*`) と story 専用の helper (`*.story-helpers.*`) も同じツリーに置き、Storybook だけが読む。
この ADR の「テスト専用コード」は、テストと story だけが使うこれらのコードを指す。
アプリのコードが誤って import しても、helper が型しか引かなければ build は通り、fixture がそのまま client と server の bundle に入る (2026-09-14 に `vp build` で確認)。
レビューで見るしかなかった境界を lint で止める。

## Decision

eslint コアの `no-restricted-imports` を、範囲を絞って当てる。

| 手段                                                       | 判定                                                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| eslint-plugin-import の `import/no-restricted-paths`       | この用途の専用ルール (zones) だが oxlint に無い (oxc-project/oxc#13789)                                             |
| dependency-cruiser の既定ルール `not-to-test`              | 同じ用途を既定で持つが、1 ルールのためにツールを増やす                                                              |
| TanStack Start の `importProtection` (`files`)             | パス単位で bundle から遮断できるが build 時にしか鳴らず、client / server の環境境界のための機構 (公式 guide の説明) |
| eslint コアの `no-restricted-imports` を範囲を絞って当てる | 採用。oxlint の保守者が同じ用途に示した形 (oxc-project/oxc#20881)                                                   |

`patterns` の `regex` で次の specifier を止める。

- `.test-helpers` か `.story-helpers` で終わるもの
- `.stories` で終わるもの
- alias (`@/test/`) または相対 (`./test/` `../test/`) で `test/` を指すもの

当てる範囲は `overrides` の `files` (`src/**` `scripts/**`) と `excludeFiles` (テスト、`*.test-helpers`、`*.story-helpers`、story、`src/test/`) で絞る。
`excludeFiles` の付随ファイルの種別は `scripts/lib/companion-files.ts` の `companionGlobs` から引く。
oxc-project/oxc#20881 が示す `files` の否定 glob (`!**/*.test.ts`) は oxlint 1.79.0 では除外として効かず (2026-09-14 に最小構成で実測)、`excludeFiles` が効く。
全体で error にしてテスト側で off にする形は取らない。off はテストの緩和経路に載り、`*.test-helpers` を緩和へ足すことになる (`docs/guides/lint/configuration.md`「テストファイルの緩和」の 5 ルールは helper に要らない)。

story と story 専用の helper の扱いは次のとおり。

| 対象                       | 扱い                          | 理由                                                                                                                                                                                                    |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| アプリのコードからの story | 止める                        | story を import すると、story が引く helper と fixture が bundle に入る。story 自身は出荷する bundle に入らない。アプリのどこからも import されず、`.storybook/main.ts` の `stories` の glob だけが拾う |
| story から helper          | 止めない (`excludeFiles`)     | 除外しないと、story が自分の story 専用の helper を import できなくなる                                                                                                                                 |
| `.storybook/**`            | 範囲の外 (`files` に入れない) | Storybook の設定で、アプリのコードではない。範囲に入れると、`.storybook/preview.tsx` がブラウザテストと同じ `src/test/browser/viewport-sizes.ts` から狭幅の寸法を引く import が止まる                   |

## Consequences

- 再評価条件: oxlint が `import/no-restricted-paths` を実装したら (oxc-project/oxc#13789 の close)、zones の形へ移す。
