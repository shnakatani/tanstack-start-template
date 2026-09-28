import type { ReactNode } from "react";

import { RouteAnnouncer } from "./route-announcer";

/**
 * `createRouter` の `InnerWrap` に渡す 1 か所。root route の error boundary の外にあり、router の hooks を使える。
 * context の Provider を足すなら children を包み、DOM を描かず購読だけを持つ部品は children の兄弟に並べる。
 * InnerWrap には DOM を描かない部品だけを置く ("Only non-DOM-rendering components like providers should be used"、
 * TanStack Router docs `RouterOptions`「`InnerWrap` property」)。
 */
export function RouterInnerWrap({ children }: { children: ReactNode }) {
  return (
    <>
      <RouteAnnouncer />
      {children}
    </>
  );
}
