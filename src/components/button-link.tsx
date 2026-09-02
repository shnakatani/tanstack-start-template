import { createLink } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkBaseProps = ComponentPropsWithoutRef<"a"> & VariantProps<typeof buttonVariants>;

function ButtonLinkBase({ className, variant, size, ...props }: ButtonLinkBaseProps) {
  return (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content -- 汎用ラッパーで、children は呼び出し側が {...props} 経由で渡す前提。単体では判定できない
    <a
      // registry の Button と同じ意匠 (buttonVariants) を纏うので slot 名も揃える。
      // registry の子孫セレクタ (button-group.tsx の `[data-slot=button]` 等) は
      // この属性で対象を選ぶため、欠けるとリンクだけが選択から漏れる
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const ButtonLink = createLink(ButtonLinkBase);

export { ButtonLink };
