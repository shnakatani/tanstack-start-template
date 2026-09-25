import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

/**
 * `size="page"` はページ全体の見出しの寸法。`PageHeader` の `<h1>` も同じ関数を呼び、2 つの
 * ページ見出しの寸法の出どころを 1 つにする。
 * `leading-normal` は font-size の後ろに置く。`cn` は後ろの font-size が前の `leading-*` を
 * 上書きするとみなして落とすため、base に置くと registry の行の高さから外れる
 */
const cardTitleVariants = cva("font-heading", {
  variants: {
    size: {
      default: "text-base leading-normal font-medium group-data-[size=sm]/card:text-sm",
      page: "text-lg font-semibold",
    },
    /** 意味色の出し分け。破壊的な文脈にだけ destructive を使う */
    tone: {
      default: "",
      destructive: "text-destructive",
    },
  },
  defaultVariants: {
    size: "default",
    tone: "default",
  },
});

function CardTitle({
  className,
  size,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardTitleVariants>) {
  return (
    <div
      data-slot="card-title"
      className={cn(cardTitleVariants({ size, tone }), className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex flex-col gap-3 px-(--card-spacing)", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  cardTitleVariants,
  CardAction,
  CardDescription,
  CardContent,
};
