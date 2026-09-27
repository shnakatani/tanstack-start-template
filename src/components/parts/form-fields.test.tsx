import type { ComponentProps } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { cdp } from "vite-plus/test/browser/context";
import { render } from "vitest-browser-react";

import {
  FormCheckboxField,
  FormDateField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from "@/components/parts/form-fields";
import { Button } from "@/components/ui/button";
import { useAppForm } from "@/hooks/use-app-form";
import { expectRemoved } from "@/test/assert/absent";

// この describe は型のみの検証で、vp test run では評価されず常に pass する。
// 実際に落とすのは vp check の type-aware lint (2026-08-09 実測)。
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

/**
 * 5 部品の配線 (正典ペア、aria-describedby ⇄ FieldError、sanitize、検証エラーの正規化、
 * Select の候補入れ替え、blur 検証、期日の選択・解除・クリア) は `form-fields.stories.tsx` の play が持つ (docs/guides/storybook.md「カタログと play の範囲」)。
 * 検証エラーでラベルが destructive 色になるのは registry の Field が `data-[invalid=true]` で
 * 当てる継承で、`Invalid` story が正典ペアの付与を play で固定する。色は測らない。
 * ここに残すのは、型テストと、play へ移せないもの (レイアウトの実測、CDP の実イベントで
 * 確かめるキーボード操作、CDP で切り替える TZ) だけ
 * (docs/guides/storybook.md「ブラウザテストから play へ移す」「story とブラウザテストの分担」)。
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

const DATE_LABEL = "期日";

/** 期日を 2026-08-07 で持つフォーム。Calendar はこの月を開く (defaultMonth = 選択中の日) */
function DateHarness({ onSubmit }: { onSubmit: (value: string | null) => void }) {
  const defaultValues: { dueDate: string | null } = { dueDate: "2026-08-07" };
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => {
      onSubmit(value.dueDate);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="dueDate">
        {(field) => (
          <field.FormDateField
            label={DATE_LABEL}
            emptyText="期日なし"
            fieldValue={field.state.value}
          />
        )}
      </form.AppField>
      <Button type="submit">保存</Button>
    </form>
  );
}

describe("FormDateField のキーボード操作", () => {
  it("Enter で開くと選択中の日にフォーカスがあり、矢印と Enter で日を選び、Escape で閉じてトリガーへ戻る", async () => {
    const screen = await render(<DateHarness onSubmit={vi.fn()} />);

    await userEvent.tab();
    await expect
      .element(screen.getByRole("button", { name: `${DATE_LABEL} 2026年8月7日`, exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Enter}");

    // 開くとフォーカスは選択中の日へ移る (Calendar の autoFocus)
    await expect
      .element(screen.getByRole("button", { name: "2026年8月7日金曜日、選択済み", exact: true }))
      .toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    await expect
      .element(screen.getByRole("button", { name: "2026年8月8日土曜日", exact: true }))
      .toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(screen.getByRole("button", { name: `${DATE_LABEL} 2026年8月8日`, exact: true }))
      .toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expectRemoved(screen.getByRole("grid"));
    await expect
      .element(screen.getByRole("button", { name: `${DATE_LABEL} 2026年8月8日`, exact: true }))
      .toHaveFocus();
  });
});

describe("FormDateField のタイムゾーン", () => {
  afterEach(async () => {
    await cdp().send("Emulation.setTimezoneOverride", { timezoneId: "" });
  });

  // UTC より進んだ TZ の 0 時は UTC の前日。toISOString() で文字列にすると 1 日前になる
  // (ADR-0031 の Context)。基準の America/New_York (UTC より遅れた側) ではこのずれは出ない
  it.each(["Asia/Tokyo", "Pacific/Kiritimati"])(
    "%s で選んでも、送信値は選んだ日の YYYY-MM-DD になる",
    async (timezoneId) => {
      await cdp().send("Emulation.setTimezoneOverride", { timezoneId });
      const onSubmit = vi.fn();
      const screen = await render(<DateHarness onSubmit={onSubmit} />);

      await screen.getByRole("button", { name: `${DATE_LABEL} 2026年8月7日`, exact: true }).click();
      await screen.getByRole("button", { name: "2026年8月20日木曜日", exact: true }).click();
      await expect
        .element(screen.getByRole("button", { name: `${DATE_LABEL} 2026年8月20日`, exact: true }))
        .toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      await expectRemoved(screen.getByRole("grid"));
      await screen.getByRole("button", { name: "保存", exact: true }).click();

      await vi.waitFor(() => {
        expect(onSubmit).toHaveBeenCalledExactlyOnceWith("2026-08-20");
      });
    },
  );
});
