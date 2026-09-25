# フォームと入力部品

入力スキーマ、フォームの部品、Select と数値の入力欄、高さのあるダイアログ、placeholder を書くときの手順と落とし穴を持つ。

| 決定                                                                | ADR      |
| ------------------------------------------------------------------- | -------- |
| ドメイン型は valibot スキーマから導出する                           | ADR-0013 |
| 数値入力に `type="number"` を使わず Base UI の NumberField に寄せる | ADR-0021 |
| placeholder には例示だけを置き、色を専用トークンへ切る              | ADR-0025 |

## how-to

### スキーマを書く

- client に送らせないフィールドがあるときは、保存済みスキーマから `v.omit` で入力スキーマを派生させる。派生元が `v.object` なら、未知のキーは reject されず黙って strip される。これは `v.omit` ではなく `v.object` の性質で、`v.strictObject` から派生させると同じ入力が reject される (2026-09-02 実測)。どちらの挙動を意図したかをテストで固定する
- 入力用と保存用で pipe が分かれる項目 (実例は `src/features/notes/schema.ts` の title) の呼称は、`TInput` を型引数で与えた 1 つの `v.metadata` action を両方の pipe に渡す。型引数も注釈も無い action は `TInput` が `unknown` に推論され、`v.pipe` に入らない
- `@valibot/to-json-schema` を使うときは、`title` / `description` の action も同じ pipe に足せる。呼称の出処はスキーマ 1 つのまま保てる

### スキーマの型テストを書く

- 導出型と導出元が一致することの型テストは書かない。常に真になり、何も検出しない
- `InferOutput` を選んだ判断を守るテストは、導出型を直接参照して書く (`expectTypeOf<Note["createdAt"]>()`)。スキーマ由来の型どうしを比べる形は、導出元の書き換えを検出せず、default を外す正当な変更で偽のアラームを出す

### 数値の入力欄を組む

`NumberField` を使う (ADR-0021)。`Field` / `FieldLabel` / `FieldError` の構成と見た目は他の入力欄と同じにし、`NumberField.Input` に `render={<Input />}` を渡して registry の `Input` の意匠をそのまま使う。
テストの取り方は `docs/guides/testing/user-interactions.md`「入力部品を操作する」にある。

### `fieldComponents` の部品を書く

`createFormHook` の `fieldComponents` に登録する部品は、部品の中では使わない `fieldValue` prop を持ち、消費側が `fieldValue={field.state.value}` を渡す。理由は「`fieldValue` で値型を突き合わせる理由」にある。部品ごとに次を守る。実例は `src/components/parts/form-fields.tsx`。

- 部品は `FieldValueTypeCheckProps<T>` を extends する。守らないと、値型の違うフィールドへ差しても型検査が通り、実行時に値の型が崩れる
- 消費側は部品を使うたびに `fieldValue={field.state.value}` を書く。必須 prop なので、書き忘れは型検査が止める
- prop の名前は `value` にしない。部品が内部で `Input` へ渡す `value` と紛れる
- `expectTypeOf` で `ComponentProps<typeof 部品>["fieldValue"]` を固定する。prop が外れても誰も気付かないためで、この型テストを落とすのは `vp check` の type-aware lint である。`vp test run` は型検査をしない

### Select の値を解決する

選んでいた値が候補から消えたことを、`onValueChange` の `null` 通知で検出しない。値の解決は消費側で引き取り、次の形にする。理由は「Select の値を消費側で解決する理由」にある。実例と、通知が来る条件の読み取りは `src/components/parts/form-fields.tsx` の `FormSelectField` の docstring にある。

| 受けたもの                | 扱い                                                       | 守らないと                                                                                             |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `onValueChange` の `null` | form の値を消さない。`console.warn` に現在値と突合元を残す | 候補の入れ替えで form の値が黙って消える                                                               |
| `options` に無い値        | 表示を保ったまま、`console.warn` に値と突合元を残す        | Base UI との配線の不整合が誰にも見えない                                                               |
| 候補から消えた値          | 保持するか再選択を促すかを消費側で決める                   | 通知が来ない条件 (未登録、`null`、マウント時の値へ戻る) で、解決できない値がトリガーに内部値のまま残る |

- `FormSelectField` を包まずに `Select` を使う箇所は、同じ引き取りを自分で書く

### 高さのあるダイアログを組む

