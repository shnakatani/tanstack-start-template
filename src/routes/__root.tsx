import { a11yDevtoolsPlugin } from "@tanstack/devtools-a11y/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { tableDevtoolsPlugin } from "@tanstack/react-table-devtools";
import type { ReactNode } from "react";

import { LiveRegions } from "@/components/live-regions";
import { NotFoundContent } from "@/components/screens/not-found";
import { FullScreenRouteError } from "@/components/screens/route-error";
import { Toaster } from "@/components/ui/toast";
import { pageTitle } from "@/lib/page-title";

import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: (ctx) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: pageTitle(ctx) },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  // 文書の骨格は shell が描く。shell は root の component・errorComponent・notFoundComponent を外から包むので、
  // root が失敗や not found に置き換わっても骨格と Toaster は残る (ADR-0045)。component は置かず、既定の <Outlet /> を描く
  shellComponent: RootDocument,
  // root の失敗と、どの route の部品も受けなかった失敗の受け皿 (ADR-0044)
  errorComponent: FullScreenRouteError,
  // どの route にも当たらない URL と、notFoundComponent を持つ祖先が無い loader・beforeLoad の notFound() を受ける
  // (ADR-0044)
  notFoundComponent: NotFoundContent,
});

/**
 * 文書の骨格。root の shell に置く (ADR-0045)。children には root の component か、root の失敗と not found の部品が来る。
 * landmark を押さえるテストから直接呼べるよう named export にする
 */
export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* ページ本体を landmark へ入れる。無いと支援技術に本文へ飛ぶ手段が無く、
            axe-core の region ルールが「All page content should be contained by landmarks」で報告する */}
        <main>
          {children}
          <Toaster />
          <TanStackDevtools
            plugins={[
              {
                name: "TanStack Query",
                render: <ReactQueryDevtoolsPanel />,
              },
              {
                name: "TanStack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              // useTable に key を渡した table が登録される (ADR-0018)
              tableDevtoolsPlugin(),
              // axe-core を開発中の画面へ当てる。テスト側の強制 (src/test/a11y/a11y.ts) は書いた
              // ケースしか見ないため、画面を触りながら気付ける経路を別に持つ。
              // panel は host から theme と devtoolsOpen を受け取るので plugin 形で渡す
              a11yDevtoolsPlugin(),
            ]}
          />
        </main>
        <LiveRegions />
        <Scripts />
      </body>
    </html>
  );
}
