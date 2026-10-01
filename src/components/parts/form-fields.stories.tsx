import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { revalidateLogic } from "@tanstack/react-form";
import { useState } from "react";
import { expect, fn, screen, spyOn, userEvent, waitFor } from "storybook/test";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import { excludeFromA11y } from "@/components/ui/calendar.story-helpers";
import { Field, FieldGroup } from "@/components/ui/field";
import { useAppForm } from "@/hooks/use-app-form";
import { UNRENDERABLE_FIELD_ERROR_MESSAGE } from "@/lib/field-errors";

/**
 * `form.AppField` の内側でしか動かない配線部品なので、story も TanStack Form の
 * harness ごと組む。カタログの本体は `FieldsForm` で、5 種のフィールドを 1 つのフォームへ
 * 並べる。
 *
 * ラベルの色 (`fieldLabelClassName` の合成順) は `getComputedStyle` で固定する回帰として
 * `form-fields.test.tsx` に残る。`fieldValue` の型契約は `form-fields.test-d.ts` が持つ
 * (docs/guides/storybook.md「story とブラウザテストの分担」)。
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
const dueDateSchema = v.pipe(
  v.nullable(v.string()),
  v.check((value) => value !== null, "期日を選択してください"),
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
  /** `FieldsForm` の全フィールド (text / number / select / date / checkbox) を無効にする */
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
  dueDate: string | null;
  canEdit: boolean;
}

/** 5 種のフィールドを 1 つのフォームへ並べたカタログ本体 */
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
    dueDate: null,
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
        <form.AppField name="dueDate" validators={{ onDynamic: dueDateSchema }}>
          {(field) => (
            <field.FormDateField
              label="期日"
              emptyText="期日なし"
              fieldValue={field.state.value}
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

/** sanitize を見るための単独フォーム。他フィールドの検証で submit が止まらない */
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
function CustomErrorForm({
  error,
  disableErrorFlat,
}: {
  error: unknown;
  disableErrorFlat?: boolean;
}) {
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
        <form.AppField
          name="name"
          disableErrorFlat={disableErrorFlat}
          validators={{ onDynamic: () => error }}
        >
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
function ReplaceableSelectForm({ onChangeValue, onSubmit }: StoryArgs) {
  const [options, setOptions] =
    useState<readonly { value: string; label: string }[]>(STATUS_OPTIONS);
  const form = useAppForm({
    defaultValues: { type: "inactive" },
    validationLogic: revalidateLogic(),
    onSubmit: ({ value }) => {
      onSubmit(value.type);
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
          name="type"
          listeners={{ onChange: ({ value }) => onChangeValue(value) }}
          // 候補から消えた値のまま保存させない。FormSelectField は値を保持するだけで、
          // 保存を止めるのは消費側の validator (docs/guides/forms-and-inputs.md「Select の値を解決する」)
          validators={{
            onDynamic: v.pipe(
              v.string(),
              v.check(
                (value) => options.some((option) => option.value === value),
                "選び直してください",
              ),
            ),
          }}
        >
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
          <Button type="submit">送信</Button>
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

/** 期日フィールド単独のフォーム。2026-08-07 を持ち、Calendar はその月を開く */
function DateForm({ onChangeValue }: StoryArgs) {
  const defaultValues: { dueDate: string | null } = { dueDate: "2026-08-07" };
  const form = useAppForm({ defaultValues });

  return (
    <form.AppField name="dueDate" listeners={{ onChange: ({ value }) => onChangeValue(value) }}>
      {(field) => (
        <field.FormDateField label="期日" emptyText="期日なし" fieldValue={field.state.value} />
      )}
    </form.AppField>
  );
}

function textbox(name: string): HTMLInputElement {
  const element = screen.getByRole("textbox", { name });
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`[story] ${name} の textbox が input ではない`);
  }
  return element;
}

/**
 * `storybook/test` の `userEvent` は `fill` を持たず、focus して `keyboard` で打つと既存の値に
 * 追記になる。値を置き換えるので全選択してから打つ。Vitest の locator の `fill()` は既存の値を
 * 置き換えるので、テストではこの手順は要らない
 */
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

/** トリガーの名前はラベルと表示中の値をつないだもの (FormDateField の docstring) */
const DATE_TRIGGER_WITH_VALUE = "期日 2026年8月7日";
const DATE_TRIGGER_EMPTY = "期日 期日なし";

async function openDatePicker(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: DATE_TRIGGER_WITH_VALUE }));
  await screen.findByRole("grid");
}

async function closeDatePicker(): Promise<void> {
  await userEvent.keyboard("{Escape}");
  await waitForDatePickerUnmount();
}

/** popup の unmount を待ってから終える。待たないと a11y 検査が animate-out の窓に入る */
async function waitForDatePickerUnmount(): Promise<void> {
  await waitFor(() => expect(screen.queryByRole("grid")).not.toBeInTheDocument());
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

/** 既定。text / number / select / date / checkbox の 5 種が並ぶ */
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

    const dueDate = screen.getByRole("button", { name: DATE_TRIGGER_EMPTY });
    await expect(dueDate).toBeInvalid();
    await expect(dueDate).toHaveAccessibleDescription(/期日を選択してください/);
  },
};

/** 無効表示。5 部品とも正典ペア (`Field` の `data-disabled` + 入力の `disabled`) が付く */
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

    const dueDate = screen.getByRole("button", { name: DATE_TRIGGER_EMPTY });
    await expect(dueDate).toBeDisabled();
    await expect(dueDate.closest("[data-slot=field]")).toHaveAttribute("data-disabled", "true");

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

    const dueDate = screen.getByRole("button", { name: DATE_TRIGGER_EMPTY });
    blurTo(dueDate);
    await waitFor(() => expect(dueDate).toBeInvalid());
  },
};

