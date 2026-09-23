# ADR-0059: 型検査は tsgolint が担い、`typescript` パッケージを直接の依存に持たない

- Status: Accepted
- Date: 2026-09-20
- 関連: ADR-0005 (ツールチェーンは mise と Vite+ に寄せる) / ADR-0009 (lint ルールの選定基準)

## Context

`vp check` の型検査は oxlint の type-aware パスが担い、その実体は tsgolint と TypeScript Go ツールチェーンである (Vite+ の `docs/guide/check.md`)。

## Decision

**`typescript` パッケージを直接の依存に置かない。型検査は `vp check` の type-aware lint (tsgolint) に任せる。**

`typescript` パッケージを直接の依存に置かなくても動く。2026-09-02 の実測では、`devDependencies` から外した状態で `vp check` が `TS2322` を報告した。

実体は Vite+ 一族の推移依存として入るため install からは消えない。
直接の依存に戻すのは、リポジトリのコードが `typescript` を `import` するようになったときだけとする。

### 検討した選択肢

| 案                                    | 評価                                                                                                                          | 採否     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 直接の依存に置かず、tsgolint に任せる | `vp check` が型検査まで持ち、リポジトリのコードは `typescript` を `import` しない                                             | **採用** |
| `typescript` を直接の依存に置く       | リポジトリのコードが使わないパッケージを宣言することになる。実体は推移依存として入るので、置かなくても install からは消えない | 却下     |

## Consequences

- 型検査を lint へ合流させる設定 (`options.typeCheck`) は `scripts/checks/integrity/lint-config.test.ts` が解決後設定の値で機械強制する。設定が真のまま tsgolint が黙って動かない場合は捕まえられない。
