import { a11yDevtoolsPlugin } from "@tanstack/devtools-a11y/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { FullScreenRouteError } from "@/components/route-error";
import { Toaster } from "@/components/ui/toast";
import { APP_NAME } from "@/lib/app-name";

import appCss from "@/styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
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
          // axe-core を開発中の画面へ当てる。テスト側の強制 (src/test/a11y.ts) は書いた
          // ケースしか見ないため、画面を触りながら気付ける経路を別に持つ。
          // panel は host から theme と devtoolsOpen を受け取るので plugin 形で渡す
          a11yDevtoolsPlugin(),
        ]}
      />
    </RootDocument>
  );
}

// route 境界より上で落ちたエラーの受け皿。全画面の枠は表示側 (route-error.tsx) が持つ
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <RootDocument>
      <FullScreenRouteError error={error} reset={reset} />
    </RootDocument>
  );
}

/** 文書の骨格。landmark を押さえるテストから直接呼べるよう named export にする */
export function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {/* ページ本体を landmark へ入れる。無いと支援技術に本文へ飛ぶ手段が無く、
            axe-core の region ルールが「All page content should be contained by landmarks」で報告する */}
        <main>{children}</main>
        <Scripts />
      </body>
    </html>
  );
}
