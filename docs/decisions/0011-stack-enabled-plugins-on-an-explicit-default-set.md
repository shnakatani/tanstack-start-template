# ADR-0011: 有効にするプラグインは既定集合を明示して積む

- Status: Accepted
- Date: 2026-08-17
- 関連: ADR-0012 (ルールの選定方法)

## Context

`lint.plugins` は既定集合 (`typescript` / `unicorn` / `oxc`) へ追加する設定ではなく、**置換する**。
`plugins: ["react"]` と書くと `typescript` が無効になり、`rules` に書いた `typescript/*` の設定は 1 件も検出しなくなる。

**有効でないプラグインのルール設定は、ルール名が検証されるにもかかわらず無診断で捨てられる。**

| `plugins`     | `rules` に書いたルール                  | 結果                         |
| ------------- | --------------------------------------- | ---------------------------- |
| `["react"]`   | `typescript/consistent-type-assertions` | exit 0、無出力               |
| 未指定 (既定) | `vitest/expect-expect`                  | exit 0、無出力               |
| 未指定 (既定) | `unicorn/no-null`                       | exit 1、検出する             |
| いずれでも    | `vitest/no-such-rule-here`              | exit 1、`Rule ... not found` |

判定は既定集合への所属ではなく、その時点で有効かどうかだけで決まる。
`--print-config` の解決後設定からも消えるため、設定を出力しても気付けない。

`eslint` のコアルールだけは `plugins` の指定によらず常時有効で、列挙しても解決後の `plugins` からは落ちる。

ルール名からプラグインを推測しない。
`no-array-index-key` と `no-object-type-as-default-prop` は名前から `react-perf` に属すると読めるが、実際は `react` にしかない。
誤ったプラグインへ指定した場合は `Rule '...' not found in plugin '...'` で落ちる (こちらは fail-loud)。

## Decision

`vite.config.ts` に `OXLINT_DEFAULT_PLUGINS` 定数で既定集合を明示し、その spread へ追加プラグインを積む。

```ts
const OXLINT_DEFAULT_PLUGINS = ["typescript", "unicorn", "oxc"] as const;
// lint.plugins: [...OXLINT_DEFAULT_PLUGINS, "react", "import", "promise", "jsdoc", "vitest", "jsx-a11y"]
```

spread を落として追加分だけを書くと、`typescript` を含む既定の検査が無言で消える。
これが本 ADR の中心で、プラグインを 1 つ足すたびに確認する不変条件である。

`overrides` の中の `plugins`、サブディレクトリの `.oxlintrc.json`、CLI の `-D` にも、設定したつもりで効いていない状態を作る落とし穴がある。避け方は `docs/guides/lint.md`「設定の落とし穴」にある。

### 検討した選択肢

| 案                                       | 評価                                                                        | 採否     |
| ---------------------------------------- | --------------------------------------------------------------------------- | -------- |
| 既定集合を定数化し、追加プラグインを積む | 置換の仕様をコードに表し、既定検査が silent に消えるのを防げる              | **採用** |
| 既定集合を暗黙に任せ、追加分だけ書く     | `plugins` が既定集合を置換するため `typescript` 等が無効になる              | 却下     |
| `eslint` も `plugins` に列挙する         | 置換対象ではなく常時有効で、書いても解決後の `plugins` から落ちる           | 却下     |
| registry コードを lint 対象から除外する  | ADR-0027 の既定は改変して許容リストへ記録する運用で、除外はそれを反転させる | 却下     |

## Consequences

- 既定検査が、追加プラグインの設定によって無言で消えなくなる
- 行単位の抑制は領域を問わず使ってよい。registry コードで追加で要るのは ADR-0027 の許容リストへの記録であって、抑制の可否そのものではない
- `plugins` の取りこぼしは lint の出力では気付けないため、`scripts/checks/integrity/lint-config.test.ts` が解決後設定の `plugins` と名指しのルールを期待値と突き合わせる。突き合わせの手順は `docs/guides/lint.md`「設定を書き換えたら解決後の設定で確かめる」にある
- oxlint が未有効プラグインのルールへ警告を出すようになれば、この突き合わせは不要になる (oxc-project/oxc#25579)

## 出典

- oxlint configuration file reference (`plugins` が既定集合を置換すること、`overrides` が受け付けるキー): https://oxc.rs/docs/guide/usage/linter/config-file-reference.html#plugins
- Vite+ の lint 設定方針 (`.oxlintrc.json` の併用を推奨しないこと): https://viteplus.dev/guide/lint
- 未有効プラグインのルールが無診断で捨てられる件の上流報告: https://github.com/oxc-project/oxc/issues/25579
