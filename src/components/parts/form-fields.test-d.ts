import type { ComponentProps } from "react";
import { describe, expectTypeOf, it } from "vite-plus/test";

import type {
  FormCheckboxField,
  FormDateField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from "@/components/parts/form-fields";

// 部品が期待するフィールド値型を固定する (docs/guides/forms-and-inputs.md「`fieldComponents` の部品を書く」)。
// 検査のされ方は (docs/guides/testing/type-tests.md「型テストを置く」)
describe("fieldValue の型契約", () => {
  it("5 部品の期待するフィールド値型を固定する", () => {
    expectTypeOf<ComponentProps<typeof FormTextField>["fieldValue"]>().toEqualTypeOf<string>();
    // 数値フィールドは「空」を表せる必要があるため null を含む (Number("") の 0 に潰さない)
    expectTypeOf<ComponentProps<typeof FormNumberField>["fieldValue"]>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<ComponentProps<typeof FormSelectField>["fieldValue"]>().toEqualTypeOf<string>();
    expectTypeOf<ComponentProps<typeof FormCheckboxField>["fieldValue"]>().toEqualTypeOf<boolean>();
    // 期日なしを null で持つ。空文字や undefined に潰さない (ADR-0031 の分類 2 は YYYY-MM-DD か null)
    expectTypeOf<ComponentProps<typeof FormDateField>["fieldValue"]>().toEqualTypeOf<
      string | null
    >();
  });
});
