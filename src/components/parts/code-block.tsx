import type { ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * 等幅の本文を枠付きで見せる器。スタックトレースのように幅も高さも読めない内容を
 * カードの中へ収める。`bg-muted` の枠と角丸で周囲の本文と区別する
 * (`segmented-radio-group.tsx` と同じ識別の考え方)。
 *
 * 高さの上限は消費側が 1 つのため prop にしない。2 つ目が現れたら prop 化を検討する。
 */
export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <ScrollArea className="rounded bg-muted" viewportClassName="max-h-48">
      <pre className="p-3 text-xs">{children}</pre>
    </ScrollArea>
  );
}
