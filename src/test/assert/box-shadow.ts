/**
 * computed box-shadow 文字列から各 shadow の spread (4 番目の長さ) の最大値を px で返す。
 * 負の spread はリングを作らないため 0 に丸める (リング検出用途)。
 * inset の有無は区別せず spread をそのまま数える。リング検出の対象 (InputGroup) が inset
 * shadow を持たないためで、持つ要素へ広げるなら除外の要否を決め直すこと。
 * フォーカスリング (Tailwind の ring は box-shadow で描画される) の実測用。
 * 1 段の括弧内のカンマでは分割しない。入れ子の括弧は非対応だが、computed 値では
 * color-mix 等が解決済みのため実用上問題にならない。
 */
export function maxShadowSpread(boxShadow: string): number {
  if (boxShadow === "none") return 0;
  const spreads = boxShadow.split(/,(?![^(]*\))/).map((shadow) => {
    const lengths = shadow.match(/-?\d+(?:\.\d+)?px/g) ?? [];
    return lengths.length >= 4 ? Number.parseFloat(lengths[3] ?? "0") : 0;
  });
  return Math.max(0, ...spreads);
}
