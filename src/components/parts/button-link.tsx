import { createLink } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

import { buttonVariants } from "@/components/ui/button";

import { PendingLabel } from "./pending-label";

// createLink は Link の ref (利用者の ref と合成したもの) を部品へ渡し、React 19 では ref も props として
// 届くので、{...props} で a へ渡す。型も ref を含む ComponentProps にする
// (TanStack Router docs「Custom Link」の例は、どれも受けた ref を描く要素へ渡す)
type ButtonLinkBaseProps = ComponentProps<"a"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * 押したあとの読み込み中。渡すと children を `PendingLabel` で包み、pending の間 label に `Spinner` を重ねて
     * 幅を保つ (ADR-0042)。状態は `aria-disabled` と announce で伝える (ADR-0026)。渡さない呼び出しの DOM は変わらない
     */
    isPending?: boolean;
  };

function ButtonLinkBase({
  className,
  variant,
  size,
  isPending,
  children,
  ...props
}: ButtonLinkBaseProps) {
  // Router の Link は disabled のとき aria-disabled を付ける。buttonVariants は aria-disabled ではなく
  // data-disabled で薄くするので、同じ状態を data-disabled にも写す
  const disabled = props["aria-disabled"] === true || props["aria-disabled"] === "true";
  return (
    <a
      // registry の Button と同じ意匠 (buttonVariants) を纏うので slot 名も揃える。
      // registry の子孫セレクタ (button-group.tsx の `[data-slot=button]` 等) は
      // この属性で対象を選ぶため、欠けるとリンクだけが選択から漏れる
      data-slot="button"
      data-disabled={disabled ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {isPending === undefined ? (
        children
      ) : (
        <PendingLabel isPending={isPending}>{children}</PendingLabel>
      )}
    </a>
  );
}

const ButtonLink = createLink(ButtonLinkBase);

export { ButtonLink };
