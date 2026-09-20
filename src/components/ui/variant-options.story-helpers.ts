/**
 * `argTypes` の control の選択肢を作る。
 *
 * Storybook の `options` は `readonly any[]` で中身を検査せず、型検査も lint も `cva` との
 * 一致を見ない。`Record<T, null>` を要求することで、`cva` に variant を足した側と減らした側の
 * 両方が呼び出し位置で型エラーになる (ADR-0022 / `directory-structure.md`「コンポーネント配置」)。
 *
 * ```ts
 * const VARIANT_OPTIONS = variantOptions<AlertVariant>({ default: null, destructive: null });
 * ```
 */
export function variantOptions<T extends string>(members: Record<T, null>): string[] {
  return Object.keys(members);
}
