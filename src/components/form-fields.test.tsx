import { revalidateLogic } from "@tanstack/react-form";
import { useState, type ComponentProps } from "react";
import * as v from "valibot";
import { afterEach, assert, describe, expect, expectTypeOf, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import {
  FormCheckboxField,
  FormNumberField,
  FormSelectField,
  FormTextField,
  UNRENDERABLE_FIELD_ERROR_MESSAGE,
} from "@/components/form-fields";
import { useAppForm } from "@/hooks/use-app-form";

const nameSchema = v.pipe(v.string(), v.trim(), v.minLength(1, "名前を入力してください"));

afterEach(() => vi.restoreAllMocks());

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

function TextHarness({
  onSubmit,
  disabled = false,
  sanitize,
  labelClassName,
  maxLength,
  validationMode,
}: {
  onSubmit?: (value: string) => void;
  disabled?: boolean;
  sanitize?: (raw: string) => string;
  labelClassName?: string;
  maxLength?: number;
  validationMode?: "submit" | "blur";
}) {
  const form = useAppForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic({ mode: validationMode }),
    onSubmit: ({ value }) => onSubmit?.(value.name),
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
            disabled={disabled}
            sanitize={sanitize}
            labelClassName={labelClassName}
            maxLength={maxLength}
          />
        )}
      </form.AppField>
      <button type="submit">保存</button>
      <button type="button">別の操作</button>
    </form>
  );
}

describe("FormTextField", () => {
  it("検証エラーでラベルが destructive 色になり、aria-describedby がエラー要素と一致する", async () => {
    const screen = await render(<TextHarness />);
    const label = screen.getByText("名前", { exact: true }).element();
    const colorBefore = getComputedStyle(label).color;

    await screen.getByRole("button", { name: "保存" }).click();

    const input = screen.getByRole("textbox", { name: "名前" }).element();
    await vi.waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const error = describedBy === null ? null : document.getElementById(describedBy);
    expect(error?.textContent).toContain("名前を入力してください");

    expect(label.closest("[data-slot=field]")?.getAttribute("data-invalid")).toBe("true");
    await vi.waitFor(() => {
      expect(getComputedStyle(label).color).not.toBe(colorBefore);
    });
  });

  it("labelClassName の色指定より検証エラー時の destructive 色を優先する", async () => {
    const screen = await render(<TextHarness labelClassName="text-muted-foreground" />);
    const label = screen.getByText("名前", { exact: true }).element();
    const colorBefore = getComputedStyle(label).color;
    const destructiveColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--destructive")
      .trim();

    expect(colorBefore).not.toBe(destructiveColor);

    await screen.getByRole("button", { name: "保存" }).click();

    const input = screen.getByRole("textbox", { name: "名前" }).element();
    await vi.waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
    await vi.waitFor(() => {
      expect(getComputedStyle(label).color).not.toBe(colorBefore);
      expect(getComputedStyle(label).color).toBe(destructiveColor);
    });
  });

  it("disabled で正典ペア (Field data-disabled + input disabled) が両方付く", async () => {
    const screen = await render(<TextHarness disabled />);
    const input = screen.getByRole("textbox", { name: "名前" }).element();

    expect(input.hasAttribute("disabled")).toBe(true);
    expect(input.closest("[data-slot=field]")?.getAttribute("data-disabled")).toBe("true");
  });

  it("sanitize が handleChange 前に適用される (数字のみ + maxLength)", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <TextHarness
        onSubmit={onSubmit}
        sanitize={(raw) => raw.replace(/\D/g, "").slice(0, 3)}
        maxLength={8}
      />,
    );

    const input = screen.getByRole("textbox", { name: "名前" });
    expect(input.element().getAttribute("maxlength")).toBe("8");
    await input.fill("a1b2c3d4");
    await screen.getByRole("button", { name: "保存" }).click();

    expect(onSubmit).toHaveBeenCalledWith("123");
  });

  it("blur mode でフォーカスを外すと検証する", async () => {
    const screen = await render(<TextHarness validationMode="blur" />);
    const input = screen.getByRole("textbox", { name: "名前" }).element();

    input.focus();
    screen.getByRole("button", { name: "別の操作" }).element().focus();

    await vi.waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
  });
});

