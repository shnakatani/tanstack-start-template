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
 * 比較した案は docs/guides/forms-and-inputs.md「`fieldValue` で値型を突き合わせる理由」。
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
}: FormTextFieldProps) {
  const { field, id, errorId, errors, invalid } = useFormFieldState<string>();

  return (
    <Field
      // ラベルの destructive 色は registry の Field が `data-[invalid=true]:text-destructive` で
      // 持ち、FieldLabel はそれを継承する。JS で色を足さない (ADR-0022)
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
    >
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
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
interface FormNumberFieldProps
  extends
    Pick<ComponentProps<typeof NumberField.Root>, "disabled">,
    FieldValueTypeCheckProps<number | null> {
  label: string;
}

export function FormNumberField({ label, disabled }: FormNumberFieldProps) {
  const { field, id, errorId, errors, invalid } = useFormFieldState<number | null>();

  return (
    <Field data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {/* type="number" は使わない。GOV.UK Design System が利用者テストの結果として外している:
          NVDA の要素一覧で unlabeled になる、Dragon で音声入力できない、ホイールで値が
          無言に増減する。NumberField は推奨形の type="text" + inputmode="numeric" を出し、
          パースとロケール整形を自前で持つ。onValueChange が number | null をそのまま返すので、
          空文字と数値でない入力を自前で畳む処理も要らなくなる */}
      <NumberField.Root
        value={field.state.value}
        disabled={disabled}
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

/**
 * 選んでいた値が候補から消えたことを、Base UI の `onValueChange(null)` で検出しない。
 * 値の解決はこの部品が引き取り、`null` と options に無い値は表示を保ったまま warn に残す。
 *
 * Base UI の自己リセットは公式 docs の Select に書かれていない (同梱の docs を `reset` /
 * `onValueChange` で検索、2026-09-23、1.8.0)。実装は `select/positioner/SelectPositioner.mjs`
 * の `onMapChange` にあり、1.8.0 のソース上の扱いは次のとおり (読み取りで、挙動は未実測)。
 *
 * | 条件                                                             | ソース上の扱い                        |
 * | ---------------------------------------------------------------- | ------------------------------------- |
 * | 項目が 1 件も登録されていない (`valuesRef.current.length === 0`) | 何もしない                            |
 * | 初回の登録 (`prevSize === 0`)                                    | 何もしない                            |
 * | 単一選択で現在値が `null`                                        | 何もしない                            |
 * | 現在値が候補に無く、マウント時の値が候補にある                   | マウント時の値へ戻す。`null` は来ない |
 * | 現在値もマウント時の値も候補に無い                               | `null` で `setValue` する             |
 *
 * 通知が来ない条件がある。項目の登録の変化を拾う `CompositeList` は件数に加えて要素の同一性も
 * 比べ、件数が変わらないときに何もしない分岐は 1.8.0 で撤去された (CHANGELOG v1.8.0、
 * mui/base-ui の PR 5469)。版ごとに経路が変わるので、自己リセットに任せる案は採らない。
 * 項目がいつ登録されるか (トリガーを一度もフォーカスしていない間は登録されないか) は未確認。
 * この部品を包まずに `Select` を使うときの書き方は
 * docs/guides/forms-and-inputs.md「Select の値を解決する」。
 *
 * 出典: Base UI Select (https://base-ui.com/react/components/select)、CHANGELOG
 * (https://github.com/mui/base-ui/blob/master/CHANGELOG.md)、PR 5469
 * (https://github.com/mui/base-ui/pull/5469)、`SelectPositioner` の実装
 * (https://github.com/mui/base-ui/blob/master/packages/react/src/select/positioner/SelectPositioner.tsx)
 */
export function FormSelectField<T extends string>({
  label,
  options,
  placeholder,
  disabled,
}: FormSelectFieldProps<T>) {
  const { field, id, errorId, errors, invalid } = useFormFieldState<T>();

  return (
    <Field data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        value={field.state.value}
        onValueChange={(value) => {
          // 候補が入れ替わったとき Base UI は現在値を null で通知してくることがある。この
          // 自己リセットに委ねると form の値が黙って消えるため、値の解決はここで引き取る。
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

interface FormCheckboxFieldProps
  extends Pick<ComponentProps<typeof Checkbox>, "disabled">, FieldValueTypeCheckProps<boolean> {
  label: string;
}

export function FormCheckboxField({ label, disabled }: FormCheckboxFieldProps) {
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

  // registry の horizontal Field は子の FieldLabel を flex-auto で伸ばし、Field 自身は w-full なので、
  // フォームの幅いっぱいまでラベルが伸びて右の余白でもトグルする。shadcn の単独チェックボックスの例は
  // 器の幅を w-56 に絞っており、行を中身の幅に縮めるのはその形に合わせたもの
  return (
    <Field orientation="horizontal" className="w-fit" data-disabled={disabled || undefined}>
      <Checkbox
        id={id}
        checked={field.state.value}
        disabled={disabled}
        onCheckedChange={field.handleChange}
      />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  );
}