/**
 * blur mode の期日は、Popover を開いてフォーカスが popup へ移っても検証しない。日を選んでいる
 * 最中に「期日を選択してください」を出さない。閉じたときに検証する。開かずに通り過ぎたときの
 * 検証は `ValidatesOnBlur` が見る
 */
export const DateValidatesOnClose: Story = {
  tags: ["!dev"],
  args: { validationMode: "blur" },
  play: async () => {
    const dueDate = screen.getByRole("button", { name: DATE_TRIGGER_EMPTY });
    await userEvent.click(dueDate);
    await screen.findByRole("grid");
    // フォーカスが popup へ移り、トリガーの blur が起きた後で見る。値が無いので今日の日へ移る
    await waitFor(() => expect(screen.getByRole("button", { name: /^今日、/ })).toHaveFocus());
    await expect(dueDate).not.toBeInvalid();

    await closeDatePicker();

    await waitFor(() => expect(dueDate).toBeInvalid());
    await expect(dueDate).toHaveAccessibleDescription(/期日を選択してください/);
  },
};

/** 外側を押して閉じたときも、`DateValidatesOnClose` の Escape と同じく閉じた時点で検証する */
export const DateValidatesOnOutsideClick: Story = {
  tags: ["!dev"],
  args: { validationMode: "blur" },
  play: async () => {
    const dueDate = screen.getByRole("button", { name: DATE_TRIGGER_EMPTY });
    await userEvent.click(dueDate);
    await screen.findByRole("grid");
    await waitFor(() => expect(screen.getByRole("button", { name: /^今日、/ })).toHaveFocus());
    await expect(dueDate).not.toBeInvalid();

    await userEvent.click(screen.getByRole("button", { name: "別の操作" }));
    await waitForDatePickerUnmount();

    await waitFor(() => expect(dueDate).toBeInvalid());
    await expect(dueDate).toHaveAccessibleDescription(/期日を選択してください/);
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

/** 候補から消えた値のまま送信すると、送信が止まり選び直しを促す */
export const SelectBlocksSubmitWhenValueLeftOptions: Story = {
  tags: ["!dev"],
  render: (args) => <ReplaceableSelectForm {...args} />,
  beforeEach: captureConsoleWarn,
  play: async ({ args }) => {
    await chooseStatus("有効");
    await userEvent.click(screen.getByRole("button", { name: "候補を入れ替える" }));
    await waitFor(() =>
      expect(consoleWarn).toHaveBeenCalledWith(
        "[FormSelectField] 候補から現在値が消えました。値は保持します",
        { currentValue: "active", options: ARCHIVED_OPTIONS },
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "送信" }));

    await expect(await screen.findByText("選び直してください")).toBeInTheDocument();
    await expect(args.onSubmit).not.toHaveBeenCalled();
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

/**
 * validators つきで誤用すると、表示できない検証エラーを警告する。warn は検証エラーが変わったときに 1 回だけ出す。
 * 描画中に出す実装は、StrictMode (`.storybook/preview.tsx`) の 2 回目の描画で 2 回になって落ちる
 */
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
    await expect(consoleWarn).toHaveBeenCalledOnce();
  },
};

/** sanitize が handleChange の前に適用される (数字のみ + 3 文字) */
export const SanitizesInput: Story = {
  tags: ["!dev"],
  render: (args) => <SanitizedTextForm {...args} />,
  play: async ({ args }) => {
    const name = textbox("名前");
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

/** `disableErrorFlat` の field で validator が返した issue の配列も、中の文言を描く */
export const IssueArrayWithoutFlatRendered: Story = {
  tags: ["!dev"],
  render: () => (
    <CustomErrorForm error={[{ message: "名前を入力してください" }]} disableErrorFlat />
  ),
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const name = textbox("名前");
    await waitFor(() => expect(name).toBeInvalid());
    await expect(name).toHaveAccessibleDescription(/名前を入力してください/);
  },
};

/** 平らにすると空になる検証エラー (`disableErrorFlat` で `[]`) も、invalid なので代替文言を出す */
export const EmptyIssueArrayFallback: Story = {
  tags: ["!dev"],
  render: () => <CustomErrorForm error={[]} disableErrorFlat />,
  beforeEach: captureConsoleWarn,
  play: async () => {
    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    const name = textbox("名前");
    await waitFor(() => expect(name).toBeInvalid());
    await expect(name).toHaveAccessibleDescription(new RegExp(UNRENDERABLE_FIELD_ERROR_MESSAGE));
    // focus を外すと field の meta だけが変わって描き直される。検証エラーは変わらないので warn は増えない
    await userEvent.click(name);
    await userEvent.tab();
    await expect(consoleWarn).toHaveBeenCalledOnce();
    await expect(consoleWarn).toHaveBeenCalledWith(
      "[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました",
      { errors: [[[]]] },
    );
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
    // focus を外すと field の meta だけが変わって描き直される。検証エラーは変わらないので warn は増えない
    await userEvent.click(name);
    await userEvent.tab();
    await expect(consoleWarn).toHaveBeenCalledOnce();
    await expect(consoleWarn).toHaveBeenCalledWith(
      "[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました",
      { errors: [RAW_ERROR] },
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

/** 期日を持つ状態。トリガーに選んだ日が出る */
export const DateWithValue: Story = {
  render: (args) => <DateForm {...args} />,
};

/**
 * 開いた状態。popup はラベルを名前に持つ dialog で、フォーカスは選択中の日にある。
 * 閉じずに終え、a11y 検査を開いた状態に当てる
 */
export const DateOpen: Story = {
  render: (args) => <DateForm {...args} />,
  // 見出しを axe から外す理由は calendar.story-helpers.ts の excludeFromA11y の docstring にある
  parameters: excludeFromA11y(),
  play: async () => {
    await openDatePicker();

    await expect(screen.getByRole("dialog")).toHaveAccessibleName("期日");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "2026年8月7日金曜日、選択済み" })).toHaveFocus(),
    );
  },
};

/** 日を押すと、その日が YYYY-MM-DD で form の値に入り、トリガーの表示が変わる */
export const DateSelectsDay: Story = {
  tags: ["!dev"],
  render: (args) => <DateForm {...args} />,
  play: async ({ args }) => {
    await openDatePicker();
    await userEvent.click(screen.getByRole("button", { name: "2026年8月20日木曜日" }));

    await expect(args.onChangeValue).toHaveBeenLastCalledWith("2026-08-20");
    await expect(screen.getByRole("button", { name: "期日 2026年8月20日" })).toBeInTheDocument();
    await closeDatePicker();
  },
};

/** 選択中の日をもう一度押すと外れ、form の値が null になる */
export const DateDeselectsOnSecondClick: Story = {
  tags: ["!dev"],
  render: (args) => <DateForm {...args} />,
  play: async ({ args }) => {
    await openDatePicker();
    await userEvent.click(screen.getByRole("button", { name: "2026年8月7日金曜日、選択済み" }));

    await expect(args.onChangeValue).toHaveBeenLastCalledWith(null);
    await expect(screen.getByRole("button", { name: DATE_TRIGGER_EMPTY })).toBeInTheDocument();
    await closeDatePicker();
  },
};

/** クリアボタンで form の値が null になり、値が無い間はクリアボタンを押せない。キーボードで押してもフォーカスは失われない */
export const DateClears: Story = {
  tags: ["!dev"],
  render: (args) => <DateForm {...args} />,
  play: async ({ args }) => {
    await openDatePicker();
    const clear = screen.getByRole("button", { name: "期日をクリア" });
    clear.focus();
    await userEvent.keyboard("{Enter}");

    await expect(args.onChangeValue).toHaveBeenLastCalledWith(null);
    await expect(screen.getByRole("button", { name: DATE_TRIGGER_EMPTY })).toBeInTheDocument();
    // focusableWhenDisabled なので native の disabled ではなく aria-disabled で無効になり、
    // 押した直後のフォーカスがクリアボタンに残る
    await expect(clear).toHaveAttribute("aria-disabled", "true");
    await expect(clear).toHaveFocus();
    await closeDatePicker();
  },
};
