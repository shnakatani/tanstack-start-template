import { NumberField } from "@base-ui/react/number-field";
import { type ComponentProps, useId } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFieldContext } from "@/hooks/form-context";
import { cn } from "@/lib/utils";

/**
 * フォームの配線部品。
 * form.AppField の内側で使い、useFieldContext で field を受け取る (公式 form composition)。
 * shadcn 正典の invalid / disabled 両属性ペア (`data-invalid` + `aria-invalid`、
 * `data-disabled` + `disabled`) と、`aria-describedby` ⇄ `FieldError` の id 一致を
 * 部品内部で構造的に保証する。useFieldContext のジェネリクスは呼び出し側 AppField の
 * 値型と一致させる契約 (公式 docs と同じ trusted generic)。
 */

/**
 * fieldValue は部品内部では使わず、消費側の field.state.value を受けて値型を突き合わせる
 * ためだけに存在する。useFieldContext のジェネリクスは実フィールドと型で結びつかないため、
 * これが唯一の突き合わせ経路となる (TanStack/form discussion #1240 のメンテナ回答)。
 * issue #1606 の createFieldComponent が正式 API として入ったら、この prop は不要になる。
 */
interface FieldValueTypeCheckProps<T> {
  fieldValue: T;
}

/**
 * 転送 prop の型は転送先コンポーネントの ComponentProps から Pick で導出する
 * (出処の明示 + 転送先の型変更への自動追随)。全面スプレッド (Omit + rest) は
 * controlled prop (value / onChange / id / aria-*) の上書きや Field 規約外の
 * className 直渡しの経路を開くため採らない — 許可する prop を Pick で列挙する。
 */
interface FormTextFieldProps
  extends
    Pick<
      ComponentProps<typeof Input>,
      "type" | "inputMode" | "autoFocus" | "disabled" | "maxLength" | "placeholder"
    >,
    FieldValueTypeCheckProps<string> {
  label: string;
  /** handleChange 前に入力値を整形する (例: 数字のみに制限する) */
  sanitize?: (raw: string) => string;
  /** 1 つの値を複数入力へ分割するような密な配置の上書き用 (例: "gap-1") */
  fieldClassName?: string;
  labelClassName?: string;
}

/**
 * consumer の className を先、invalid の text-destructive を後に置く。
 * tailwind-merge は後勝ちなので、逆順にすると消費側の色指定が検証エラーの色を打ち消し、
 * エラーであることが色から読み取れなくなる (form-fields.test.tsx が回帰として固定している)。
 */
function fieldLabelClassName(consumerClassName: string | undefined, invalid: boolean): string {
  return cn(consumerClassName, invalid && "text-destructive");
}

/**
 * FieldError が描けない形の検証エラーに使う代替文言。
 * 無表示で済ませると aria-describedby が要素の無い id を指したまま残り、支援技術には
 * 「エラーがある」とだけ伝わって内容が読み上げられない。
 */
export const UNRENDERABLE_FIELD_ERROR_MESSAGE = "入力内容を確認してください";

/** 検証エラー 1 件から表示できる文言を取り出す。取り出せない形なら null を返す。 */
function fieldErrorMessage(error: unknown): string | null {
  if (typeof error === "string") {
    return error;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return null;
}

/**
 * 検証エラーを FieldError が描ける `{ message }` 形へ揃える。
 * standard schema (valibot 等) は `{ message }` を返すが、関数 validator は素の文字列や
 * 任意の値を返せる。揃えずに渡すと FieldError は何も描かず、エラーの内容だけが黙って消える。
 */
function normalizeFieldErrors(errors: readonly unknown[]): { message: string }[] {
  return errors.map((error) => {
    const message = fieldErrorMessage(error);
    if (message === null || message === "") {
      console.warn("[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました", { error });
      return { message: UNRENDERABLE_FIELD_ERROR_MESSAGE };
    }
    return { message };
  });
}

/**
 * Text / Number / Select フィールドが共有する状態導出。id 2 つと invalid の計算を
 * 1 箇所に集め、フィールド種別を増やすときの写し漏れを防ぐ。
 * (FormCheckboxField は FieldError 非対応の別形なので使わない)
 *
 * invalid は正規化前の件数で決める。表示できない形のエラーでも検証は失敗しており、
 * aria-invalid を落とすと submit が止まる理由が支援技術から読めなくなる。
 */
function useFormFieldState<T>() {
  const field = useFieldContext<T>();
  const id = useId();
  const errorId = useId();
  const rawErrors: readonly unknown[] = field.state.meta.errors;
  return {
    field,
    id,
    errorId,
    errors: normalizeFieldErrors(rawErrors),
    invalid: rawErrors.length > 0,
  };
}

export function FormTextField({
  label,
  placeholder,
  type,
  inputMode,
  autoFocus,
  disabled,
  maxLength,
  sanitize,
  fieldClassName,
  labelClassName,
}: FormTextFieldProps) {
  const { field, id, errorId, errors, invalid } = useFormFieldState<string>();

  return (
    <Field
      className={fieldClassName}
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
    >
      <FieldLabel htmlFor={id} className={fieldLabelClassName(labelClassName, invalid)}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- 既定は無効で、消費側が明示的に渡したときだけ転送する。ダイアログ内の先頭フィールドのように妥当な場面があるかは消費側でしか判定できない
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        value={field.state.value}
        onChange={(event) =>
          field.handleChange(sanitize ? sanitize(event.target.value) : event.target.value)
        }
        onBlur={field.handleBlur}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      <FieldError id={errorId} errors={errors} />
    </Field>
  );
}

/**
 * 数値フィールドは「空」を値として持てる必要があるため `number | null` を扱う。
 * `NumberField` の `onValueChange` が空入力を `null` で返すため、`Number("")` が 0 になる
 * 経路を通らない。
 */
interface FormNumberFieldProps extends FieldValueTypeCheckProps<number | null> {
  label: string;
}

export function FormNumberField({ label }: FormNumberFieldProps) {
  const { field, id, errorId, errors, invalid } = useFormFieldState<number | null>();

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id} className={fieldLabelClassName(undefined, invalid)}>
        {label}
      </FieldLabel>
      {/* type="number" は使わない。GOV.UK Design System が利用者テストの結果として外している:
          NVDA の要素一覧で unlabeled になる、Dragon で音声入力できない、ホイールで値が
          無言に増減する。NumberField は推奨形の type="text" + inputmode="numeric" を出し、
          パースとロケール整形を自前で持つ。onValueChange が number | null をそのまま返すので、
          空文字と数値でない入力を自前で畳む処理も要らなくなる */}
      <NumberField.Root
        value={field.state.value}
        onValueChange={(value) => {
          field.handleChange(value);
        }}
      >
        <NumberField.Input
          id={id}
          render={<Input />}
          onBlur={field.handleBlur}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        />
      </NumberField.Root>
      <FieldError id={errorId} errors={errors} />
    </Field>
  );
}

