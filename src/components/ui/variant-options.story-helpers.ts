/**
 * `argTypes` の control の選択肢を作る。
 *
 * Storybook の `options` は `readonly any[]` で中身を検査せず、型検査も lint も `cva` との
 * 一致を見ない。呼び出し側で `satisfies Record<T, null>` を書くことで、`cva` に variant を
 * 足した側と減らした側の両方がそこで型エラーになる
 * (ADR-0022 / `directory-structure.md`「コンポーネント配置」)。
 *
 * 型引数で受ける形は採らない。`variantOptions({ a: null })` のように書けば T が推論されて
 * 網羅の検査が無言で消え、検査しているように見えるだけの呼び出しが通る。
 *
 * ```ts
 * const VARIANT_OPTIONS = variantOptions({
 *   default: null,
 *   destructive: null,
 * } satisfies Record<AlertVariant, null>);
 * ```
 */
export function variantOptions(members: Record<string, null>): string[] {
  return Object.keys(members);
}
