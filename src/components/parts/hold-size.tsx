import { cn } from "cn";
import type { ReactNode } from "react";

/**
 * 重ねるもの。`ReactNode` から `boolean` と `undefined` を外す。残すと `overlay={isPending && <Spinner />}` の
 * `false` が「重ねるものがある」と判定され、下敷きだけが消えて何も見えなくなる。無いときは `null` と書く
 */
type HoldSizeOverlay = Exclude<ReactNode, boolean | undefined>;

interface HoldSizeProps {
  /**
   * 寸法を決める下敷き。`overlay` があるときは `invisible` (visibility: hidden) になり、箱の寸法だけを残す。
   * accessibility tree からも外れ、name from content に入らない。名前に使うときは、この要素を `aria-labelledby` で指す
   * (accname 1.2 の 2A「Hidden Not Referenced」。ADR-0042)
   */
  children: ReactNode;
  /** 下敷きの上に重ねるもの。`null` なら下敷きをそのまま見せる。重ねる側の `aria-hidden` は渡す側が決める */
  overlay: HoldSizeOverlay;
  /** 重ねるものの寄せ。既定は `start` (文言)。図を置くボタンは `center` */
  align?: "start" | "center";
  /** 下敷きを包む要素の id。ボタンが `aria-labelledby` で名前に使う */
  id?: string;
}

/**
 * 下敷きの寸法を保ったまま、操作中の表示を重ねる器 (ADR-0042)。`inline-grid` の同じマスに 2 つを重ねるので、
 * 箱の寸法は下敷きと重ねるものの大きい方になり、重ねるものが出入りしても下敷きより縮まない。
 * 素の `<span>` だけで組み、ui 部品に className を渡さない。
 */
export function HoldSize({ children, overlay, align = "start", id }: HoldSizeProps): ReactNode {
  return (
    <span data-slot="hold-size" className="inline-grid">
      <span id={id} className={cn("col-start-1 row-start-1", overlay !== null && "invisible")}>
        {children}
      </span>
      {overlay !== null && (
        <span className={cn("col-start-1 row-start-1", align === "center" && "place-self-center")}>
          {overlay}
        </span>
      )}
    </span>
  );
}
