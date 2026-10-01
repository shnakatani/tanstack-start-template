/** 文字列にできない値 (`Object.create(null)` など) か、文字列にすると空になる値が投げられたときに出す文言 */
export const THROWN_VALUE_UNPRINTABLE = "表示できない値が投げられました";

/**
 * 投げられた値を画面に出す文言にする。Router はエラー境界に error を unknown で渡す (route は Error 以外も
 * throw できる)。Error ならその message を、それ以外は値を文字列にする (TanStack Router の data-loading ガイド
 * 「Handling Errors with routeOptions.errorComponent」の例と同じ形)。server function と SSR の loader の
 * エラーは、TanStack Start の直列化で message だけを持つ Error としてクライアントに届く。
 *
 * ガイドの例には次の 2 つを足した。Router の組み込みの ErrorComponent も、どちらの保護も持たない。
 * - message が空か文字列でない Error は、値を文字列にする (`Error` や `Error: [object Object]`)。空だと本文に
 *   何も出ず、文字列でないと React の描画が落ちてエラーの画面ごと壊れる
 * - `instanceof` の判定、message の読み取り、`String()` のどれかが throw する値と、文字列にすると空になる値
 *   (`""` や name も message も空の Error) は、固定の文言で返す。前者はエラーの画面ごと壊れ、後者は本文が空になる
 */
export function thrownValueMessage(value: unknown): string {
  try {
    if (value instanceof Error && typeof value.message === "string" && value.message !== "") {
      return value.message;
    }
    const text = String(value);
    if (text === "") {
      console.warn("[thrownValueMessage] 文字列にすると空になる値", { value });
      return THROWN_VALUE_UNPRINTABLE;
    }
    return text;
  } catch {
    console.warn("[thrownValueMessage] 文字列にできない値", { value });
    return THROWN_VALUE_UNPRINTABLE;
  }
}
