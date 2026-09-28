import { expect, it } from "vite-plus/test";

import { RouteAnnouncer } from "@/components/route-announcer";
import { PendingContent } from "@/components/screens/pending";

import { getRouter } from "./router";

// pending 表示を持たない route には Suspense 境界が張られず、suspend は root の Outlet まで
// 巻き上がる。既定が無いとそこで何も描かれない (ADR-0029)
it("route が pending 表示を持たないときの受け皿として PendingContent を既定にする", () => {
  expect(getRouter().options.defaultPendingComponent).toBe(PendingContent);
});

// 遷移を見出しへの focus と title の読み上げで伝える。InnerWrap は root route の error boundary の外にある
it("InnerWrap に RouteAnnouncer を渡す", () => {
  expect(getRouter().options.InnerWrap).toBe(RouteAnnouncer);
});
