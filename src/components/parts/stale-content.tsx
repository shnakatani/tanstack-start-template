import type { ReactNode } from "react";

import { BUSY_OPACITY_CLASS } from "./busy-opacity";

/**
 * 新しい内容を待つ間、古い内容を半透明で出したままにする器 (React docs「Showing stale content
 * while fresh content is loading」の `isStale` の形)。`aria-busy` は変更中の印で、読み上げには出ない
 * (通知は消費側が `announce()` で出す。ADR-0030)。
 * 半透明の値は `DataTable` の busy 行と共有する (`busy-opacity.ts`)。
 */
export function StaleContent({ stale, children }: { stale: boolean; children: ReactNode }) {
  return (
    <div data-slot="stale-content" aria-busy={stale} className={BUSY_OPACITY_CLASS}>
      {children}
    </div>
  );
}
