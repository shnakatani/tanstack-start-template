import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { revalidateLogic } from "@tanstack/react-form";
import { useState } from "react";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { useAppForm } from "@/hooks/use-app-form";

import { UNRENDERABLE_FIELD_ERROR_MESSAGE } from "./form-fields";

/**
 * `form.AppField` の内側でしか動かない配線部品なので、story も TanStack Form の
 * harness ごと組む。カタログの本体は `FieldsForm` で、4 種のフィールドを 1 つのフォームへ
 * 並べる。
 *
 * ラベルの色 (`fieldLabelClassName` の合成順) は `getComputedStyle` で固定する回帰として
 * `form-fields.test.tsx` に残る。`fieldValue` の型契約も `expectTypeOf` のまま残る
 * (ADR-0049)。
 */

const nameSchema = v.pipe(v.string(), v.trim(), v.minLength(1, "名前を入力してください"));
const sortOrderSchema = v.pipe(v.number(), v.minValue(2, "並び順は2以上で入力してください"));
const statusSchema = v.pipe(
  v.string(),
  v.check((value) => value === "active", "状態を選択してください"),
);
const canEditSchema = v.pipe(
  v.boolean(),
  v.check((value) => value, "編集可を選択してください"),
);

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "inactive", label: "無効" },
  { value: "active", label: "有効" },
];
/** 突合だけを失敗させるため、描画と突合を担う配列をこの story 専用に持つ */
const UNMATCHABLE_OPTIONS = STATUS_OPTIONS.map((option) => ({ ...option }));
const ARCHIVED_OPTIONS = [{ value: "archived", label: "アーカイブ" }];

const RAW_ERROR = { code: "REQUIRED" };

/** console.warn を黙らせつつ呼び出しを記録する。story が終わったら復元する */
const consoleWarn = fn();
function captureConsoleWarn() {
  consoleWarn.mockClear();
  const spy = spyOn(console, "warn").mockImplementation(consoleWarn);
  return () => {
    spy.mockRestore();
  };
}

interface StoryArgs {
  /** 検証の発火モード。`blur` はフォーカスが外れた時点で検証する */
  validationMode: "submit" | "blur";
  /** `FormTextField` と `FormSelectField` を無効にする */
  disabled: boolean;
  /** `FormSelectField` の候補 */
  options: readonly { value: string; label: string }[];
  /** `FormCheckboxField` に validators を付ける (FieldError 非対応の誤用) */
  validateCheckbox: boolean;
  /** 送信された値。フィールドごとに型が違うため unknown で受ける */
  onSubmit: (value: unknown) => void;
  /** フィールドの値が変わったときの通知 */
  onChangeValue: (value: unknown) => void;
}

interface CatalogValues {
  name: string;
  sortOrder: number | null;
  type: string;
  canEdit: boolean;
}

