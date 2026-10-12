import { createLink } from "@tanstack/react-router";
import type { VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { useId, type ComponentProps } from "react";

import { buttonVariants } from "@/components/ui/button";

import { PendingLabel } from "./pending-label";

// createLink は Link の ref (利用者の ref と合成したもの) を部品へ渡し、React 19 では ref も props として
// 届くので、{...props} で a へ渡す。型も ref を含む ComponentProps にする
// (TanStack Router docs「Custom Link」の例は、どれも受けた ref を描く要素へ渡す)。
// `aria-labelledby` は pending の名前のために内部で使うので prop から外す (受け付けたまま上書きすると、
// 渡した側から見て黙って消える。`ActionButtonShell` と同じ理由)
type ButtonLinkBaseProps = Omit<ComponentProps<"a">, "aria-labelledby"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * 遷移の読み込み中。渡すと children を `PendingLabel` で包み、pending の間は幅を保ったまま Spinner を重ねる
     * (ADR-0042)。判定は呼び出し側が持つ (`useMatchRoute` の `pending`。ADR-0041)。包むのは prop を渡した
     * 呼び出しだけで、渡さない呼び出しの DOM は変わらない。真偽ではなく有無で包むので、pending の出入りで
     * 子の木が差し替わらず、focus 中のリンクの中身が unmount されない
     */
    isPending?: boolean;
  };

function ButtonLinkBase({
  className,
  variant,
  size,
  isPending,
  "aria-label": ariaLabel,
  children,
  ...props
}: ButtonLinkBaseProps) {
  const labelId = useId();
  // Router の Link は disabled のとき aria-disabled を付ける。buttonVariants は aria-disabled ではなく
  // data-disabled で薄くするので、同じ状態を data-disabled にも写す
  const disabled = props["aria-disabled"] === true || props["aria-disabled"] === "true";
  // pending 中は label が不可視になり name from content が空になるので、`aria-label` が無ければ label を指す
  const holdsLabel = isPending !== undefined;
  return (
    // oxlint-disable-next-line jsx-a11y/anchor-has-content -- 汎用ラッパーで、children は呼び出し側が {...props} 経由で渡す前提。単体では判定できない
    <a
      // registry の Button と同じ意匠 (buttonVariants) を纏うので slot 名も揃える。
      // registry の子孫セレクタ (button-group.tsx の `[data-slot=button]` 等) は
      // この属性で対象を選ぶため、欠けるとリンクだけが選択から漏れる
      data-slot="button"
      data-disabled={disabled ? "" : undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      aria-label={ariaLabel}
      aria-labelledby={holdsLabel && ariaLabel === undefined ? labelId : undefined}
      {...props}
    >
      {holdsLabel ? (
        <PendingLabel id={labelId} isPending={isPending}>
          {children}
        </PendingLabel>
      ) : (
        children
      )}
    </a>
  );
}

const ButtonLink = createLink(ButtonLinkBase);

export { ButtonLink };
