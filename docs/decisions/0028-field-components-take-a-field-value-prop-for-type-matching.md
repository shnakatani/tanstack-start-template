# ADR-0028: fieldComponents の部品は値型を突き合わせる `fieldValue` prop を持つ

- Status: Accepted
- Date: 2026-09-23
- 関連: ADR-0015 (ドメイン型はスキーマから導出する)

## Context

`@tanstack/react-form` の `createFormHook` に `fieldComponents` として登録した部品は、`useFieldContext<T>()` でフィールドを読む。
`T` は部品側の宣言にすぎず、実際にどのフィールドへ差されたかとは結び付かない。
number のフィールドに文字列の部品を差しても型検査は通る。TanStack/form の discussion 1240 が同じ事象を挙げ、pre-bound の field component は型安全でないと報告している (2025-03-07 起票)。

消費側で `name` から型付けされるのは `field.state.value` だけである。
部品へ値の型を知らせる経路は、この値を props で受けるしかない。
同 discussion の採用回答 (メンテナの crutchcorn) も、使わない `value` prop を部品に足して消費側から値を渡す形を示している。

## Decision

**部品の中では使わない `fieldValue` prop を置き、消費側が `fieldValue={field.state.value}` を渡す。** 型は generic interface 1 つ (`src/components/parts/form-fields.tsx` の `FieldValueTypeCheckProps<T>`) にまとめ、各部品が extends する。

| 規範                                                                     | 守らないと何が壊れるか                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `fieldComponents` の部品は `FieldValueTypeCheckProps<T>` を extends する | 値型の違うフィールドへ差しても型検査が通り、実行時に値の型が崩れる                                                       |
| prop 名は `value` にしない                                               | 部品が内部で `Input` へ渡す `value` と紛れる                                                                             |
| `expectTypeOf` で `ComponentProps<typeof 部品>["fieldValue"]` を固定する | prop が外れても誰も気付かない。この型テストを落とすのは `vp check` の type-aware lint で、`vp test run` は型検査をしない |

### 検討した選択肢

| 案                                              | 評価                                                                                                        | 採否     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| 使わない `fieldValue` prop で値型を突き合わせる | 消費側の 1 prop で、`name` 由来の型と部品の型が衝突すれば型エラーになる。discussion 1240 の採用回答と同じ形 | **採用** |
| `useFieldContext<T>()` の宣言に任せる           | 宣言が実フィールドと結び付かない (discussion 1240)                                                          | 却下     |
| 上流の値型を突き合わせる API を待つ             | 2026-09-23 時点で stable (1.33.5) の公開型に無い。下の「撤去の条件」                                        | 見送り   |

## Consequences

- 消費側は部品を使うたびに `fieldValue={field.state.value}` を書く。書き忘れは必須 prop なので型検査が止める
- 部品は値を使わない prop を持つ。消したくなったときは下の撤去の条件を先に確かめる

### 撤去の条件

`@tanstack/react-form` の stable の公開型 (`.d.ts`) に、フィールドの値型を部品へ突き合わせる API が入り、それを採用したら不要になる。判定は `.d.ts` に出るかで行い、名前の一致では行わない。

2026-09-23 時点の観測:

| 版                       | 公開型の状況                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.33.5 (`latest`)        | 値型を突き合わせる API は無い。`dist/esm/createFormHook.d.ts` は `fieldComponents` を `Record<string, ComponentType<any>>` で受ける                                                                                                                     |
| 2.0.0-alpha.2 (`alpha`)  | `getFormHookHelpers()` の `fieldComponent.strict` / `loose` と `fieldBrand` が `dist/AppForm/getFormHookHelpers.public.d.ts` に公開されている。`FieldWithValue<T>` の prop を持つ部品を包み、値型の一致を型で要求すると JSDoc が書く (型の挙動は未実測) |
| 2.0.0-alpha.2 (`alpha`)  | 同名の `createFieldComponent` は `dist/ReactForm/Components.lib.js` の内部 factory で、`.d.ts` には出ない                                                                                                                                               |
| TanStack/form の PR 1606 | 「Allow restricting field component to field value」。draft のまま 2025-11-03 から更新が無い                                                                                                                                                            |

v2 が stable になったら `fieldComponent.strict` へ移せるかを確かめ、移せたら `fieldValue` と `FieldValueTypeCheckProps` を消す。

## 出典

- TanStack/form discussion 1240「Pre-bound Field Components are not typesafe ? (React)」: https://github.com/TanStack/form/discussions/1240
- TanStack/form PR 1606「feat: Allow restricting field component to field value」: https://github.com/TanStack/form/pull/1606
- TanStack Form の Form Composition (pre-bound field components): https://tanstack.com/form/latest/docs/framework/react/guides/form-composition
- `@tanstack/react-form@2.0.0-alpha.2` の `dist/AppForm/getFormHookHelpers.public.d.ts` (`npm pack` で取得して確認、2026-09-23)
