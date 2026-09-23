import type { VariantProps } from "class-variance-authority";

import type { buttonVariants } from "@/components/ui/button";

import { variantOptions } from "./variant-options.story-helpers";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/**
 * `argTypes` の control の選択肢。Storybook の `options` は `readonly any[]` で中身を検査せず、
 * 型検査も lint も `cva` との一致を見ない。`satisfies Record<..., null>` に通すことで、
 * `buttonVariants` に足した側と減らした側の両方がここで型エラーになる (ADR-0044)。
 *
 * `Button` を包む部品の story も同じ選択肢を出すため、写しを増やさずここから引く。
 */
export const BUTTON_VARIANTS = variantOptions({
  default: null,
  outline: null,
  secondary: null,
  ghost: null,
  dashed: null,
  destructive: null,
  "destructive-ghost": null,
  link: null,
} satisfies Record<ButtonVariant, null>);

export const BUTTON_SIZES = variantOptions({
  default: null,
  xs: null,
  sm: null,
  lg: null,
  icon: null,
  "icon-xs": null,
  "icon-sm": null,
  "icon-lg": null,
} satisfies Record<ButtonSize, null>);
