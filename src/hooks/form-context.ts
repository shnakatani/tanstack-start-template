import { createFormHookContexts } from "@tanstack/react-form";

/**
 * form composition の共有 context (公式 form-composition guide の分割)。
 * 登録側 (use-app-form.ts) と部品側 (form-fields.tsx) の双方が参照するため、
 * 循環 import を避けて独立ファイルに置く。
 */
export const { fieldContext, formContext, useFieldContext } = createFormHookContexts();
