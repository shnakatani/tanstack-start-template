import type { ReactNode } from "react";

/**
 * 新しい内容を待つ間、古い内容を半透明で出したままにする器 (React docs「Showing stale content
 * while fresh content is loading」の `isStale` の形)。`aria-busy` で支援技術にも伝える。
 * 半透明の値は `DataTable` の busy 行と同じ 60 (light で本文が WCAG 1.4.3 の 4.5:1 を保つ値。ADR-0016)。
 */
export function StaleContent({ stale, children }: { stale: boolean; children: ReactNode }) {
  return (
    <div data-slot="stale-content" aria-busy={stale} className="aria-busy:opacity-60">
      {children}
    </div>
  );
}
