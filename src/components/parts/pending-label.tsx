import { cn } from "cn";
import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";

/**
 * ボタンの label。pending の間は label を `opacity-0` で隠し、同じ grid の領域に `Spinner` を重ねる。
 * label が場所を取り続けるので、pending の前後でボタンの幅が変わらない (ADR-0042)。
 * `opacity: 0` は accessible name の計算で hidden に数えないので、label はボタンの名前に残る。
 * Spinner に `data-icon` を付けない。`buttonVariants` が padding を詰め、幅が変わる
 */
export function PendingLabel({ isPending, children }: { isPending: boolean; children: ReactNode }) {
  return (
    <span className="inline-grid place-items-center">
      <span className={cn("col-start-1 row-start-1", isPending && "opacity-0")}>{children}</span>
      {isPending && <Spinner aria-hidden className="col-start-1 row-start-1" />}
    </span>
  );
}
