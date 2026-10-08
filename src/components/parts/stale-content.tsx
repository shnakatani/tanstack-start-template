import type { ReactNode } from "react";

import { BUSY_OPACITY_CLASS } from "@/lib/busy-opacity";

/**
 * 新しい内容を待つ間、古い内容を半透明で出したままにする器 (React docs「Showing stale content
 * while fresh content is loading」の `isStale` の形)。半透明は読み上げに出ないので、結果は消費側が
 * `announce()` で出す (ADR-0027)。
 * 半透明の値は registry の `TableRow` (`ui/table.tsx`) と共有する (`src/lib/busy-opacity.ts`)。
 */
export function StaleContent({ stale, children }: { stale: boolean; children: ReactNode }) {
  return (
    <div data-slot="stale-content" data-busy={stale} className={BUSY_OPACITY_CLASS}>
      {children}
    </div>
  );
}