入力項目が多く、恒常的に viewport の高さを超えるダイアログは、本文を `DialogScrollBody` (`src/components/ui/dialog.tsx`) で包み、本文だけを内部スクロールさせる。見出し・X ボタン・フッターが常に見える。フォームを持つダイアログは、器を `ActionDialogContent` (`src/components/action/dialog.tsx`) にする。実例は `src/routes/notes/-components/note-create-dialog.tsx`、見え方は `src/components/action/dialog.stories.tsx` の `Overflowing` で確かめる。

```tsx
<ActionDialogContent submitAction={save}>
  <DialogHeader>…</DialogHeader>
  <DialogScrollBody>
    <FieldGroup>…</FieldGroup>
  </DialogScrollBody>
  <DialogFooter>
    <ActionFormSubmit>保存</ActionFormSubmit>
  </DialogFooter>
</ActionDialogContent>
```

| 組み方                                                                                                      | 守らないと                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 見出し・本文・フッターを器の子として同じ深さに並べる。送信を持たないダイアログの器は `DialogContent` にする | 間に box を挟むと、本文とフッターの間隔と内部スクロールを Popup (`flex-col gap-6 min-h-0`) が持てなくなる |
| フォームを包む `form` を `DialogContent` の外に置かない。`ActionDialogContent` を使う                       | `DialogContent` は Portal で body の下へ出るので、DOM の上で送信ボタンが form の外になり送信が起きない    |
| フッターは `DialogScrollBody` の後ろに置き、本文の中へ入れない                                              | 本文の中のフッターはスクロールで流れる                                                                    |
| 見出しと X ボタンを sticky にしない                                                                         | sticky と内部スクロールの 2 つの固定機構が重なり、どちらが効いているかを実測しないと分からなくなる        |
| 本文の余白は `DialogScrollBody` が持つ (`px-6` / `py-4`)。消費側で padding を足さない                       | スクロール領域の内側に余白が無いと、端の要素の `ring` / `box-shadow` が境界で切れる                       |

- `DialogContent` の padding を変えたら、`DialogScrollBody` の `-mx-6` / `px-6` も変える
- 組み忘れても、registry の Dialog が持つ backstop (`popupOverflowBackstop`) で Popup ごと流れるので、内容は読める。ただし見出しと X ボタンも流れる

### 入力欄の周りに要素を置く

- input の上に疑似要素や別の要素を重ねて、hit 領域を広げない。重なった要素が pointer を受け、本体がクリックを受け取れなくなる。テストでは Playwright の hit-target 検査で click が落ちる (`docs/guides/testing/user-interactions.md`「クリックを発火する」)。registry の `Input` 単体は `src/components/ui/input-pointer.test.tsx` が見る
- checkbox の行を素の `<label>` や手書きの `role="group"` で組まない。複数選択は `ChoiceCard` / `ChoiceCardList` (`src/components/parts/choice-card.tsx`) を使う。単独の checkbox は `Field orientation="horizontal"` の中に `Checkbox` と `FieldLabel` を置き、グループの外枠は `FieldSet` と `FieldLegend` にする

### placeholder を足す

placeholder を足すときは、次の 2 つを確かめる (ADR-0025)。

1. 例示か。ラベルの代わりでも、書式や条件の説明でもないか
2. ラベルが名指していない情報を足していないか

1 を満たし 2 を満たさないものは置いてよいが、`--placeholder` の色では dark で SC 1.4.3 の 4.5:1 に届かない。書式や指示を placeholder に書くと、そのまま不適合になる。

## explanation

### ダイアログを内部スクロールにする理由

公式の例は 3 通りある (2026-09-23 時点)。

| 出典                                                 | 形                                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base UI Dialog「Inside scroll dialog」               | Popup は画面に収めたまま、Header と Actions の間に `ScrollArea` を置いて本体だけをスクロールさせる。Popup の直下に Header / ScrollArea.Root / Actions を並べる               |
| Base UI Dialog「Outside scroll dialog」              | Viewport 側をスクロールさせ、Popup が画面の下端を越えて伸びる                                                                                                                |
| shadcn Dialog「Scrollable Content」「Sticky Footer」 | Header と Footer の間の本文を `-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4` の div でスクロールさせる。Header / Footer は sticky ではなく、本文の外に置いて固定する |

`ActionDialogContent` は Base UI の Inside scroll の並びを保ったまま、`DialogContent` の中を `form` で包む。form は `display: contents` で box を作らないので、見出し・本文・フッターは Popup の直下と同じく flex の子として並ぶ。form の置き場所を出典の形に合わせない理由は「フォームを `DialogContent` の中に置く理由」にある。

