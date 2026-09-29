/** 文字列にできない値 (`Object.create(null)` など) が投げられたときに出す文言 */
export const THROWN_VALUE_UNPRINTABLE = "表示できない値が投げられました";

/**
 * 投げられた値を画面に出す文言にする。Router はエラー境界に error を unknown で渡す
 * (route は Error 以外も throw できる)。Error ならその message を、それ以外は値を文字列にする
 * (TanStack Router の data-loading ガイドの例と同じ形)。
 *
 * `String()` が throw する値も固定の文言で返す。エラー表示の部品がここで落ちると、
 * エラーの画面ごと壊れる。
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
