# ADR-0028: 消費側の className は静的に読める形に保ち、共有する外見は部品で配る

- Status: Accepted
- Date: 2026-09-19
- 関連: ADR-0029 (`@shadcn/lint` のルールの選定)、ADR-0019 (Action 層の責務)、ADR-0013 (コンポーネントの層と適用範囲の表し方)

## Context

`@shadcn/lint` で design system の契約を守る系統は `no-restyle` と `require-static-classes` の 2 つある。
前者は ADR-0013 の層の決定と対で先に採り、後者は保留していた (ADR-0029)。

後者は、消費側が design system component へ渡す `className` を linter が読める形に保つ規則である。
読めない `className` があると `no-raw-colors` と `no-unknown-classes` はその中身を検査できない。
色と未知 class の統制 (ADR-0029) の手前にある門番にあたる。

### 何が読まれ、何が読まれないか

規則を有効にした状態で `src/routes/` へ probe を置き、`vp lint <probe>` で測った (2026-09-19、`@shadcn/lint` 0.1.0)。

| 消費側の書き方                              | `require-static-classes` | 中身が他の規則に読まれるか |
| ------------------------------------------- | ------------------------ | -------------------------- |
| 静的な文字列                                | 通る                     | 読まれる                   |
| 同一ファイル内の `const` (再代入なし)       | 通る                     | 読まれる                   |
| `cn()` の引数                               | 通る                     | 読まれる                   |
| 他ファイルから import した `const`          | 落ちる                   | 読まれない                 |
| 関数呼び出しの戻り値                        | 落ちる                   | 読まれない                 |
| `variantFunctions` へ宣言した関数の呼び出し | 通る                     | 読まれる                   |

同じ文字列 (`flex min-h-0 flex-col gap-6`) を 2 通りで渡すと差が出る。
同一ファイルの `const` として渡すと含まれる `gap-6` に `no-restyle` が出るが、import した `const` として渡すと `require-static-classes` だけが出て中身の診断は消える。

ファイルを跨いだ定数が解決されないのは実装上の制約である。
`node_modules/@shadcn/lint/dist/index.js` の `resolveIdentifier` は、変数の定義が `Variable` 型でなければ解決を打ち切る (`def.type !== "Variable"`)。
import 束縛はこの型を持たないため、定数の中身まで辿れない。

### 違反の分布

規則を一時的に足して測った違反は、commit `3e5a004` の tree で `src/routes/` の 2 件だけだった (2026-09-19)。
`src/components/screens/` と直下、`src/features/` は 0 件である。
`ui/` `action/` `parts/` は `excludeFiles` の内側なので測っていない。
2 件はどちらも `src/components/` の層が export した class 定数を `src/routes/` が import し、design system component へ渡す形である。

`src/components/ui/dialog.tsx` も同種の class 定数を 2 つ export するが、消費側が `src/components/ui/alert-dialog.tsx` で層の内側に閉じているため規則に当たらない。
**当たるのは定数を共有するパターンではなく、共有が層の境界を越えることである。**

## Decision

### 1. 規則を `no-restyle` と同じ層の境界で有効にする

`vite.config.ts` の `overrides` で、`no-restyle` と同じ `files` / `excludeFiles` の組に相乗りさせる。
design system 自身の内部では、消費側の上書きを見る規則も、消費側の `className` を読める形に保つ規則も意味を持たない。
境界そのものの判断は ADR-0013 が持つ。

### 2. `cva` 由来の variant 関数を `settings.shadcn.variantFunctions` へ宣言する

宣言は違反を黙らせる例外ではなく、このプロジェクトの variant 関数が何かを linter へ伝える設定である。
`componentImports` と同じ恒久設定として扱い、撤去条件を持たせない。
宣言するのは消費側から呼ぶ形を採る variant 関数に限る。層の内側でしか呼ばない関数は規則に当たらない。

宣言しないと、shadcn/ui の Button docs が「As Link」で推奨する `className={variant 関数(...)}` の形が落ちる。
このリポジトリはテンプレートなので、利用者が公式どおり書いて lint が止まるのは不備になる。

登録先による違い (2026-09-19 実測)。

| 登録先             | variant 関数の呼び出しの扱い                                                                                                          | 採否     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `variantFunctions` | 解決され、pass-through の `className` が `no-raw-colors` / `no-unknown-classes` に読まれる                                            | **採用** |
| `mergeFunctions`   | 解決されるが、渡したオブジェクトのキー名 (`variant` / `className`) を class と誤読し、`no-restyle` と `no-unknown-classes` が誤報する | 却下     |

### 3. design system の層から外へ class 文字列を配らない

外見を層の外と共有するときの配り方 (部品 / prop / variant) は `docs/guides/styling-and-tokens.md`「外見を層の外へ配る」にある。

### 検討した選択肢

| 案                                                          | 評価                                                                                               | 採否     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| 規則を採用しない                                            | 層を越えて配られた class 文字列が色と未知 class の検査から外れ、外れていること自体が診断に現れない | 却下     |
| 採用し、違反を行単位で抑制する                              | 恒久的な例外が残る。同じ配り方が増えるたびに抑制行が増え、規則が守る範囲が減る                     | 却下     |
| 採用し、`variantFunctions` を宣言しない                     | shadcn/ui が推奨する形が書けない。テンプレート利用者が公式どおり書くと lint が止まる               | 却下     |
| 採用し、違反は設計の変更で解消したうえで variant 関数を宣言 | 恒久的な例外がゼロになり、公式が推奨する形も通る。規則が読めない `className` は残らない            | **採用** |

## Consequences

- 消費側の `className` はすべて linter が読める形になり、`no-raw-colors` と `no-unknown-classes` の検査が届く範囲が確定する
- 恒久的な例外はゼロで、`overrides` に足すのは規則 1 行だけになる。違反が増えても行は増えない
- 規則を `overrides` から消しても `off` にしても `vp lint` と `vp check` は通る。この override のルールは解決後設定に出るため、`lint-config.test.ts` が規則名と severity を固定する
- `variantFunctions` を消すと variant 関数の呼び出しが落ちる。`vp lint --print-config` に `settings.shadcn` が出ないため (2026-09-19 実測)、宣言が消えたことを機械で見張るものは無い (`componentImports` と同じ経路。ADR-0029 の Consequences)
- design system の層から外へ class 文字列を配る形が閉じる。層の内側での共有は残る

## 出典

- shadcn-ui/lint「require-static-classes」: https://github.com/shadcn-ui/lint/blob/main/docs/rules/require-static-classes.md
- shadcn/ui「Button」(「As Link」で variant 関数を消費側から呼ぶ形): https://ui.shadcn.com/docs/components/button