- Outside scroll を採らないのは、見出しと X ボタンが流れるためである。backstop が効いたとき (組み忘れたとき) と同じ見え方を、正規の形にすることになる
- shadcn の例のように本文を `max-h-[50vh]` で打ち切らないのは、打ち切りの値が viewport と Dialog の余白に追随せず、ダイアログごとに値を持つことになるためである

### フォームを `DialogContent` の中に置く理由

form の置き場所は 3 通り考えられる。2026-09-25 に確認した。

| 案                                                                                                                                                                                | 評価                                                                                                                                                                                                             | 採否     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| form を `DialogContent` の外に置き、見出し・本文・フッターを `DialogContent` の直下に並べる (shadcn の `apps/v4/registry/bases/base/examples/dialog-example.tsx` の「With Form」) | `DialogContent` は Portal で body の下へ出るので、DOM の上で送信ボタンが form の外になり、送信が起きない。ブラウザテストで送信ボタンの `form` が `null`、`onSubmit` が 0 回だった (form を中に置いた対照は 1 回) | 却下     |
| Popup を `render` で form として描く                                                                                                                                              | Popup は描いた要素に `role="dialog"` を付ける。ARIA in HTML が form 要素に許す役割は none / presentation / search で、dialog を含まない                                                                          | 却下     |
| `DialogContent` の中を `display: contents` の form で包む (`ActionDialogContent`)                                                                                                 | form が入力欄と送信ボタンの祖先になり、Enter とクリックで送信が起きる。form は box を作らないので、並びは Base UI の Inside scroll と同じになる                                                                  | **採用** |

- React docs の `createPortal` は「A portal only changes the physical placement of the DOM node」と書く。HTML 仕様の form owner は「nearest ancestor form element」で、React の木の上の親子関係を見ない
- 上流で同じ症状に触れているのは shadcn-ui/ui の discussion 2918 のコメントだけである
- `display: contents` の要素は、ブラウザによって accessibility tree から消える (MDN「display」、子孫は残る)。Adrian Roselli は操作・フォーカスを受ける要素に使わないよう勧め、定期的な確認を求める (2025-07-31 の追記)。この form は操作もフォーカスも受けず、名前を持たないので form の役割として公開されない。確認は `src/components/action/dialog.stories.tsx` の axe が担う

### `fieldValue` で値型を突き合わせる理由

`fieldComponents` に登録した部品は `useFieldContext<T>()` でフィールドを読む。`T` は部品側の宣言にすぎず、実際にどのフィールドへ差されたかとは結び付かない。number のフィールドに文字列の部品を差しても型検査は通る。TanStack/form の discussion 1240 が同じ事象を挙げ、pre-bound の field component は型安全でないと報告している (2025-03-07 起票)。
消費側で `name` から型付けされるのは `field.state.value` だけで、部品へ値の型を知らせる経路はこの値を props で受けるしかない。

| 案                                              | 評価                                                                                                        | 採否     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| 使わない `fieldValue` prop で値型を突き合わせる | 消費側の 1 prop で、`name` 由来の型と部品の型が衝突すれば型エラーになる。discussion 1240 の採用回答と同じ形 | **採用** |
| `useFieldContext<T>()` の宣言に任せる           | 宣言が実フィールドと結び付かない (discussion 1240)                                                          | 却下     |
| 上流の値型を突き合わせる API を待つ             | stable (1.33.5) の公開型に無い (2026-09-23、`npm pack` で取得して確認)                                      | 見送り   |

- 出典: TanStack/form discussion 1240 (https://github.com/TanStack/form/discussions/1240)、Form Composition (https://tanstack.com/form/latest/docs/framework/react/guides/form-composition)

### Select の値を消費側で解決する理由

Base UI の `Select` は、候補が変わって現在値が候補から消えたとき、自分で値を戻して `onValueChange` を呼ぶことがある。この自己リセットは公式 docs に無い挙動で、通知が来ない条件があり、版で経路が変わる。条件の読み取りと版は `src/components/parts/form-fields.tsx` の `FormSelectField` の docstring にある。

| 案                                             | 評価                                                             | 採否     |
| ---------------------------------------------- | ---------------------------------------------------------------- | -------- |
| 消費側で値を解決し、Base UI の通知は警告に使う | 通知の有無に依らず form の値が決まる                             | **採用** |
| Base UI の自己リセットに任せる                 | 公式 docs に無い挙動で、通知されない条件があり、版で経路が変わる | 却下     |
