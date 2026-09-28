import { expect, it } from "vite-plus/test";

import { RouterInnerWrap } from "@/components/router-inner-wrap";
import { PendingContent } from "@/components/screens/pending";

import { getRouter } from "./router";

// pending 表示を持たない route には Suspense 境界が張られず、suspend は root の Outlet まで
// 巻き上がる。既定が無いとそこで何も描かれない (ADR-0029)
it("route が pending 表示を持たないときの受け皿として PendingContent を既定にする", () => {
  expect(getRouter().options.defaultPendingComponent).toBe(PendingContent);
});

// root route の error boundary の外で router を購読する部品 (遷移の読み上げなど) と Provider を置く 1 か所を渡す
it("InnerWrap に RouterInnerWrap を渡す", () => {
  expect(getRouter().options.InnerWrap).toBe(RouterInnerWrap);
});
