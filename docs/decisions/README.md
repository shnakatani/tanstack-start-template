# Architecture Decision Records (ADR)

ツールチェーン・lint 方針・型の作り方・UI 基盤など、後から「なぜこうしたのか」を問われる構造的判断を記録する。
**インフラ・ツールチェーン等の構造変更に着手する前に必ず参照する。**

## 一覧

| #                                                   | タイトル                                                                       | Status   | Date                          | 要約                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------ | -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [0001](0001-docs-norms-decisions-history-layers.md) | ドキュメントを規範と経緯と履歴の 3 層に分ける                                  | Accepted | 2026-08-17                    | 規範は `.claude/rules/`、経緯と選択肢比較は `docs/decisions/`、変更の記録は git 履歴。rules は 1 項目 200 字以下で、削除可否は「消したら誤るか」で判定する                                              |
| [0002](0002-dev-environment-toolchain.md)           | 開発環境のツールチェーンは mise と Vite+ に寄せる                              | Accepted | 2026-08-17（2026-09-02 改訂） | Node.js と pnpm の版は `package.json` (`devEngines.runtime` / `packageManager`) が持ち、Vite+ が解決する。mise は tasks と `[env]`。クローン後は `mise install` と `vp install` の 2 段                 |
| [0003](0003-plugins-via-explicit-default-set.md)    | 有効にするプラグインは既定集合を明示して積む                                   | Accepted | 2026-08-17                    | `lint.plugins` は既定集合を置換する。明示しないと `typescript` 等が無効になり、`rules` の設定が無診断で捨てられる。既定集合を定数にして spread する                                                     |
| [0004](0004-lint-rule-selection-criteria.md)        | ルールの選定は上流 recommended を基準にし、typescript だけ strict を基準にする | Accepted | 2026-08-17（2026-09-02 改訂） | カテゴリ有効化は `correctness` と `perf` に限る。off の条件、テストの緩和 5 ルール、jsx-a11y の名指しゼロ、tailwind 領域を `jsPlugins` で足す判断もここが持つ                                           |
| [0005](0005-dependency-supply-chain-gates.md)       | 依存更新は待機 3 日で統一し、pin には出口条件を書く                            | Accepted | 2026-08-17（2026-09-02 改訂） | pnpm の `minimumReleaseAge` と Dependabot の `cooldown` を対で持つ。alerts は `ignore` と独立に発火するので、pin の追従はトリガ駆動で足りる                                                             |
| [0006](0006-shadcn-registry-deviation-list.md)      | registry コードへの改変は許容リストと生成時 baseline で統制する                | Accepted | 2026-08-17                    | 意図的乖離は許容リストと 1:1。判別は `docs/registry-baseline/` を交えた 3-way (意図的乖離 = baseline とローカル / 上流 drift = baseline と最新 CLI 出力)                                                |
| [0007](0007-touch-target-aa-baseline.md)            | touch target は WCAG 2.2 AA を床とし registry 素寸法で一本化する               | Accepted | 2026-08-17                    | 44px (HIG / WCAG AAA) を要件にせず 24px を適合の床とする。視覚 = ヒット = registry 素寸法。44px の焼き込みは規範で禁じ、実寸は `touch-target.test.tsx` が固定する                                       |
| [0008](0008-domain-types-derived-from-schemas.md)   | ドメイン型は valibot スキーマから導出する                                      | Accepted | 2026-08-17                    | 型は `InferOutput` の型エイリアスで導出し、手書きと二重に持たない。ORM の戻り値は読み出し口で `safeParse` に通す                                                                                        |
| [0009](0009-react-compiler-adoption.md)             | メモ化は React Compiler に委ね、予防的なメモ化を強制しない                     | Accepted | 2026-08-17（2026-09-02 改訂） | Compiler を `infer` で導入し、適用は `@vitejs/plugin-react` の `compiler` オプション (oxc ネイティブ) で行う。bail out は欠陥として扱わず、`logDiagnostics` でビルドログへ出すだけにする                |
| [0010](0010-number-input-without-type-number.md)    | 数値入力に `type="number"` を使わず Base UI の NumberField に寄せる            | Accepted | 2026-09-02                    | `type="number"` は NVDA の要素一覧で unlabeled、Dragon で入力不可、ホイールで値が無言に増減する。推奨形の `type="text"` + `inputmode="numeric"` を出す NumberField を使い、パースとロケール整形も委ねる |

## フォーマット規約

新規 ADR は連番でファイルを作る: `NNNN-kebab-case-slug.md`。作成後はこの README の一覧へ 1 行追記する。
追記漏れと参照切れは `scripts/checks/integrity/adr-index.test.ts` が検出する。

### タイトルとメタデータ

```markdown
# ADR-NNNN: 日本語タイトル

- Status: Proposed | Accepted | Deprecated | Superseded
- Date: YYYY-MM-DD
- （任意）Revised: YYYY-MM-DD (改訂内容の要約)
- （任意）Supersedes: ADR-NNNN / Superseded-by: ADR-NNNN
- （任意）関連: ADR-NNNN (関係の一言)
```

- タイトル prefix は `ADR-NNNN:`（ハイフン）で統一する
- 決定が後続 ADR で置き換わったら旧 ADR を `Superseded` にし、相互に `Supersedes` / `Superseded-by` をリンクする
- 同じ ADR の枠内で決定を改訂したときは `Revised` に日付と要約を書き、一覧の Date 欄も `YYYY-MM-DD（YYYY-MM-DD 改訂）` にする。対象は決定の内容が変わる改訂に限る（用語・表現の補足や実測値の追記は `Revised` に載せない）

| Status     | 意味                                            |
| ---------- | ----------------------------------------------- |
| Proposed   | 提案中（レビュー待ち）                          |
| Accepted   | 採用・有効                                      |
| Deprecated | 非推奨（代替なしで使わなくなった）              |
| Superseded | 別 ADR に置き換えられた（`Superseded-by` 併記） |

### セクション構成

最低限 3 つ。題材に応じて調査・設定セクションを足してよい:

- **Context** — 背景・制約・要件。判断の前提を書く
- **Decision** — 何を選んだか。**検討した選択肢の比較表**（候補 / 評価軸 / 採否）と**却下理由**を必ず含める
- **Consequences** — 採用結果として起きること（メリット・デメリット・後続作業・再評価条件）

任意セクション例: 「調査結果」（実測の根拠）、「設定上の注意 / リスク」、「出典」。

### 記述ルール

- 主張は実コード・実測で裏づける。コード参照は `src/path/to/file.ts` のようにファイルパスで書き、半年後も追える形にする
- 指示語（「本 PR」「今回の」）・チャット内画像参照（`[Image #N]`）を書かない。相対日付は絶対日付（`YYYY-MM-DD`）に変換する（`.claude/rules/doc-hygiene.md`）
- 外部料金・ライブラリ仕様など変動する数値は、前提条件と確認時点を明記し、可能なら出典 URL を「出典」セクションに置く
