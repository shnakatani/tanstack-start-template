import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

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

describe("RootDocument", () => {
  it("本文を <main> で包む", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(findElementWrapping(tree, "main", "本文マーカー")).toBe(true);
  });

  it("<main> が無ければ落ちる", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(findElementWrapping(tree, "article", "本文マーカー")).toBe(false);
  });
});
