# 型テスト

`expectTypeOf` だけで型を確かめるテストの置き場所と、検査のされ方を持つ。何を型テストにするかは、主題ごとのガイドが持つ (スキーマは `docs/guides/forms-and-inputs.md`「スキーマの型テストを書く」、フォームの部品は同じガイドの「`fieldComponents` の部品を書く」)。

## how-to

### 型テストを置く

- 型だけのテストは、確かめる対象の隣に `<名前>.test-d.ts` として置く。実行するテストと同じファイルに書かない
- `describe` / `it` / `expectTypeOf` は `vite-plus/test` から import する。確かめる対象は `import type` で引く
- 検査は `vp check` の type-aware lint が行う。型が食い違うと、その行に型エラーが出る。コードは食い違いの形で変わる (項目の型が違えば `TS2344`、項目が欠ければ `TS2741` など)
- `vp test run` は `.test-d.ts` を集めない。どの Vitest project の `include` にも一致しないためで、型テストの件数はテスト結果に出ない
- 型テストを足したら、期待型を一時的に変えて `vp check` が落ちることを確かめてから戻す。`expectTypeOf` は実行時に何もしないので、落ちる経路は型検査だけである

## explanation

### `*.test-d.ts` に分ける理由

`expectTypeOf` は実行時に何もしない (Vitest docs「expectTypeOf」: "During runtime this function doesn't do anything")。`*.test.ts(x)` に書くと、型だけのファイルも `vp test run` で pass として数えられ、何も確かめていないテストが結果に混ざる。`*.test-d.ts` は Vitest が型テストに割り当てる名前 (Vitest docs「Testing Types」: "By default all tests inside `*.test-d.ts` files are considered type tests") で、名前から型テストだと分かる。

### Vitest の `typecheck` を使わない理由

Vitest は `--typecheck` (`typecheck.enabled`) で `.test-d.ts` を型検査し、テスト結果として数える。このリポジトリは有効にしない。

| 理由                                                                                    | 出典                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| experimental の機能で、SemVer に沿わない変更がありうる                                  | Vitest docs `config/typecheck.md` の見出し `typecheck <Experimental />`、実行時の警告 "please pin Vitest's version" (v4.1.11 と v5.0.2)                   |
| checker の既定は `tsc` で、`typescript` パッケージを直接の依存に置くことになる          | 同 docs の "`tsc` requires `typescript` package"。置かない理由は `docs/guides/dependencies-and-toolchain.md`「`typescript` を直接の依存に置かない理由」   |
| Vitest の `projects` の中で有効にすると、checker が残ってプロセスが終わらないことがある | vitest の issue 9494 (2026-09-28 時点で open)                                                                                                             |
| 同じ型の食い違いは `vp check` が落とすので、検出できる範囲は変わらない                  | oxc Discussions 19571 (`--type-check` を使うなら tsc の実行は不要)。2026-09-28 に `.test-d.ts` へ置いた型の不一致で `vp check` が exit 1 になることを実測 |

型テストが `vp check` の検査から外れる経路は、lint の設定の検査が押さえる。`lint.options.typeCheck` の値と、追跡しているソースが lint の対象に入っていることを、`scripts/checks/integrity/lint-config.test.ts` が確かめる。
