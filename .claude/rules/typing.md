---
paths:
  - "src/**"
---

# 型の規律

## ドメイン型はスキーマから導出する

- ドメイン型は `src/features/<domain>/schema.ts` のスキーマから `InferOutput<typeof xxxSchema>` で導出し、手書きのフィールド宣言を新設しない。二重管理するとスキーマへのフィールド追加が型に伝わらず、実行時の検証まで気付けない (ADR-0013)
- サーバーが付与するフィールド (id / 生成日時等) は、入力スキーマとは別に保存済みスキーマを `entries` の spread で組み立ててそこから導出する。別々に書くと「書き込みでは弾かれるのに読み出しでは通る」非対称が生まれる (ADR-0013)
- 導出には `InferOutput` を使う。`InferInput` は default 付きフィールド (`v.optional(v.boolean(), false)`) を optional にし、読み出し後の形と食い違う (ADR-0013)
- 項目の呼称は `v.metadata({ label })` でスキーマの各項目に載せ、消費側は `v.getMetadata(entries.x).label` から `satisfies Record<keyof T, string>` 付きの object に写して読む。素の定数 object を別に持たない。持つと項目追加で呼称が漏れても型で落ちない (ADR-0013)
- 例外はスキーマ由来型どうしを組み合わせる合成ヘルパー型。手書きになる場合は理由をコメントで残す (ADR-0013)
- 導出型とその導出元が一致することの型テストを書かない。常に真になり変更を検出しない (`docs/guides/forms-and-inputs.md`「スキーマの型テストを書く」)
- テーブルを足したら、テーブル定義の `$inferSelect` と valibot のスキーマの型を突き合わせる型テストを書く。出処が別なので、書かないと項目のずれが実行時まで見えない (ADR-0034)
- 導出元の選択を守るテストは、導出型の項目を直接参照する。スキーマ由来型どうしの比較は導出元の書き換えを検出しない (`docs/guides/forms-and-inputs.md`「スキーマの型テストを書く」)
- フォームの `onSubmit` では値を `v.parse(<入力スキーマ>, value)` に通してから送る。TanStack Form は validator のスキーマの変換 (`v.trim()` など) を値に反映せず、手で書き写すと送信値だけが古くなる (`docs/guides/forms-and-inputs.md`「スキーマを書く」)
- `v.object` から `v.omit` で入力スキーマを派生させたら、未知キーが silent に strip される挙動をテストで固定する。`v.strictObject` 由来なら reject されるので、派生元を確かめてから書く (`docs/guides/forms-and-inputs.md`「スキーマを書く」)

## 文字数の上限はスキーマが code point で持つ

- 文字数の上限は `v.maxCodePoints` で書き、`v.maxLength` を使わない。`maxLength` は 𠮷 や絵文字を 2 と数え、「N 文字以内」の文言と SQLite の `length()` の両方とずれる (ADR-0036)
- 入力欄に `maxLength` を付けず、上限はスキーマに任せる。`maxlength` は code unit で数えてスキーマとずれ、変換中に上限へ達すると入力できず、貼り付けた文字列を黙って切る (ADR-0036)

## 型アサーション (`as`) 全面禁止

lint (`typescript/consistent-type-assertions`) が止める。`as const` は可。直し方 (ADR-0007):

- 型が合わないときはキャストせず実装を変える。lint の help が案内する型注釈と `satisfies` のほかの代替は `as const` / 実行時の検査 (`typeof`・`instanceof`・`in`) / 型ガード関数 (`docs/guides/lint/configuration.md`「型アサーションを使わずに直す」)
- server が受け取る外部データ (ORM の戻り値と、外部 API のレスポンス) は読み出し口で `src/features/<domain>/schema.ts` のスキーマの `v.safeParse` に通し、失敗時は値を載せず位置と件数だけを投げる。`v.parse` が投げる `ValiError` は受け取った値を持ち、server のログに残る (ADR-0013)
- テスト double もまず型注釈で表現する。抑制へ落とすのは、private か protected のメンバーや `#` の field を持つクラスの型のように、object literal で型を満たせない場合だけ。private の constructor だけなら object literal で満たせる (`docs/guides/lint/configuration.md`「型アサーションを使わずに直す」)
- 回避不能な場合のみ `oxlint-disable-next-line typescript/consistent-type-assertions` で行単位抑制し、理由を directive の `--` に書く (`docs/guides/lint/configuration.md`「型アサーションを使わずに直す」)
- `src/components/ui/` の registry で抑制したら台帳 `docs/registry-deviations.md` にも記録する (ADR-0020)

