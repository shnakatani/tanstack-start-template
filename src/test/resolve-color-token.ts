/**
 * CSS カスタムプロパティを、ブラウザが算出した色文字列 (`rgb(...)`) へ解決する。
 *
 * 宣言の字面と算出値は一致しない。`styles.css` はトークンの値を Tailwind の palette の段から
 * 写す約束で、palette 側が `oklch(44.4% ...)` と百分率で書くのに対し、算出値は
 * `oklch(0.444 ...)` へ正規化される (ADR-0024)。`getPropertyValue` で読んだ字面を
 * 要素の算出色と比べると、値が同じでも落ちる。
 *
 * 解決は probe 要素をツリーへ挿して行う。`color` へ `var(...)` を置いて `getComputedStyle`
 * で読み戻すと、正規化と `color-mix()` の展開をブラウザ自身にやらせられる。
 *
 * @param token `--destructive` のようなカスタムプロパティ名
 * @param scope probe を挿す親。テーマは祖先の class で決まるので、`.dark` の配下を測るときは
 *   その部分木の要素を渡す。既定の `document.body` は `<html>` の class を見る
 */
export function resolveColorToken(token: string, scope: Element = document.body): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  scope.append(probe);
  try {
    return getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }
}
