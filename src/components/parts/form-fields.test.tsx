import type { ComponentProps } from "react";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import {
  FormCheckboxField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from "@/components/parts/form-fields";
import { useAppForm } from "@/hooks/use-app-form";

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
 * Select の候補入れ替え、blur 検証) は `form-fields.stories.tsx` の play が持つ (docs/guides/storybook.md「カタログと play の範囲」)。
 * 検証エラーでラベルが destructive 色になるのは registry の Field が `data-[invalid=true]` で
 * 当てる継承で、`Invalid` story が正典ペアの付与を play で固定する。色は測らない。
 * ここに残すのは、型テストと、play へ移せないレイアウトの実測 (押せる範囲) だけ
 * (docs/guides/storybook.md「ブラウザテストから play へ移す」)。
 */

const CHECKBOX_LABEL = "編集者として割り当て可能";

/** 行より十分広い器に 1 つだけ置く。器の右寄りを押して、ラベルが行の幅へ伸びていないかを見る */
function CheckboxHarness() {
  const form = useAppForm({ defaultValues: { canEdit: false } });
  return (
    <div data-testid="row-container" className="w-96">
      <form.AppField name="canEdit">
        {(field) => (
          <field.FormCheckboxField label={CHECKBOX_LABEL} fieldValue={field.state.value} />
        )}
      </form.AppField>
    </div>
  );
}

describe("FormCheckboxField の押せる範囲", () => {
  // 下の否定のテストは click が行を外れても緑になるので、x だけを変えた同じクリックが
  // ラベルの文字 (x は約 28-195px) では届くことを先に固定する (docs/guides/testing/waiting-and-assertions.md「否定を肯定で書く」)
  it("ラベルの文字を押すとトグルする", async () => {
    const screen = await render(<CheckboxHarness />);

    await screen.getByTestId("row-container").click({ position: { x: 100, y: 8 } });

    await expect
      .element(screen.getByRole("checkbox", { name: CHECKBOX_LABEL }))
      .toHaveAttribute("data-checked");
  });

  // registry の horizontal Field は子の FieldLabel に flex-auto を当て、Field は w-full なので、
  // 何もしなければラベルが行の右端まで伸びて余白でもトグルする。x は文字の右端 (約 195px) より右
  it("ラベルの文字より右の余白を押してもトグルしない", async () => {
    const screen = await render(<CheckboxHarness />);

    await screen.getByTestId("row-container").click({ position: { x: 320, y: 8 } });

    await expect
      .element(screen.getByRole("checkbox", { name: CHECKBOX_LABEL }))
      .not.toHaveAttribute("data-checked");
  });
});
