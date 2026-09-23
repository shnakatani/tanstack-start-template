import type { ComponentProps } from "react";
import { describe, expectTypeOf, it } from "vite-plus/test";

import {
  FormCheckboxField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from "@/components/parts/form-fields";

// この describe は型のみの検証で、vp test run では評価されず常に pass する。
// 実際に落とすのは vp check の type-aware lint (2026-08-09 実測)。
describe("fieldValue の型契約", () => {
  it("4 部品の期待するフィールド値型を固定する", () => {
    expectTypeOf<ComponentProps<typeof FormTextField>["fieldValue"]>().toEqualTypeOf<string>();
    // 数値フィールドは「空」を表せる必要があるため null を含む (Number("") の 0 に潰さない)
    expectTypeOf<ComponentProps<typeof FormNumberField>["fieldValue"]>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<ComponentProps<typeof FormSelectField>["fieldValue"]>().toEqualTypeOf<string>();
    expectTypeOf<ComponentProps<typeof FormCheckboxField>["fieldValue"]>().toEqualTypeOf<boolean>();
  });
});

/**
 * 4 部品の配線 (正典ペア、aria-describedby ⇄ FieldError、sanitize、検証エラーの正規化、
 * Select の候補入れ替え、blur 検証) は `form-fields.stories.tsx` の play が持つ (ADR-0044)。
 * 検証エラーでラベルが destructive 色になるのは registry の Field が `data-[invalid=true]` で
 * 当てる継承で、`Invalid` story が正典ペアの付与を play で固定する。色は測らない。
 * ここに残すのは型テストだけ。
 */