## children prop は明示的に ReactNode で宣言する

- 自前の props 型に `children: ReactNode` (必須) / `children?: ReactNode` (任意) を書く。どちらかはコンポーネントの意図で選ぶ (`docs/guides/react/props.md`「children を宣言する」)
- 型は `ReactNode` にする。`ReactElement` へ狭めるのは子を JSX 要素ちょうど 1 つに限る部品だけにし、理由をコメントに書く。`ReactElement` は文字列・複数の子・`cond && <x />` を拒み、要素の種類は絞れない (`docs/guides/react/props.md`「children を `ReactNode` で受ける理由」)
- `PropsWithChildren` で children を足さない。children を任意で足すだけで、必須にするなら結局 props 型に `children` を書く (`docs/guides/react/props.md`「children を宣言する」)
- JSX の子要素として描かないもの (行のデータ、行を描く関数など) は、`children` ではなく役割を表す名前の prop (例: `rows` / `renderRow`) で受ける (`docs/guides/react/props.md`「children 以外の名前で受ける」)
- 対象外: shadcn 生成コード (`src/components/ui/`) と、外部のライブラリが求める型に props を合わせる場合 (`docs/guides/react/props.md`「children を宣言する」)

## ラッパー部品の転送 prop 型は転送先の ComponentProps から導出する

- 転送する prop の型は自前で再宣言せず、転送先の `ComponentProps` から導出する。自前で宣言するのは部品固有の prop (label / options / sanitize 等) だけ (`docs/guides/react/props.md`「ラッパー部品の props を転送先から導出する」)

| 部品の形                                                                                               | props の型                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 転送先の全 API を公開する薄いラッパー                                                                  | `ComponentProps` の素通し。spread から `ref` を外すことを型で示すときだけ `ComponentPropsWithoutRef` (`docs/guides/react/props.md`「ラッパー部品の props を転送先から導出する」)                                                       |
| 1 つの転送先へ spread し、一部の prop を内部で握るラッパー (`src/components/action/`)                  | 握る prop を `Omit` で外し、JSX では握る prop を spread の後ろに書く (`docs/guides/react/props.md`「ラッパー部品の props を転送先から導出する」)                                                                                       |
| 複数の部品を組み、値・id・`aria-invalid` を内部で配線する部品 (`src/components/parts/form-fields.tsx`) | 公開する prop を `Pick` で列挙し、rest を spread しない。rest を開くと controlled prop の上書きと、Field の組み方を迂回する className 直渡しの経路ができる (`docs/guides/react/props.md`「ラッパー部品の props を転送先から導出する」) |

## fieldComponents の部品は値型突き合わせ用の prop を持たせる

- 部品内部では使わない `fieldValue` prop を置き、消費側が `fieldValue={field.state.value}` を渡す。型は `FieldValueTypeCheckProps<T>` (`form-fields.tsx`) を extends する (`docs/guides/forms-and-inputs.md`「`fieldComponents` の部品を書く」)
- `useFieldContext<T>()` の `T` は実フィールドと結び付かず、値型の違う部品を差しても通る。`fieldValue` が唯一の突き合わせ経路 (`docs/guides/forms-and-inputs.md`「`fieldValue` で値型を突き合わせる理由」)
- prop 名は `value` にしない (`docs/guides/forms-and-inputs.md`「`fieldComponents` の部品を書く」)
- `expectTypeOf` で `ComponentProps<typeof 部品>["fieldValue"]` を固定する型テストを `*.test-d.ts` に書く。prop が外れても誰も気付かない (`docs/guides/forms-and-inputs.md`「`fieldComponents` の部品を書く」)
