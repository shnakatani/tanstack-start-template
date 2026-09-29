/**
 * 空でない文字列の `message` を持つ object から、その `message` を取り出す。取り出せない値は `undefined`。
 * 投げられた値 (Error を含む) と、検証エラー (Standard Schema の issue を含む) の両方に使う。
 * 判定は TanStack Form の custom-errors ガイド「Type Safety of `errors` and `errorMap`」と同じ typeof の
 * 振り分けで、型アサーションを使わない。`message` の読み取りが throw する値は呼び出し側へ throw を渡す。
 */
export function messageOf(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message !== ""
  ) {
    return value.message;
  }
  return undefined;
}
