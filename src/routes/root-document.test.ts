import { type ElementType, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

import { LiveRegions } from "@/components/live-regions";

import { RootDocument } from "./__root";

/**
 * 文書レベルの landmark を押さえる。
 *
 * ページ単体の a11y 検査 (`expectNoA11yViolations`) は `region` ルールを無効にしている。
 * 単体 render は `RootDocument` を通らず必ず違反になるためで、その代わりに
 * 「本文が landmark の中にある」ことはここで守る。
 *
 * render せず要素ツリーを歩くのは、`HeadContent` が router context を要求して
 * `renderToStaticMarkup` が通らないため。
 */
function findElementWrapping(node: ReactNode, type: string, marker: string): boolean {
  // Array.isArray のナローイングは any[] になるため、要素の型を ReactNode[] で受け直す
  if (Array.isArray(node)) {
    const children: ReactNode[] = node;
    return children.some((child) => findElementWrapping(child, type, marker));
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;

  const children = node.props.children;
  if (node.type === type && JSON.stringify(children ?? null).includes(marker)) return true;
  return findElementWrapping(children, type, marker);
}

/**
 * 型で木を歩いて存在だけを見る。`findElementWrapping` は children の marker 文字列で
 * 特定するので、子を持たないコンポーネント (`LiveRegions`) には使えない。
 */
function containsElementOfType(node: ReactNode, type: ElementType): boolean {
  if (Array.isArray(node)) {
    const children: ReactNode[] = node;
    return children.some((child) => containsElementOfType(child, type));
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  if (node.type === type) return true;
  return containsElementOfType(node.props.children, type);
}

describe("RootDocument", () => {
  it("本文を <main> で包む", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(findElementWrapping(tree, "main", "本文マーカー")).toBe(true);
  });

  it("<main> が無ければ落ちる", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(findElementWrapping(tree, "article", "本文マーカー")).toBe(false);
  });

  /**
   * announcer の region は初期マークアップに含まれていることが要件 (ADR-0017)。
   * `announce()` の側は region が在る前提で書かれており、配線が外れると
   * 通知が warn だけ残して届かなくなる。その配線をここで守る。
   */
  it("announcer の live region を置く", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(containsElementOfType(tree, LiveRegions)).toBe(true);
  });
});
