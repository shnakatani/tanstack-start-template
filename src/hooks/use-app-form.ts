import { createFormHook } from "@tanstack/react-form";

import {
  FormCheckboxField,
  FormNumberField,
  FormSelectField,
  FormTextField,
} from "@/components/form-fields";
import { fieldContext, formContext } from "@/hooks/form-context";

/**
 * TanStack Form 公式の form composition 基盤 (react/guides/form-composition)。
 * ページ側は useForm の代わりに useAppForm で form を作る。fieldComponents へ登録した部品が
 * `field.FormTextField` のように型付きで生える。formComponents は現状空。
 *
 * createFormHook は `withForm` (form を generics の明示なしに子コンポーネントへ型付きで渡す
 * ラッパー) も返すが、消費者が現れるまで export しない。必要になったらここへ足す
 * (受け取り側と同じ createFormHook 由来であることが型互換の条件)。
 */
export const { useAppForm } = createFormHook({
  fieldComponents: { FormTextField, FormNumberField, FormSelectField, FormCheckboxField },
  formComponents: {},
  fieldContext,
  formContext,
});
