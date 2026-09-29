/** 文字列にできない値 (`Object.create(null)` など) が投げられたときに出す文言 */
export const THROWN_VALUE_UNPRINTABLE = "表示できない値が投げられました";

/**
 * 投げられた値を画面に出す文言にする。Router はエラー境界に error を unknown で渡す
 * (route は Error 以外も throw できる)。文字列の message を持つ値 (Error を含む) はその message を、
 * それ以外は値を文字列にする。message を読むのは Router の組み込みの ErrorComponent と同じで、
 * Error でない object を `[object Object]` にしない。
 *
 * message の読み取りや `String()` が throw する値は固定の文言で返す。エラー表示の部品がここで
 * 落ちると、エラーの画面ごと壊れる。
 */
export function thrownValueMessage(value: unknown): string {
  try {
    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof value.message === "string"
    ) {
      return value.message;
    }
    return String(value);
  } catch {
    console.warn("[thrownValueMessage] 文字列にできない値", { value });
    return THROWN_VALUE_UNPRINTABLE;
  }
}