/**
 * standard schema 以外の validator を持つフォーム。関数 validator は `{ message }` ではなく
 * 素の文字列や任意の値を返せるため、FieldError が描ける形へ揃わないと
 * 「aria-invalid は立つが読み上げる内容が無い」状態になる。
 */
function CustomErrorHarness({ error }: { error: unknown }) {
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
      <form.AppField name="name" validators={{ onDynamic: () => error }}>
        {(field) => <field.FormTextField label="名前" fieldValue={field.state.value} />}
      </form.AppField>
      <button type="submit">保存</button>
    </form>
  );
}

describe("検証エラーの正規化", () => {
  async function submitAndReadError(error: unknown) {
    const screen = await render(<CustomErrorHarness error={error} />);
    await screen.getByRole("button", { name: "保存" }).click();

    const input = screen.getByRole("textbox", { name: "名前" }).element();
    await vi.waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    return describedBy === null ? null : document.getElementById(describedBy);
  }

  it("文字列で返された検証エラーも FieldError に描画する", async () => {
    const errorElement = await submitAndReadError("名前を入力してください");

    expect(errorElement?.textContent).toContain("名前を入力してください");
  });

  it("message を持たない検証エラーは代替文言へ丸め、raw 値を warn に残す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rawError = { code: "REQUIRED" };

    const errorElement = await submitAndReadError(rawError);

    expect(errorElement?.textContent).toContain(UNRENDERABLE_FIELD_ERROR_MESSAGE);
    expect(warn).toHaveBeenCalledWith(
      "[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました",
      { error: rawError },
    );
  });
});

const STATUS_OPTIONS = [
  { value: "inactive", label: "無効" },
  { value: "active", label: "有効" },
] as const;
const ARCHIVED_OPTIONS = [{ value: "archived", label: "アーカイブ" }];

