/** 文字列にできない値 (`Object.create(null)` など) が投げられたときに出す文言 */
export const THROWN_VALUE_UNPRINTABLE = "表示できない値が投げられました";

/**
 * 投げられた値を画面に出す文言にする。Router はエラー境界に error を unknown で渡す (route は Error 以外も
 * throw できる)。Error ならその message を、それ以外は値を文字列にする (TanStack Router の data-loading ガイド
 * 「Handling Errors with routeOptions.errorComponent」の例と同じ形)。server function と SSR の loader の
 * エラーは、TanStack Start の直列化で message だけを持つ Error としてクライアントに届く。
 *
 * ガイドの例に足したのは次の 2 つ。どちらも、エラー表示の部品がここで落ちるとエラーの画面ごと壊れるためである。
 * - message が空か文字列でない Error は、値を文字列にする (`Error` や `Error: [object Object]`)。空だと画面に
 *   何も出ず、文字列でないと React の描画が落ちる
 * - `instanceof` の判定、message の読み取り、`String()` のどれかが throw する値は、固定の文言で返す。Router の
 *   組み込みの ErrorComponent は、この保護を持たない
 */
export function thrownValueMessage(value: unknown): string {
  try {
    if (value instanceof Error && typeof value.message === "string" && value.message !== "") {
      return value.message;
    }
    return String(value);
  } catch {
    console.warn("[thrownValueMessage] 文字列にできない値", { value });
    return THROWN_VALUE_UNPRINTABLE;
  }
}

/**
 * 投げられた値のスタックトレースを取り出す。Error でない値と、stack が文字列でない Error は undefined を返す
 * (TanStack Router の PR 8209 の案内どおり instanceof Error で絞る)。`instanceof` の判定か stack の読み取りが
 * throw する値も undefined を返す。理由は thrownValueMessage と同じく、エラーの画面ごと壊さないためである
 */
export function thrownValueStack(value: unknown): string | undefined {
  try {
    return value instanceof Error && typeof value.stack === "string" ? value.stack : undefined;
  } catch {
    console.warn("[thrownValueStack] stack を読めない値", { value });
    return undefined;
  }
}
