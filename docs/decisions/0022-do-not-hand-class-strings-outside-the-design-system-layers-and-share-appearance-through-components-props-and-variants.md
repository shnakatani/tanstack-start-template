# ADR-0022: design system の層から外へ class 文字列を配らず、共有する外見は部品・prop・variant で配る

- Status: Accepted
- Date: 2026-09-24
- 関連: ADR-0011 (コンポーネントの層と適用範囲の表し方)、ADR-0023 (`@shadcn/lint` のルールの選定)、ADR-0016 (Action 層の責務)

## Context

消費側が design system component へ渡す `className` は、`@shadcn/lint` の `no-raw-colors` と `no-unknown-classes` が中身を読めて初めて色と未知 class の統制 (ADR-0023) に掛かる。
中身が読めるかは渡し方で決まり、他ファイルから import した `const` は読まれない (2026-09-19、`@shadcn/lint` 0.1.0 の実測。渡し方ごとの表は `docs/guides/lint.md`「`require-static-classes` が読む className」)。
`@shadcn/lint` の `resolveIdentifier` が `Variable` 型でない定義で解決を打ち切り、import 束縛はこの型を持たないためである。

`require-static-classes` を一時的に足して測った違反は、`src/routes/` の 2 件だけだった (2026-09-19)。
`src/components/screens/` と直下、`src/features/` は 0 件である。`ui/` `action/` `parts/` は `excludeFiles` の内側なので測っていない。
2 件はどちらも `src/components/` の層が export した class 定数を `src/routes/` が import し、design system component へ渡す形である。

`src/components/ui/dialog.tsx` も同種の class 定数を 2 つ export するが、消費側が `src/components/ui/alert-dialog.tsx` で層の内側に閉じているため規則に当たらない。
**当たるのは定数を共有するパターンではなく、共有が層の境界を越えることである。**

## Decision

**design system の層 (`ui/` / `action/` / `parts/`) から外へ class 文字列を配らない。外見を層の外と共有するときは、部品・prop・`cva` の variant のどれかで配る。この決定は `@shadcn/lint` の `require-static-classes` を層の境界 (`no-restyle` と同じ適用範囲) で有効にして守る。** 層の内側での共有は対象外とする。

配り方の選び方は `docs/guides/styling-and-tokens.md`「外見を層の外へ配る」、この決定を lint で守る設定 (`require-static-classes` の適用範囲と `variantFunctions` の宣言) は `docs/guides/lint.md`「`require-static-classes` を層の境界で有効にする」と「variant 関数を宣言する」にある。

### 検討した選択肢

| 案                                                               | 評価                                                                                               | 採否     |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| 層の外へ class 文字列を配ることを許し、規則を採用しない          | 層を越えて配られた class 文字列が色と未知 class の検査から外れ、外れていること自体が診断に現れない | 却下     |
| 規則を採用し、層の外へ配る箇所を行単位で抑制する                 | 恒久的な例外が残る。同じ配り方が増えるたびに抑制行が増え、規則が守る範囲が減る                     | 却下     |
| 層の外へは部品・prop・variant で配り、違反は設計の変更で解消する | 恒久的な例外がゼロになり、規則が読めない `className` は残らない                                    | **採用** |

## Consequences

- 消費側の `className` はすべて linter が読める形になり、`no-raw-colors` と `no-unknown-classes` の検査が届く範囲が確定する
- 恒久的な例外はゼロで、違反が増えても抑制行は増えない
- design system の層から外へ class 文字列を配る形が閉じる。層の内側での共有は残る

## 出典

- shadcn-ui/lint「require-static-classes」: https://github.com/shadcn-ui/lint/blob/main/docs/rules/require-static-classes.md
