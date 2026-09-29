import * as v from "valibot";

/** 文字列にできない値 (`Object.create(null)` など) が投げられたときに出す文言 */
export const THROWN_VALUE_UNPRINTABLE = "表示できない値が投げられました";

/** 空でない文字列の message を持つ値 (Error を含む) */
const withMessageSchema = v.object({ message: v.pipe(v.string(), v.nonEmpty()) });

/**
 * 投げられた値を画面に出す文言にする。Router はエラー境界に error を unknown で渡す
 * (route は Error 以外も throw できる)。空でない文字列の message を持つ値 (Error を含む) はその
 * message を、それ以外は値を文字列にする。
 *
 * Router の data-loading ガイドの例は `instanceof Error` で絞るが、それだと message を持つ object が
 * `[object Object]` になる。ここは組み込みの ErrorComponent (`error?.message` を読む) に寄せた。
 * message が空なら組み込みは何も出さないが、ここは値を文字列にして空の表示を避ける。
 *
 * message の読み取り、`String()`、valibot が検証の失敗を記録するときの値の参照 (prototype の
 * `constructor.name`) のどれかが throw する値は固定の文言で返す。エラー表示の部品がここで落ちると、
 * エラーの画面ごと壊れる。
 */
export function thrownValueMessage(value: unknown): string {
  try {
    return v.is(withMessageSchema, value) ? value.message : String(value);
  } catch {
    console.warn("[thrownValueMessage] 文字列にできない値", { value });
    return THROWN_VALUE_UNPRINTABLE;
  }
}