function SelectHarness({
  onChangeValue,
  options = STATUS_OPTIONS,
  disabled = false,
  validationMode,
}: {
  onChangeValue?: (value: string) => void;
  options?: readonly { value: string; label: string }[];
  disabled?: boolean;
  validationMode?: "submit" | "blur";
}) {
  const form = useAppForm({
    defaultValues: { type: "inactive" },
    validationLogic: revalidateLogic({ mode: validationMode }),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name="type"
        listeners={{ onChange: ({ value }) => onChangeValue?.(value) }}
        validators={{
          onDynamic: v.pipe(
            v.string(),
            v.check((value) => value === "active", "状態を選択してください"),
          ),
        }}
      >
        {(field) => (
          <field.FormSelectField
            label="状態"
            fieldValue={field.state.value}
            options={options}
            placeholder="状態を選択"
            disabled={disabled}
          />
        )}
      </form.AppField>
      <button type="submit">保存</button>
      <button type="button">別の操作</button>
    </form>
  );
}

function DynamicSelectHarness() {
  const [options, setOptions] =
    useState<readonly { value: string; label: string }[]>(STATUS_OPTIONS);
  const form = useAppForm({
    defaultValues: { type: "inactive" },
    validationLogic: revalidateLogic(),
  });

  return (
    <form>
      <form.AppField name="type">
        {(field) => (
          <>
            <field.FormSelectField
              label="状態"
              fieldValue={field.state.value}
              options={options}
              placeholder="状態を選択"
            />
            <output data-testid="current-value">{field.state.value}</output>
          </>
        )}
      </form.AppField>
      {/* 現在値 (有効) だけでなく初期値 (無効) も消す。初期値が残ると base-ui は null では
          なくマウント時の値へ差し戻すため、null 経路を通せない */}
      <button type="button" onClick={() => setOptions(ARCHIVED_OPTIONS)}>
        候補を入れ替える
      </button>
    </form>
  );
}

describe("FormSelectField", () => {
  it("選択肢を選ぶと値が入り、SelectValue に選択ラベルが出る", async () => {
    const onChangeValue = vi.fn();
    const screen = await render(<SelectHarness onChangeValue={onChangeValue} />);

    const trigger = screen.getByRole("combobox", { name: "状態" });
    await trigger.click();
    await screen.getByRole("option", { name: "有効" }).click();

    expect(onChangeValue).toHaveBeenCalledWith("active");
    expect(trigger.element().textContent).toContain("有効");
  });

  it("options 外の値は form 値へ流さず、配線不整合を警告する", async () => {
    const options = STATUS_OPTIONS.map((option) => ({ ...option }));
    const onChangeValue = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const screen = await render(<SelectHarness options={options} onChangeValue={onChangeValue} />);

    // 描画済みの option は残したまま突合だけを失敗させ、Base UI から options 外の値が
    // 通知された配線不整合を実コンポーネントの onValueChange 経由で再現する。
    // 同じ options が描画と突合を担い、配列操作では handleBlur 後の再描画で option も DOM から消えるため find だけ制御する。
    vi.spyOn(options, "find").mockReturnValue(undefined);
    await screen.getByRole("combobox", { name: "状態" }).click();
    await screen.getByRole("option", { name: "有効" }).click();

    expect(onChangeValue).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[FormSelectField] options にない値を受け取りました", {
      value: "active",
      options,
    });
  });

  it("options が減って現在値が消えても警告し、form 値を保持する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const screen = await render(<DynamicSelectHarness />);

    // トリガーを一度フォーカスしないと項目が mount されず、base-ui は候補の変化を通知しない
    const trigger = screen.getByRole("combobox", { name: "状態" });
    await trigger.click();
    await screen.getByRole("option", { name: "有効" }).click();
    expect(screen.getByTestId("current-value").element().textContent).toBe("active");

    await screen.getByRole("button", { name: "候補を入れ替える" }).click();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "[FormSelectField] 候補から現在値が消えました。値は保持します",
        { currentValue: "active", options: ARCHIVED_OPTIONS },
      );
    });
    expect(screen.getByTestId("current-value").element().textContent).toBe("active");
  });

  it("disabled で正典ペア (Field data-disabled + trigger disabled) が両方付く", async () => {
    const screen = await render(<SelectHarness disabled />);
    const trigger = screen.getByRole("combobox", { name: "状態" }).element();

    expect(trigger.hasAttribute("disabled")).toBe(true);
    expect(trigger.closest("[data-slot=field]")?.getAttribute("data-disabled")).toBe("true");
  });

  it("検証エラー時に aria-describedby が FieldError の id と一致する", async () => {
    const screen = await render(<SelectHarness />);

    await screen.getByRole("button", { name: "保存" }).click();

    const trigger = screen.getByRole("combobox", { name: "状態" }).element();
    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-invalid")).toBe("true");
    });
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const error = describedBy === null ? null : document.getElementById(describedBy);
    expect(error?.textContent).toContain("状態を選択してください");
  });

  it("blur mode でトリガーからフォーカスを外すと検証する", async () => {
    const screen = await render(<SelectHarness validationMode="blur" />);
    const trigger = screen.getByRole("combobox", { name: "状態" }).element();

    trigger.focus();
    screen.getByRole("button", { name: "別の操作" }).element().focus();

    await vi.waitFor(() => {
      expect(trigger.getAttribute("aria-invalid")).toBe("true");
    });
  });
});

function CheckboxHarness({ validate = false }: { validate?: boolean }) {
  const form = useAppForm({
    defaultValues: { canEdit: false },
    validationLogic: revalidateLogic(),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name="canEdit"
        validators={
          validate
            ? {
                onDynamic: v.pipe(
                  v.boolean(),
                  v.check((value) => value, "編集可を選択してください"),
                ),
              }
            : undefined
        }
      >
        {(field) => (
          <field.FormCheckboxField
            label="編集者として割り当て可能"
            fieldValue={field.state.value}
          />
        )}
      </form.AppField>
      <button type="submit">保存</button>
    </form>
  );
}

describe("FormCheckboxField", () => {
  it("ラベルクリックで checkbox がトグルする (htmlFor 紐付け)", async () => {
    const screen = await render(<CheckboxHarness />);

    await screen.getByText("編集者として割り当て可能").click();

    expect(
      screen
        .getByRole("checkbox", { name: "編集者として割り当て可能" })
        .element()
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("validators つきで誤用すると表示不能な検証エラーを警告する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const screen = await render(<CheckboxHarness validate />);

    await screen.getByRole("button", { name: "保存" }).click();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "[FormCheckboxField] 検証エラーを表示できません (FieldError 非対応)",
        {
          label: "編集者として割り当て可能",
          errors: [expect.objectContaining({ message: "編集可を選択してください" })],
        },
      );
    });
  });
});

