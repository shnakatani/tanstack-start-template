/**
 * FieldError が描けない形の検証エラーに使う代替文言。
 * 無表示で済ませると aria-describedby が要素の無い id を指したまま残り、支援技術には
 * 「エラーがある」とだけ伝わって内容が読み上げられない。
 */
export const UNRENDERABLE_FIELD_ERROR_MESSAGE = "入力内容を確認してください";

/** 検証エラー 1 件から表示できる文言を取り出す (`docs/guides/forms-and-inputs.md`「`fieldComponents` の部品を書く」) */
function fieldErrorMessage(error: unknown): string | undefined {
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
  return undefined;
}

/** 検証エラーを FieldError が描ける `{ message }` 形へ揃える (`docs/guides/forms-and-inputs.md`「`fieldComponents` の部品を書く」) */
export function normalizeFieldErrors(errors: readonly unknown[]): { message: string }[] {
  // 平らにすると空になる (`[]` を返した validator) なら、form は invalid と数えるので、元の errors を 1 件として丸める
  const flatErrors = errors.flat(1);
  const targets = flatErrors.length === 0 && errors.length > 0 ? [errors] : flatErrors;
  return targets.map((error) => {
    const message = fieldErrorMessage(error);
    if (!message) {
      console.warn("[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました", { error });
      return { message: UNRENDERABLE_FIELD_ERROR_MESSAGE };
    }
    return { message };
  });
}
