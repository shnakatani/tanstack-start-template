import { type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

import { LiveRegions } from "@/components/live-regions";
import { NotFoundContent } from "@/components/screens/not-found";

import { RootDocument, Route } from "./__root";

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
type ElementWithChildren = ReactElement<{ children?: ReactNode }>;

/** 要素ツリーを深さ優先で歩き、述語に一致する要素があるかを返す。 */
function hasElement(
  node: ReactNode,
  predicate: (element: ElementWithChildren) => boolean,
): boolean {
  // Array.isArray のナローイングは any[] になるため、要素の型を ReactNode[] で受け直す
  if (Array.isArray(node)) {
    const children: ReactNode[] = node;
    return children.some((child) => hasElement(child, predicate));
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return false;
  return predicate(node) || hasElement(node.props.children, predicate);
}

/** 指定の型で、children に marker 文字列を含む要素にだけ一致する述語。 */
function wrapping(type: ElementType, marker: string) {
  return (element: ElementWithChildren) =>
    element.type === type && JSON.stringify(element.props.children ?? null).includes(marker);
}

describe("RootDocument", () => {
  it("本文を <main> で包む", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(hasElement(tree, wrapping("main", "本文マーカー"))).toBe(true);
  });

  it("<main> が無ければ落ちる", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(hasElement(tree, wrapping("article", "本文マーカー"))).toBe(false);
  });

  /**
   * announcer の region は初期マークアップに含まれていることが要件 (ADR-0026)。
   * `announce()` の側は region が在る前提で書かれており、配線が外れると
   * 通知が warn だけ残して届かなくなる。その配線をここで守る。
   */
  it("announcer の live region を置く", () => {
    const tree = RootDocument({ children: "本文マーカー" });

    expect(hasElement(tree, (element) => element.type === LiveRegions)).toBe(true);
  });
});

// root は失敗の最後の受け手。外れると、受ける route の無い失敗が組み込みの英語の画面になる (ADR-0044)。
// ブラウザテストはテストの root を組むので、本番の root の部品はここで見る
describe("root の route", () => {
  it("not found の部品とエラーの部品を持つ", () => {
    expect(Route.options.notFoundComponent).toBe(NotFoundContent);
    expect(Route.options.errorComponent).toBeTypeOf("function");
  });
});