function NumberHarness({
  onSubmit,
  onChangeValue,
  validate = false,
  validationMode,
}: {
  onSubmit?: (value: number | null) => void;
  onChangeValue?: (value: number | null) => void;
  validate?: boolean;
  validationMode?: "submit" | "blur";
}) {
  const initialValues: { sortOrder: number | null } = { sortOrder: 1 };
  const form = useAppForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic({ mode: validationMode }),
    onSubmit: ({ value }) => onSubmit?.(value.sortOrder),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField
        name="sortOrder"
        listeners={{ onChange: ({ value }) => onChangeValue?.(value) }}
        validators={
          validate
            ? {
                onDynamic: v.pipe(v.number(), v.minValue(2, "並び順は2以上で入力してください")),
              }
            : undefined
        }
      >
        {(field) => <field.FormNumberField label="並び順" fieldValue={field.state.value} />}
      </form.AppField>
      <button type="submit">保存</button>
      <button type="button">別の操作</button>
    </form>
  );
}

describe("FormNumberField", () => {
  // NumberField は controlled な type="text" なので、locator の fill() は既存値を置換せず
  // 追記になる (初期値 1 に "3" を入れると 13)。利用者の操作に合わせて全選択してから打つ
  function typeInto(element: HTMLInputElement, keys: string): Promise<void> {
    element.focus();
    element.select();
    return userEvent.keyboard(keys);
  }

  function numberInput(screen: Awaited<ReturnType<typeof render>>): HTMLInputElement {
    const element = screen.getByRole("textbox", { name: "並び順" }).element();
    assert(element instanceof HTMLInputElement, "並び順の textbox が input ではない");
    return element;
  }

  it("入力値が number として form 値に入る", async () => {
    const onSubmit = vi.fn();
    const screen = await render(<NumberHarness onSubmit={onSubmit} />);

    await typeInto(numberInput(screen), "3");
    await screen.getByRole("button", { name: "保存" }).click();

    expect(onSubmit).toHaveBeenCalledWith(3);
  });

  // 空を値として持てないと、一度入れた数値を取り消せない (0 が有効値のフィールドでは
  // 検証でも救えない)。NumberField は空入力を null で返す
  it("入力を消すと表示は空のままで、form 値は null になる", async () => {
    const onSubmit = vi.fn();
    const screen = await render(<NumberHarness onSubmit={onSubmit} />);
    const element = numberInput(screen);

    await typeInto(element, "{Backspace}");
    expect(element.value).toBe("");

    await screen.getByRole("button", { name: "保存" }).click();
    expect(onSubmit).toHaveBeenCalledWith(null);
  });

  // type="text" なのでブラウザの badInput は起きず、パースは NumberField が行う。数値として
  // 読める前置部分を採り、表示も commit した値へ正規化する。利用者から見て、入力欄の表示と
  // form が持つ値が食い違ったままにならないことをここで固定する
  it("数値でない文字を含む入力は、表示と commit 値が揃う", async () => {
    const onChangeValue = vi.fn();
    const screen = await render(<NumberHarness onChangeValue={onChangeValue} />);
    const element = numberInput(screen);

    // 初期値 1 と同じ結果になる入力だと form の onChange が発火しないため 2 から始める
    await typeInto(element, "2e");

    expect(onChangeValue).toHaveBeenLastCalledWith(2);
    expect(element.value).toBe("2");
  });

  it("検証エラー時に aria-describedby が FieldError の id と一致する", async () => {
    const screen = await render(<NumberHarness validate />);

    await screen.getByRole("button", { name: "保存" }).click();

    const input = screen.getByRole("textbox", { name: "並び順" }).element();
    await vi.waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const error = describedBy === null ? null : document.getElementById(describedBy);
    expect(error?.textContent).toContain("並び順は2以上で入力してください");
  });

  it("blur mode でフォーカスを外すと検証する", async () => {
    const screen = await render(<NumberHarness validate validationMode="blur" />);
    const input = screen.getByRole("textbox", { name: "並び順" }).element();

    input.focus();
    screen.getByRole("button", { name: "別の操作" }).element().focus();

    await vi.waitFor(() => {
      expect(input.getAttribute("aria-invalid")).toBe("true");
    });
  });
});
