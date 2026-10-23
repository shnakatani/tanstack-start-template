import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { focusPageHeading } from "@/lib/focus-page-heading";
import { announce } from "@/lib/live-announcer";
import { shouldAnnounceNavigation } from "@/lib/route-announcement";

/**
 * クライアント遷移を利用者に伝える。新しいページの h1 へ focus を移し、`document.title` を読み上げる。
 * 遷移の後にモーダルのダイアログが開いていれば、focus はダイアログに任せ、読み上げだけを行う (`focusPageHeading`)。
 * `RouterInnerWrap` (router-inner-wrap.tsx) の中に置く。root route の error boundary の外にあるので、
 * root のエラー画面に置き換わっても購読は外れない (docs/guides/react/effects.md「router との間の副作用の置き場所」)。
 * `onRendered` の時点で title と h1 は新しいページの値になっているので、遅延を入れない。
 */
export function RouteAnnouncer() {
  const router = useRouter();
  useEffect(() => {
    let focusedBeforeNavigation: Element | null = null;
    const unsubscribeBefore = router.subscribe("onBeforeNavigate", () => {
      focusedBeforeNavigation = document.activeElement;
    });
    const unsubscribeRendered = router.subscribe("onRendered", (event) => {
      // 外れた要素を次の遷移まで持たない。伝えない遷移 (検索条件だけの変化) でも手放す
      const focusedBefore = focusedBeforeNavigation;
      focusedBeforeNavigation = null;
      if (!shouldAnnounceNavigation(event)) {
        return;
      }
      focusPageHeading(focusedBefore);
      announce(document.title);
    });
    return () => {
      unsubscribeBefore();
      unsubscribeRendered();
    };
  }, [router]);
  return null;
}
