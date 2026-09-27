/**
 * 見出しと、渡したセレクタを axe の対象から外す `parameters`。
 *
 * 見出しを外すのは、registry 素の nav が `absolute inset-x-0 top-0` で見出しへ重なり、axe が
 * 背景を決められないため (bgOverlap)。原因は部品の構造なので meta へ置き、出ない story だけが
 * 例外を書く。nav は透明なので実際の配色は変わらない。ルールごと切らずに要素で外すのは、
 * 日付セルの色の検査を残すため (`docs/guides/accessibility.md`「story で出た違反を抑制する」)。
 *
 * 上流へは未起票 (2026-09-21 に shadcn-ui/ui を検索して該当なし)。投げるなら shadcn-ui/ui。
 * 外せるのは registry baseline の差分で nav の位置指定が変わったとき (ADR-0020)。
 *
 * `Calendar` を Popover に組み込む消費側の story (`form-fields.stories.tsx` の `DateOpen`) も
 * 同じ理由で見出しを外すため、写しを増やさずここから引く。
 */
export function excludeFromA11y(...selectors: readonly string[]) {
  return { a11y: { context: { exclude: [".rdp-caption_label", ...selectors] } } };
}
