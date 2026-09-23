# ADR-0011: テスト専用コードの import は `no-restricted-imports` で止める

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0009 (lint ルールの選定基準と「基準から外れる名指し」、テストファイルの緩和)

## Context

テスト専用のコードの置き場所は `.claude/rules/directory-structure.md`「テストとスクリプトの配置」が持つ。
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

`patterns` の `regex` で `.test-helpers` 終わりの specifier と、alias (`@/test/`) または相対 (`./test/` `../test/`) で `test/` を指す specifier を止める。
当てる範囲は `overrides` の `files` (`src/**` `scripts/**`) と `excludeFiles` (テスト、`*.test-helpers`、`src/test/`) で絞る。
oxc-project/oxc#20881 が示す `files` の否定 glob (`!**/*.test.ts`) は oxlint 1.79.0 では除外として効かず (2026-09-14 に最小構成で実測)、`excludeFiles` が効く。
全体で error にしてテスト側で off にする形は取らない。off はテストの緩和経路に載り、`*.test-helpers` を緩和へ足すことになる (ADR-0009「テストファイルの緩和」の 5 ルールは helper に要らない)。

## Consequences

- 再評価条件: oxlint が `import/no-restricted-paths` を実装したら (oxc-project/oxc#13789 の close)、zones の形へ移す。
