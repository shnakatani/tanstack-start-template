import type { VariantProps } from "class-variance-authority";

import type { toggleVariants } from "@/components/ui/toggle";

import { variantOptions } from "./variant-options.story-helpers";

type ToggleVariant = NonNullable<VariantProps<typeof toggleVariants>["variant"]>;
type ToggleSize = NonNullable<VariantProps<typeof toggleVariants>["size"]>;

/**
 * `argTypes` の control の選択肢。Storybook の `options` は `readonly any[]` で中身を検査せず、
 * 型検査も lint も `cva` との一致を見ない。`satisfies Record<..., null>` に通すことで、
 * `toggleVariants` に足した側と減らした側の両方がここで型エラーになる (ADR-0039)。
 *
 * `ToggleGroup` も同じ `cva` を共有するため、写しを増やさずここから引く。
 */
export const TOGGLE_VARIANTS = variantOptions({
  default: null,
  outline: null,
} satisfies Record<ToggleVariant, null>);

export const TOGGLE_SIZES = variantOptions({
  default: null,
  sm: null,
  lg: null,
} satisfies Record<ToggleSize, null>);
