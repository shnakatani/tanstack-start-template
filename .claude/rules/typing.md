---
paths:
  - "src/**"
---

# 型の規律

## ドメイン型はスキーマから導出する

- ドメイン型は `src/features/<domain>/schema.ts` のスキーマから `InferOutput<typeof xxxSchema>` で導出し、手書きのフィールド宣言を新設しない。二重管理するとスキーマへのフィールド追加が型に伝わらず、実行時の `v.parse` まで気付けない (ADR-0016)
- サーバーが付与するフィールド (id / 生成日時等) は、入力スキーマとは別に保存済みスキーマを `entries` の spread で組み立ててそこから導出する。別々に書くと「書き込みでは弾かれるのに読み出しでは通る」非対称が生まれる (ADR-0016)
- 導出には `InferOutput` を使う。`InferInput` は default 付きフィールド (`v.optional(v.boolean(), false)`) を optional にし、読み出し後の形と食い違う (ADR-0016)
- 項目の呼称は `v.metadata({ label })` でスキーマの各項目に載せ、消費側は `v.getMetadata(entries.x).label` から `satisfies Record<keyof T, string>` 付きの object に写して読む。素の定数 object を別に持たない。持つと項目追加で呼称が漏れても型で落ちない (ADR-0016)
- 例外はスキーマ由来型どうしを組み合わせる合成ヘルパー型。手書きになる場合は理由をコメントで残す (ADR-0016)
- 導出型とその導出元が一致することの型テストを書かない。常に真になり変更を検出しない (ADR-0016)
- 導出元の選択を守るテストは導出型を直接参照する (`expectTypeOf<Note["createdAt"]>()`)。スキーマ由来型どうしの比較は導出元の書き換えを検出しない (ADR-0016)
- `v.object` から `v.omit` で入力スキーマを派生させたら、未知キーが silent に strip される挙動をテストで固定する。`v.strictObject` 由来なら reject されるので、派生元を確かめてから書く (ADR-0016)

## 型アサーション (`as`) 全面禁止

lint (`typescript/consistent-type-assertions`) が止める。`as const` は可。直し方 (ADR-0009):

- 型が合わないときはキャストせず実装を変える。代替はランタイムガード / `as const` / 型ガード関数 / 親型 API
- 外部データ (DB の行 / API レスポンス等) は `v.parse(schema, data)` で検証する。スキーマは既存のもの (`src/features/<domain>/schema.ts`) を再利用する
- テスト double もまず型注釈で表現する。抑制へ落とすのは、private constructor を持つ外部型のように構造的構築が閉じている場合だけ
- 回避不能な場合のみ `oxlint-disable-next-line typescript/consistent-type-assertions` で行単位抑制し、理由を directive の `--` に書く
- `src/components/ui/` の registry で抑制したら ADR-0027 の許容リストにも記録する

## children prop は明示的に ReactNode で宣言する

- 自前の props 型に `children: ReactNode` (必須) / `children?: ReactNode` (任意) を書く。どちらかはコンポーネントの意図で選ぶ
- 型は `ReactNode` に固定する (`ReactElement` 等へ狭めるのは本当に制約したいときだけ、理由コメント付き)
- `PropsWithChildren` は使わない。children が常に optional になり必須を表現できない (react.dev と React TypeScript Cheatsheet の第一形が明示宣言)
- JSX 子要素と違うセマンティクスのものを受けるなら、`children` ではなく別名の prop (例: `renderRow` / `rows`) にする
- 対象外: shadcn 生成コード (`src/components/ui/`) と外部 API の型都合

## ラッパー部品の転送 prop 型は転送先の ComponentProps から導出する

- 転送する prop の型は自前で再宣言せず `Pick<ComponentProps<typeof 転送先>, "...">` を extends して導出する。出処が明示され、転送先の型変更に自動追随する (実例: `src/components/parts/form-fields.tsx`)
- 部品が内部で握る prop (value / onChange / id / aria-invalid 等) は rest スプレッドで全面公開しない。公開する prop を Pick で列挙する。controlled prop の上書き事故と、部品が保証する規約 (Field 構成等) を迂回する className 直渡しを防ぐ
- 転送先の全 API を意図的に公開する薄いラッパー (実例: `src/components/parts/button-link.tsx`) は `ComponentProps` / `ComponentPropsWithoutRef` の素通しで良い。Pick を要求する対象は、一部の prop を内部で握る配線部品に限る
- 部品固有の prop (label / options / sanitize 等) のみ自前宣言する

## fieldComponents の部品は値型突き合わせ用の prop を持たせる

- 部品内部では使わない `fieldValue` prop を置き、消費側が `fieldValue={field.state.value}` を渡す。型は `FieldValueTypeCheckProps<T>` (`form-fields.tsx`) を extends する。値型の違う部品を差したときに型で落ちる
- `useFieldContext<T>()` の `T` は実フィールドと結び付かず、値型の違う部品を差しても通る。`fieldValue` が唯一の突き合わせ経路 (TanStack/form discussion #1240)
- prop 名は `value` にしない。部品が内部で `Input` へ渡す `value` と紛れる
- `expectTypeOf` で `ComponentProps<typeof 部品>["fieldValue"]` を固定する。落とすのは `vp check` の type-aware lint で、`vp test run` は型検査をしない
