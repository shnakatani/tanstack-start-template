# ADR-0008: ドメイン型は valibot スキーマから導出する

- Status: Accepted
- Date: 2026-08-17
- 関連: ADR-0004 (`typescript/consistent-type-assertions` による型アサーション禁止)

## Context

同じデータの形が、valibot スキーマと手書きの `interface` の 2 箇所に現れることがある。
スキーマは検証のため、`interface` は route と component と server function が import するために書かれる。

この二重定義を型検査が捕まえる範囲は狭い。
スキーマの出力型を手書き型へ代入する形の「橋」を架けても、検出できるのはフィールドの削除 (TS2741) と型の変更 (TS2322) だけである。
**スキーマへのフィールド追加は落ちない。関数の戻り値には余剰プロパティチェックが働かないためである。**

結果として「スキーマ側を変えてもコンパイルは通り、実行時の検証で初めて落ちる」状態が残る。
橋が架かっていない型では 3 方向すべてが素通りする。

ORM が返す行の型も同じ性質を持つ。
drizzle の行型は「そう入っているはず」という主張であって、実データがそれを満たす保証ではない。
手書き SQL、別経路の書き込み、スキーマ変更前の残存行でずれうる。

## Decision

### 1. スキーマを型の単一の出処にする

ドメイン型は `v.InferOutput<typeof xxxSchema>` の型エイリアスで導出する。手書きの `interface` と併存させない。

```ts
export const noteInputSchema = v.object({/* ... */});
export type NoteInput = v.InferOutput<typeof noteInputSchema>;
```

`InferInput` ではなく `InferOutput` を使う。
`v.optional(x, default)` を持つフィールドは入力型では optional になり、保存済みの値の形と食い違う。valibot 公式も「特別な場合を除き出力型で足りる」としている。

### 2. 同じ制約を 2 度書かない

入力の形と保存済みの形は、片方をもう片方から組み立てる。

```ts
export const noteSchema = v.object({
  ...noteInputSchema.entries,
  id: noteIdValueSchema,
  createdAt: v.date(),
});
```

値そのものの制約 (`noteIdValueSchema`) も、それを使う入力スキーマと保存済みスキーマの両方で共有する。
別々に書くと「書き込みでは弾かれるのに読み出しでは通る」非対称が生まれる。

client に送らせないフィールドがある場合は、保存済みスキーマから `v.omit` で入力スキーマを派生させる。
派生元が `v.object` なら未知キーは reject されず silent に strip されるので、意図はテストで固定する。
これは `v.omit` の性質ではなく `v.object` の性質である。`v.strictObject` から派生させると同じ入力が reject される (2026-09-02 実測)。

### 3. 読み出し口で検証する

ORM の戻り値は、UI へ流す前に `v.safeParse` で突き合わせる (`src/server/functions/notes.server.ts` の `list` が適用例)。
通してしまうと壊れた行が無検査で UI まで届く。

失敗時に投げるメッセージには**値そのものを載せず、位置 (`v.getDotPath`) と件数だけを載せる**。
client まで届くエラーに DB の中身を混ぜないためで、位置と件数があればどの行のどの項目かは追える。

### 検討した選択肢

| 案                                       | フィールド追加 | 削除       | 型変更     | 型定義の箇所 | 採否     |
| ---------------------------------------- | -------------- | ---------- | ---------- | ------------ | -------- |
| `InferOutput` から型エイリアスで導出     | 乖離しない     | 乖離しない | 乖離しない | 1            | **採用** |
| `interface X extends InferOutput<…>`     | 乖離しない     | 乖離しない | 乖離しない | 1            | 却下     |
| 素の `satisfies v.GenericSchema<T>`      | 検出しない     | TS1360     | TS1360     | 2            | 却下     |
| curried factory で型にスキーマを合わせる | 検出する       | 検出する   | 検出する   | 2            | 却下     |
| 手書き型のまま型テストで突き合わせる     | 検出する       | 検出する   | 検出する   | 2            | 却下     |

- `interface X extends` は成立するが、空の `interface` が並ぶと「なぜ空か」の説明を各所で要求する。ホバー表示で型名が保たれる利点はあるが、型エイリアスに揃える方が読み手の負担が小さい
- `satisfies v.GenericSchema<T>` の検出範囲は戻り値の橋と変わらない。フィールド追加を検出しないため、問題の起点が残る
- curried factory は全 object スキーマを自作 factory 経由へ書き換え、その factory を保守する責任を負う。`v.pipe` や `v.variant` で包んだスキーマは対象外になり、一部の型だけ検査される非対称も残る
- 型テストは二重管理を保ったまま検査で乖離を封じる方向で、検出対象そのものを消す採用案より構造が複雑になる

## Consequences

- 型の出処がスキーマ 1 箇所になり、乖離が原理的に起こらなくなる。乖離を検出する仕組みを保守する必要も消える
- 導出型とその導出元が一致することの型テストは書かない。常に真になり何も検出しないためである
- 導出元に `InferOutput` を選んだ判断を守るテストは、導出型を直接参照する形で書く。スキーマ由来の型どうしを比べる形は導出元の書き換えを検出せず、default を外す正当な変更で偽のアラームになる
- enum の型エイリアス名が型表示から消える。`v.picklist(...)` の出力型になるが同じ union なので、その union を消費する側は影響を受けない。エイリアス自体も定義元に残る
- 保存はするが公開する型には出さないフィールドを、同じスキーマに持たせられなくなる。必要になったら保存形のスキーマを別に定義してそこから導出する
- 将来ドメイン型をスキーマと意図的に違えたくなった場合は `satisfies v.GenericSchema<T>` が使える。その時点で本 ADR を再評価する

## 出典

- Valibot Quick start (スキーマを型の単一の出処とする記述): https://valibot.dev/guides/quick-start/
- Valibot Infer types (`InferOutput` を既定とする指針): https://valibot.dev/guides/infer-types/
- Valibot discussion #377 (メンテナ fabian-hiller による `satisfies v.GenericSchema<T>` の案内。curried factory は参加者 alvechy が投稿したもので、メンテナは「今は対応する時間が無い」と述べるに留まる): https://github.com/open-circle/valibot/discussions/377
- zod discussion #1863 (`interface X extends z.infer<…>` で型名を保つ案。提案者自身が不完全と結論): https://github.com/colinhacks/zod/discussions/1863
