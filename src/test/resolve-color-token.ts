/**
 * var() の置換に失敗した `color` が落ちてくる先。トークンが取らない値を選ぶ。
 *
 * 一致するトークンが現れたら偽陽性で落ちるが、黙って通るより良い方向に倒れる。落ちたときは
 * メッセージが宣言の字面を持つので、値がそこに出ていれば衝突だと分かる。
 */
const UNRESOLVED = "rgb(1, 0, 1)";

/**
 * CSS カスタムプロパティを、ブラウザが算出した色文字列 (`rgb(...)`) へ解決する。
 *
 * 宣言の字面と算出値は一致しない。`styles.css` はトークンの値を Tailwind の palette の段から
 * 写す約束で、palette 側が `oklch(44.4% ...)` と百分率で書くのに対し、算出値は
 * `oklch(0.444 ...)` へ正規化される (ADR-0033)。`getPropertyValue` で読んだ字面を
 * 要素の算出色と比べると、値が同じでも落ちる。
 *
 * 解決は probe 要素をツリーへ挿して行う。`color` へ `var(...)` を置いて読み戻すと、正規化と
 * `color-mix()` の展開をブラウザ自身にやらせられる。probe が要るのは `var()` の置換に要素が
 * 要るからで、読み出し API の都合ではない。`computedStyleMap()` は `getComputedStyle` と同じ
 * 展開済みの値を返す (2026-09-21 実測)。指定値のパーサである `CSSStyleValue.parse` だけは
 * `color-mix()` を展開しない。
 *
 * 色として解決できないトークンでは投げる。`var()` の置換に失敗した `color` は `unset` 相当に
 * なり、継承した祖先の色がそのまま返る。例外も警告も出ないので、綴り違いやリネームの
 * 取りこぼしが、別の色を比べたまま緑で通る。
 *
 * 検出は probe の親を `UNRESOLVED` で塗って行う。宣言の字面を `CSS.supports` で見る形は
 * `currentColor` を通してしまう (`CSS.supports("color", "currentColor")` は true だが、
 * 継承色へ解決されるので測りたい値ではない)。継承先を既知の色にしておけば、置換に失敗した
 * 経路がすべてその色に集まる。
 *
 * トークンを `@property { syntax: "<color>" }` で登録する形は採らない。検出の一部を殺す。
 * 登録済みプロパティの不正値は parse 時ではなく算出時に無効となり、`initial-value` へ
 * 戻るためである (CSS Properties and Values API Level 1「invalid at computed-value time」)。
 * 死ぬのは「色でない値を持つトークン」の検出で、未登録の名前を引く綴り違いは `var()` の
 * 置換に失敗するので今までどおり落ちる (2026-09-21 実測)。
 *
 * @param token `--destructive` のようなカスタムプロパティ名
 * @param scope probe を挿す親。テーマは祖先の class で決まるので、`.dark` の配下を測るときは
 *   その部分木の要素を渡す。既定の `document.body` は `<html>` の class を見る
 */
export function resolveColorToken(token: string, scope: Element = document.body): string {
  const sentinel = document.createElement("span");
  sentinel.style.color = UNRESOLVED;
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  sentinel.append(probe);
  scope.append(sentinel);
  try {
    const styles = getComputedStyle(probe);
    const color = styles.color;
    if (color === UNRESOLVED) {
      // 「値が色でない」と「そもそも値が無い」を読み手が区別できるように、宣言の字面を添える。
      // 未定義と空値 (`--x: ;`) は区別できない。chromium 153 はどちらにも "" を返す (2026-09-21 実測)
      const declared = styles.getPropertyValue(token).trim() || "未定義か空値";
      throw new Error(
        `カスタムプロパティ ${token} が ${scope.nodeName} の配下で色に解決できない (${declared})`,
      );
    }
    return color;
  } finally {
    sentinel.remove();
  }
}