interface FormSelectFieldProps<T extends string>
  extends
    Pick<ComponentProps<typeof Select>, "disabled">,
    Pick<ComponentProps<typeof SelectValue>, "placeholder">,
    FieldValueTypeCheckProps<T> {
  label: string;
  options: readonly { value: T; label: string }[];
}

export function FormSelectField<T extends string>({
  label,
  options,
  placeholder,
  disabled,
}: FormSelectFieldProps<T>) {
  const { field, id, errorId, errors, invalid } = useFormFieldState<T>();

  return (
    <Field data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id} className={fieldLabelClassName(undefined, invalid)}>
        {label}
      </FieldLabel>
      <Select
        value={field.state.value}
        onValueChange={(value) => {
          // 候補が入れ替わったとき Base UI は現在値を null で通知してくる。この自己リセットに
          // 委ねると form の値が黙って消えるため、値の解決はここで引き取る。
          if (value === null) {
            console.warn("[FormSelectField] 候補から現在値が消えました。値は保持します", {
              currentValue: field.state.value,
              options,
            });
            return;
          }

          // options との突合により、手書き型ガードなしで union 値を構造的に narrow する。
          const selected = options.find((option) => option.value === value);
          if (selected === undefined) {
            // SelectItem は options だけから描画するため通常は到達しない。表示は壊さず、
            // Base UI との配線不整合を検出できるよう値と突合元を fail-loud に残す。
            console.warn("[FormSelectField] options にない値を受け取りました", {
              value,
              options,
            });
            return;
          }
          field.handleChange(selected.value);
        }}
        disabled={disabled}
        // Base UI の items は ReadonlyArray<{ label, value }> を直接受ける
        // (SelectRoot.d.ts:111)。options の安定性は消費側 (useMemo / モジュール定数) の責務。
        items={options}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          onBlur={field.handleBlur}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldError id={errorId} errors={errors} />
    </Field>
  );
}

interface FormCheckboxFieldProps extends FieldValueTypeCheckProps<boolean> {
  label: string;
}

export function FormCheckboxField({ label }: FormCheckboxFieldProps) {
  const field = useFieldContext<boolean>();
  const id = useId();
  const errors = field.state.meta.errors;

  // 検証を持たない真偽値フィールド専用なので、正規の利用では errors は常に空で
  // data-invalid / FieldError は不要。誤って validators を付けた場合は、表示できない
  // エラーで submit が止まったことを追跡できるよう fail-loud に警告する。
  // horizontal variant の FieldLabel 幅は direct child selector に依存する。FieldError のために
  // FieldLabel を FieldContent で包むと layout が変わるので、検証つき checkbox が必要になったら
  // この direct child 制約の解決から始める。
  if (errors.length > 0) {
    console.warn("[FormCheckboxField] 検証エラーを表示できません (FieldError 非対応)", {
      label,
      errors,
    });
  }

  return (
    <Field orientation="horizontal">
      <Checkbox id={id} checked={field.state.value} onCheckedChange={field.handleChange} />
      <FieldLabel htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}
