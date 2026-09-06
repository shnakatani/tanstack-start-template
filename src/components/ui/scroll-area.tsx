import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "@/lib/utils";

interface ScrollAreaProps extends ScrollAreaPrimitive.Root.Props {
  // 呼び出し側から Viewport の layout class を指定できるよう保全する。
  // base-ui の Viewport.Props["className"] は callback 形も許すが、clsx は関数を silent に
  // 捨てるため文字列に限定する (callback を渡した caller が無音で無効化されるのを防ぐ)
  viewportClassName?: string;
}

function ScrollArea({ className, viewportClassName, children, ...props }: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      // スクロールバーは Root へ絶対配置される overlay なので、場所を空けないと Viewport の
      // 端に重なって最終行や右端の要素のクリックを奪う。空ける量は下の `ScrollBar` の太さと
      // 対なので、太さと同じファイルに置いて一緒に動かす。バーの位置決めの基準は Root の
      // padding box なので、幅が外から決まる Root では padding が Viewport だけを縮める。
      // 消費側が Viewport へ持たせた padding とも競合しない (Viewport 側に置くと、属性つき
      // selector が `px-*` に詳細度で勝って片側だけを無言で潰す)。
      // 溢れていない軸のバーは DOM に出ないので、余白も `data-has-overflow-*` で出し分ける
      className={cn("relative data-has-overflow-x:pb-2.5 data-has-overflow-y:pr-2.5", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1",
          viewportClassName,
        )}
      >
        {/* Content は base-ui が ResizeObserver で thumb を再計算するためのパート。
            registry はこれを省いており、内容が縮んでも overflow 判定が更新されない
            (shadcn-ui/ui#10534 / mui/base-ui#4696)。上の余白と dialog-scroll-body.tsx の
            区切り線が data-has-overflow-* で出し分けるため、機能構造として補う */}
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      {/* registry は横バーを消費側の children 合成に任せるが、両向きとも自分で描く。
          base-ui は溢れた向きのバーだけを mount する (keepMounted=false) ので、渡す・
          渡さないの判断は消費側に要らない。Root 直下に置くのは公式デモと同じ構造で、
          Viewport / Content に包含ブロックを作る指定が入ってもバーが流れない */}
      <ScrollBar />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      // registry の `data-vertical:h-full` は外してある。base-ui はバーへ `top: 0` と
      // `bottom: var(--scroll-area-corner-height)` を当てるので、`height: 100%` が加わると
      // 縦方向が over-constrained になり bottom が捨てられる。Root が余白を持つ前は Viewport の
      // border box が Root と一致していて露見しなかったが、余白が付くと縦バーだけが Corner の
      // 帯まで伸びて Viewport の下端を越える。横バーは幅を inset で決めており同じ問題は無い
      className={cn(
        "flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
