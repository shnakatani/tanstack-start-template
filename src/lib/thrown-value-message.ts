/** 文字列にできない値 (`Object.create(null)` など) が投げられたときに出す文言 */
export const THROWN_VALUE_UNPRINTABLE = "表示できない値が投げられました";

/**
 * 投げられた値を画面に出す文言にする。Router はエラー境界に error を unknown で渡す (route は Error 以外も
 * throw できる)。Error ならその message を、それ以外は値を文字列にする (TanStack Router の data-loading ガイド
 * 「Handling Errors with routeOptions.errorComponent」の例と同じ形)。server function と SSR の loader の
 * エラーは、TanStack Start の直列化で message だけを持つ Error としてクライアントに届く。
 *
 * `String()` が throw する値は固定の文言で返す。エラー表示の部品がここで落ちると、エラーの画面ごと壊れる
 * (TanStack Router の PR 8209 の方針「If property access or string conversion throws, keep the error notice
 * visible without details」)。
 */
export function thrownValueMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  try {
    return String(value);
  } catch {
    console.warn("[thrownValueMessage] 文字列にできない値", { value });
    return THROWN_VALUE_UNPRINTABLE;
  }
}
