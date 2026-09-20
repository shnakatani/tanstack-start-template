import { revalidateLogic } from "@tanstack/react-form";
import type { ComponentProps } from "react";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import {
  FormCheckboxField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from "@/components/parts/form-fields";
import { useAppForm } from "@/hooks/use-app-form";

const nameSchema = v.pipe(v.string(), v.trim(), v.minLength(1, "名前を入力してください"));

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

function TextHarness({ labelClassName }: { labelClassName?: string }) {
  const form = useAppForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic(),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="name" validators={{ onDynamic: nameSchema }}>
        {(field) => (
          <field.FormTextField
            label="名前"
            fieldValue={field.state.value}
            labelClassName={labelClassName}
          />
        )}
      </form.AppField>
      <button type="submit">保存</button>
    </form>
  );
}

/**
 * トークンをブラウザに解決させて算出値の綴りで受け取る。カスタムプロパティを
 * `getPropertyValue` で読むと `styles.css` に書いた字面がそのまま返るため、`color` の
 * 算出値と直接は比べられない。トークンの値は Tailwind の palette の段を写す約束で、
 * palette 側が `oklch(44.4% ...)` と百分率で書くのに対し、算出値は `oklch(0.444 ...)` に
 * 正規化される (ADR-0024)。
 */
function resolveColorToken(token: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  try {
    return getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }
}

/**
 * 4 部品の配線 (正典ペア、aria-describedby ⇄ FieldError、sanitize、検証エラーの正規化、
 * Select の候補入れ替え、blur 検証) は `form-fields.stories.tsx` の play が持つ (ADR-0022)。
 * ここに残すのは `getComputedStyle` で色を固定する回帰と、上の型テストだけ。
 */
describe("FormTextField", () => {
  it("検証エラーでラベルが destructive 色になる", async () => {
    const screen = await render(<TextHarness />);
    const label = screen.getByText("名前", { exact: true }).element();
    const colorBefore = getComputedStyle(label).color;

    await screen.getByRole("button", { name: "保存" }).click();

    const input = screen.getByRole("textbox", { name: "名前" }).element();
    await vi.waitFor(() => {
      expect(input).toBeInvalid();
    });

    await vi.waitFor(() => {
      expect(getComputedStyle(label).color).not.toBe(colorBefore);
    });
  });

  it("labelClassName の色指定より検証エラー時の destructive 色を優先する", async () => {
    const screen = await render(<TextHarness labelClassName="text-muted-foreground" />);
    const label = screen.getByText("名前", { exact: true }).element();
    const colorBefore = getComputedStyle(label).color;
    const destructiveColor = resolveColorToken("--destructive");

    expect(colorBefore).not.toBe(destructiveColor);

    await screen.getByRole("button", { name: "保存" }).click();

    const input = screen.getByRole("textbox", { name: "名前" }).element();
    await vi.waitFor(() => {
      expect(input).toBeInvalid();
    });
    await vi.waitFor(() => {
      expect(getComputedStyle(label).color).not.toBe(colorBefore);
      expect(getComputedStyle(label).color).toBe(destructiveColor);
    });
  });
});
