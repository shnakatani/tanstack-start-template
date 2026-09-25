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
    // 地と角丸は外側の div が持つ。ScrollArea は registry の部品で、見た目を上書きしない (ADR-0011)。
    // 背景は器と本文の両方に置く。本文側が無いと、テキストの矩形が器の箱より高くなったときに
    // axe が背景を解決できない (dequelabs/axe-core#621 で入れた意図した挙動)。器側が無いと
    // スクロールバーのぶんの余白 (ScrollArea の data-has-overflow-* な padding) が地のまま残る。
    // 外側に overflow-hidden を付けない。Viewport の focus ring が角で切れる
    <div className="rounded bg-muted">
      <ScrollArea viewportClassName="max-h-48">
        <pre className="bg-muted p-3 text-xs">{children}</pre>
      </ScrollArea>
    </div>
  );
}
