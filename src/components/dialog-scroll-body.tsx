import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * 内部スクロール方式のダイアログで、`DialogHeader` / `DialogFooter` の間に置く
 * 中間コンテナ (`form` / `div`) を縦の flex container にする。
 * `DialogScrollBody` と組で使う。1280x600 で各クラスを外して実測した結果:
 *
 * - `flex` / `flex-col`: 外すと本体とフッターが横並びになるか、子の縮みが効かず本体が
 *   ダイアログ外へはみ出してフッターが見えなくなる
 * - `min-h-0`: flex item の既定 `min-height: auto` を打ち消す。外すと中間コンテナが内容高
 *   (594.3px) を下限に持ち `DialogContent` の制約まで縮まないため内部スクロールが成立しない
 * - `gap-6`: 本体とフッターの間隔。`DialogScrollBody` の縦 padding はスクロール領域の内側に
 *   ありスクロールで流れるため、固定側に余白を持たせる。`DialogContent` の `gap-6` と同値に
 *   することで区切り線の上下が 24px で対称になる (`gap-4` だと上 24px / 下 16px の非対称に
 *   なり、同じ「固定領域との境界」に 2 つの値が混じる)
 *
 * `flex-1` は実測で不要と判明したため持たない (`DialogContent` が `max-h-full` で内容高に
 * 従うので `flex-grow` が働く余白がない)。
 */
export const dialogScrollLayout = "flex min-h-0 flex-col gap-6";

/**
 * 内部スクロール方式のダイアログ本体 (base-ui 公式の inside-scroll パターン)。
 * `DialogHeader` と `DialogFooter` を固定したまま、この領域だけをスクロールさせる。
 *
 * base-ui にも shadcn registry にも Body に相当するパートは無いため、両者を組み合わせた
 * 自作の汎用コンポーネントとして `src/components/` 直下に置く。
 *
 * `-mx-6` と `px-6` は `DialogContent` の `p-6` (`ui/dialog.tsx`) を打ち消して Viewport の
 * 内側へ移すためのペア。Viewport は `overflow: scroll` なので、内側に余白がないと入力の
 * focus ring (`input.tsx` の `focus-visible:ring-3` = box-shadow 3px) が境界でクリップされる。
 * **`DialogContent` の padding を変えたらこの値も変える**。破綻は 2 箇所で捕まる:
 * `ui/dialog.test.tsx` が `padding` を 24px に固定する assertion と、
 * `dialog-scroll-body.test.tsx` の本体の内容と見出しの左端一致。
 *
 * `py-4` は同じクリップを縦で防ぐ。先頭・末尾に来た要素 (input の focus ring、`card.tsx` の
 * `ring-1`) が境界で切れる。横と違い打ち消す対象がないので値は独立で、消費側が個別に持って
 * いた `FieldGroup` の縦 padding を本体へ集約したもの。区切り線との間隔でもあるため、変えると
 * 全ダイアログの本文開始位置が動く。
 *
 * `border-y` は固定領域とスクロール領域の境界を示す (base-ui 公式が Header の
 * `border-bottom` と Actions の `border-top` で担っている役割)。`-mx-6` により
 * ダイアログの左右端まで届く。溢れていないダイアログでは線が装飾に見えるため、
 * base-ui が Root に出す `data-has-overflow-y` でスクロールが要るときだけ色を付ける
 * (`border-transparent` を先に置くのでレイアウトシフトは起きない)。この属性を消費側で
 * 使う流儀は `route-error.tsx` が先行している。
 * registry の `ui/scroll-area.tsx` 側には入れない — 素の Root は `relative` だけで border を
 * 持たず、入れると境界線を求めていない消費者 (`route-error.tsx` のスタックトレース領域など)
 * にも不要な線が出る。
 *
 * `scroll-area-focus-outline` (`styles.css`) は Viewport のフォーカス指標を Root へ移す共有
 * utility。ここで要るのは、Viewport の border box が Root の padding box と一致するため
 * `overflow-hidden` が Viewport の ring を全周クリップするからである。公式 CSS も `.Body` の
 * `overflow: hidden` と `.Body:has(.BodyViewport:focus-visible)` を対で持っている。
 *
 * Root の `flex-1` / `min-h-0` / `overflow-hidden` と Viewport の `flex-1` / `min-h-0` は
 * 公式 CSS の `.Body` / `.BodyViewport` に対応する指定。1280x600 の実測では `flex-col` を
 * 入れて Root の高さが確定すれば Viewport の `size-full` が解決されるため外しても動くが、
 * その場合「なぜ動くか」が base-ui の Viewport が `overflow: scroll` を持つことへの暗黙
 * 依存になるので公式どおり残す。**機能を担っているのは `flex-col` (外すと内部スクロールが
 * 効かない) と `-mx-6` / `px-6` (外すと内容が 24px 内側へずれ、focus ring がクリップされる)**。
 *
 * 一方 `dialogScrollLayout` 側が `flex-1` を持たないのは、公式の inside-scroll 例が Popup
 * の直下に Header / ScrollArea.Root / Actions を置き `form` に相当する中間要素を持たないため、
 * 参照すべき公式指定が存在しないからである (Root 側とは判断の基準が違う)。
 */
function DialogScrollBody({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof ScrollArea>, "viewportClassName" | "children"> & {
  children: ReactNode;
}) {
  return (
    <ScrollArea
      data-slot="dialog-scroll-body"
      className={cn(
        "scroll-area-focus-outline -mx-6 flex min-h-0 flex-1 flex-col overflow-hidden border-y border-transparent data-has-overflow-y:border-border",
        className,
      )}
      viewportClassName="min-h-0 flex-1 overscroll-contain px-6 py-4"
      {...props}
    >
      {children}
    </ScrollArea>
  );
}

export { DialogScrollBody };
