import { createLink } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

import { buttonVariants } from "@/components/ui/button";

// createLink は Link の ref (利用者の ref と合成したもの) を部品へ渡し、React 19 では ref も props として
// 届くので、{...props} で a へ渡す。型も ref を含む ComponentProps にする
// (TanStack Router docs「Custom Link」の例は、どれも受けた ref を描く要素へ渡す)
type ButtonLinkBaseProps = ComponentProps<"a"> & VariantProps<typeof buttonVariants>;

function ButtonLinkBase({ className, variant, size, ...props }: ButtonLinkBaseProps) {
  // Router の Link は disabled のとき aria-disabled を付ける。buttonVariants は aria-disabled ではなく
  // data-disabled で薄くするので、同じ状態を data-disabled にも写す
  const disabled = props["aria-disabled"] === true || props["aria-disabled"] === "true";
  return (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content -- 汎用ラッパーで、children は呼び出し側が {...props} 経由で渡す前提。単体では判定できない
    <a
      // registry の Button と同じ意匠 (buttonVariants) を纏うので slot 名も揃える。
      // registry の子孫セレクタ (button-group.tsx の `[data-slot=button]` 等) は
      // この属性で対象を選ぶため、欠けるとリンクだけが選択から漏れる
      data-slot="button"
      data-disabled={disabled ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const ButtonLink = createLink(ButtonLinkBase);

export { ButtonLink };