/** 4 種のフィールドを 1 つのフォームへ並べたカタログ本体 */
function FieldsForm({
  validationMode,
  disabled,
  options,
  validateCheckbox,
  onSubmit,
  onChangeValue,
}: StoryArgs) {
  const defaultValues: CatalogValues = {
    name: "",
    sortOrder: 1,
    type: "inactive",
    canEdit: false,
  };
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({ mode: validationMode }),
    onSubmit: ({ value }) => {
      onSubmit(value);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.AppField name="name" validators={{ onDynamic: nameSchema }}>
          {(field) => (
            <field.FormTextField
              label="名前"
              fieldValue={field.state.value}
              placeholder="氏名を入力"
              disabled={disabled}
            />
          )}
        </form.AppField>
        <form.AppField name="sortOrder" validators={{ onDynamic: sortOrderSchema }}>
          {(field) => (
            <field.FormNumberField
              label="並び順"
              fieldValue={field.state.value}
              disabled={disabled}
            />
          )}
        </form.AppField>
        <form.AppField
          name="type"
          listeners={{ onChange: ({ value }) => onChangeValue(value) }}
          validators={{ onDynamic: statusSchema }}
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
        <form.AppField
          name="canEdit"
          validators={validateCheckbox ? { onDynamic: canEditSchema } : undefined}
        >
          {(field) => (
            <field.FormCheckboxField
              label="編集者として割り当て可能"
              fieldValue={field.state.value}
              disabled={disabled}
            />
          )}
        </form.AppField>
        <Field orientation="horizontal">
          <Button type="submit">保存</Button>
          <Button type="button" variant="outline">
            別の操作
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

/** sanitize と maxLength を見るための単独フォーム。他フィールドの検証で submit が止まらない */
function SanitizedTextForm({ onSubmit }: StoryArgs) {
  const form = useAppForm({
    defaultValues: { name: "" },
    validationLogic: revalidateLogic(),
    onSubmit: ({ value }) => {
      onSubmit(value.name);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.AppField name="name">
          {(field) => (
            <field.FormTextField
              label="名前"
              fieldValue={field.state.value}
              sanitize={(raw) => raw.replace(/\D/g, "").slice(0, 3)}
              maxLength={8}
            />
          )}
        </form.AppField>
        <Field orientation="horizontal">
          <Button type="submit">保存</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

/**
 * standard schema 以外の validator を持つフォーム。関数 validator は `{ message }` ではなく
 * 素の文字列や任意の値を返せるため、FieldError が描ける形へ揃わないと
 * 「aria-invalid は立つが読み上げる内容が無い」状態になる。
 */
function CustomErrorForm({ error }: { error: unknown }) {
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
      <FieldGroup>
        <form.AppField name="name" validators={{ onDynamic: () => error }}>
          {(field) => <field.FormTextField label="名前" fieldValue={field.state.value} />}
        </form.AppField>
        <Field orientation="horizontal">
          <Button type="submit">保存</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

/** 候補を丸ごと入れ替えるフォーム。現在値も初期値も候補から消す */
function ReplaceableSelectForm({ onChangeValue }: StoryArgs) {
  const [options, setOptions] =
    useState<readonly { value: string; label: string }[]>(STATUS_OPTIONS);
  const form = useAppForm({
    defaultValues: { type: "inactive" },
    validationLogic: revalidateLogic(),
  });

  return (
    <form>
      <FieldGroup>
        <form.AppField name="type" listeners={{ onChange: ({ value }) => onChangeValue(value) }}>
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
        <Field orientation="horizontal">
          {/* 現在値 (有効) だけでなく初期値 (無効) も消す。初期値が残ると base-ui は null では
              なくマウント時の値へ差し戻すため、null 経路を通せない */}
          <Button type="button" variant="outline" onClick={() => setOptions(ARCHIVED_OPTIONS)}>
            候補を入れ替える
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

/** 数値フィールド単独のフォーム。他フィールドの検証で submit が止まらない */
function NumberForm({ onSubmit, onChangeValue }: StoryArgs) {
  const defaultValues: { sortOrder: number | null } = { sortOrder: 1 };
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    onSubmit: ({ value }) => {
      onSubmit(value.sortOrder);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.AppField
          name="sortOrder"
          listeners={{ onChange: ({ value }) => onChangeValue(value) }}
        >
          {(field) => <field.FormNumberField label="並び順" fieldValue={field.state.value} />}
        </form.AppField>
        <Field orientation="horizontal">
          <Button type="submit">保存</Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

/** NumberField は type="text" なので、locator 相当の入力は追記になる。全選択してから打つ */
function textbox(name: string): HTMLInputElement {
  const element = screen.getByRole("textbox", { name });
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`[story] ${name} の textbox が input ではない`);
  }
  return element;
}

async function replaceValue(element: HTMLInputElement, keys: string): Promise<void> {
  element.focus();
  element.select();
  await userEvent.keyboard(keys);
}

function blurTo(element: HTMLElement): void {
  element.focus();
  screen.getByRole("button", { name: "別の操作" }).focus();
}

async function chooseStatus(label: string): Promise<void> {
  await userEvent.click(screen.getByRole("combobox", { name: "状態" }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
  // popup の unmount を待ってから終える。待たないと a11y 検査が animate-out の窓に入る
  await waitFor(() =>
    expect(screen.queryByRole("option", { name: label })).not.toBeInTheDocument(),
  );
}

const meta = {
  // useAppForm は mount 時の validationLogic を握る。key を付けないと control で
  // validationMode を変えても再描画されるだけで効かず、動かない knob が残る
  render: (args) => <FieldsForm key={args.validationMode} {...args} />,
  args: {
    validationMode: "submit",
    disabled: false,
    options: STATUS_OPTIONS,
    validateCheckbox: false,
    onSubmit: fn(),
    onChangeValue: fn(),
  },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 既定。text / number / select / checkbox の 4 種が並ぶ */
export const Default: Story = {};

/**
 * 検証エラー。正典ペア (`Field` の `data-invalid` + 入力の `aria-invalid`) が両方付き、
 * `aria-describedby` が `FieldError` の id と一致する
 */
export const Invalid: Story = {
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const name = textbox("名前");
    await waitFor(() => expect(name).toBeInvalid());
    await expect(name.closest("[data-slot=field]")).toHaveAttribute("data-invalid", "true");
    await expect(name).toHaveAccessibleDescription(/名前を入力してください/);

    const sortOrder = textbox("並び順");
    await expect(sortOrder).toBeInvalid();
    await expect(sortOrder).toHaveAccessibleDescription(/並び順は2以上で入力してください/);

    const status = screen.getByRole("combobox", { name: "状態" });
    await expect(status).toBeInvalid();
    await expect(status).toHaveAccessibleDescription(/状態を選択してください/);
  },
};

/** 無効表示。4 部品とも正典ペア (`Field` の `data-disabled` + 入力の `disabled`) が付く */
export const Disabled: Story = {
  args: { disabled: true },
  play: async () => {
    const name = textbox("名前");
    await expect(name).toBeDisabled();
    await expect(name.closest("[data-slot=field]")).toHaveAttribute("data-disabled", "true");

    const sortOrder = textbox("並び順");
    await expect(sortOrder).toBeDisabled();
    await expect(sortOrder.closest("[data-slot=field]")).toHaveAttribute("data-disabled", "true");

    const status = screen.getByRole("combobox", { name: "状態" });
    await expect(status).toBeDisabled();
    await expect(status.closest("[data-slot=field]")).toHaveAttribute("data-disabled", "true");

    // getByRole("checkbox") が返すのは span なので aria で見る。native の disabled は
    // 隣の隠し input が持つが、aria-hidden で accessibility tree に出ない
    const canEdit = screen.getByRole("checkbox", { name: "編集者として割り当て可能" });
    await expect(canEdit).toHaveAttribute("aria-disabled", "true");
    await expect(canEdit.closest("[data-slot=field]")).toHaveAttribute("data-disabled", "true");
  },
};

/** blur mode では各フィールドからフォーカスを外した時点で検証する */
export const ValidatesOnBlur: Story = {
  tags: ["!dev"],
  args: { validationMode: "blur" },
  play: async () => {
    const name = textbox("名前");
    blurTo(name);
    await waitFor(() => expect(name).toBeInvalid());

    const sortOrder = textbox("並び順");
    blurTo(sortOrder);
    await waitFor(() => expect(sortOrder).toBeInvalid());

    const status = screen.getByRole("combobox", { name: "状態" });
    blurTo(status);
    await waitFor(() => expect(status).toBeInvalid());
  },
};

/** 選択肢を選ぶと値が入り、`SelectValue` に選択ラベルが出る */
export const SelectsOption: Story = {
  tags: ["!dev"],
  play: async ({ args }) => {
    await chooseStatus("有効");

    await expect(args.onChangeValue).toHaveBeenCalledTimes(1);
    await expect(args.onChangeValue).toHaveBeenCalledWith("active");
    await expect(screen.getByRole("combobox", { name: "状態" })).toHaveTextContent("有効");
  },
};

/** options 外の値は form 値へ流さず、配線不整合を警告する */
export const SelectRejectsUnknownValue: Story = {
  tags: ["!dev"],
  args: { options: UNMATCHABLE_OPTIONS },
  beforeEach: captureConsoleWarn,
  play: async ({ args }) => {
    // 描画済みの option は残したまま突合だけを失敗させ、Base UI から options 外の値が
    // 通知された配線不整合を実コンポーネントの onValueChange 経由で再現する
    const lookup = spyOn(UNMATCHABLE_OPTIONS, "find").mockReturnValue(undefined);
    await chooseStatus("有効");
    lookup.mockRestore();

    await expect(args.onChangeValue).not.toHaveBeenCalled();
    await expect(consoleWarn).toHaveBeenCalledWith(
      "[FormSelectField] options にない値を受け取りました",
      { value: "active", options: UNMATCHABLE_OPTIONS },
    );
  },
};

/** options が減って現在値が消えても警告し、form 値を保持する */
export const SelectKeepsValueWhenOptionsReplaced: Story = {
  tags: ["!dev"],
  render: (args) => <ReplaceableSelectForm {...args} />,
  beforeEach: captureConsoleWarn,
  play: async () => {
    // トリガーを一度フォーカスしないと項目が mount されず、base-ui は候補の変化を通知しない
    await chooseStatus("有効");
    await expect(screen.getByTestId("current-value")).toHaveTextContent(/^active$/);

    await userEvent.click(screen.getByRole("button", { name: "候補を入れ替える" }));

    await waitFor(() =>
      expect(consoleWarn).toHaveBeenCalledWith(
        "[FormSelectField] 候補から現在値が消えました。値は保持します",
        { currentValue: "active", options: ARCHIVED_OPTIONS },
      ),
    );
    await expect(screen.getByTestId("current-value")).toHaveTextContent(/^active$/);
  },
};

/** ラベルクリックで checkbox がトグルする (htmlFor 紐付け) */
export const TogglesCheckbox: Story = {
  tags: ["!dev"],
  play: async () => {
    await userEvent.click(screen.getByText("編集者として割り当て可能"));

    await expect(screen.getByRole("checkbox", { name: "編集者として割り当て可能" })).toBeChecked();
  },
};

/** validators つきで誤用すると、表示できない検証エラーを警告する */
export const CheckboxValidatorsWarn: Story = {
  tags: ["!dev"],
  args: { validateCheckbox: true },
  beforeEach: captureConsoleWarn,
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(consoleWarn).toHaveBeenCalledWith(
        "[FormCheckboxField] 検証エラーを表示できません (FieldError 非対応)",
        {
          label: "編集者として割り当て可能",
          errors: [expect.objectContaining({ message: "編集可を選択してください" })],
        },
      ),
    );
  },
};

/** sanitize が handleChange の前に適用される (数字のみ + 3 文字) */
export const SanitizesInput: Story = {
  tags: ["!dev"],
  render: (args) => <SanitizedTextForm {...args} />,
  play: async ({ args }) => {
    const name = textbox("名前");
    await expect(name).toHaveAttribute("maxlength", "8");
    await userEvent.type(name, "a1b2c3d4");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledWith("123"));
  },
};

/** 文字列で返された検証エラーも FieldError に描画する */
export const StringErrorRendered: Story = {
  tags: ["!dev"],
  render: () => <CustomErrorForm error="名前を入力してください" />,
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const name = textbox("名前");
    await waitFor(() => expect(name).toBeInvalid());
    await expect(name).toHaveAccessibleDescription(/名前を入力してください/);
  },
};

/** message を持たない検証エラーは代替文言へ丸め、raw 値を warn に残す */
export const UnrenderableErrorFallback: Story = {
  tags: ["!dev"],
  render: () => <CustomErrorForm error={RAW_ERROR} />,
  beforeEach: captureConsoleWarn,
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const name = textbox("名前");
    await waitFor(() => expect(name).toBeInvalid());
    await expect(name).toHaveAccessibleDescription(new RegExp(UNRENDERABLE_FIELD_ERROR_MESSAGE));
    await expect(consoleWarn).toHaveBeenCalledWith(
      "[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました",
      { error: RAW_ERROR },
    );
  },
};

/** 入力値が number として form 値に入る */
export const NumberCommitted: Story = {
  tags: ["!dev"],
  render: (args) => <NumberForm {...args} />,
  play: async ({ args }) => {
    await replaceValue(textbox("並び順"), "3");
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledWith(3));
  },
};

/**
 * 入力を消すと表示は空のままで、form 値は null になる。
 * 空を値として持てないと、一度入れた数値を取り消せない (0 が有効値のフィールドでは検証でも救えない)
 */
export const NumberCleared: Story = {
  tags: ["!dev"],
  render: (args) => <NumberForm {...args} />,
  play: async ({ args }) => {
    const sortOrder = textbox("並び順");
    await replaceValue(sortOrder, "{Backspace}");
    await expect(sortOrder).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(args.onSubmit).toHaveBeenCalledWith(null));
  },
};

/**
 * 数値でない文字を含む入力は、表示と commit 値が揃う。
 * type="text" なのでブラウザの badInput は起きず、パースは NumberField が行う
 */
export const NumberNormalizesInput: Story = {
  tags: ["!dev"],
  render: (args) => <NumberForm {...args} />,
  play: async ({ args }) => {
    const sortOrder = textbox("並び順");
    // 初期値 1 と同じ結果になる入力だと form の onChange が発火しないため 2 から始める
    await replaceValue(sortOrder, "2e");

    await waitFor(() => expect(args.onChangeValue).toHaveBeenLastCalledWith(2));
    await expect(sortOrder).toHaveValue("2");
  },
};
