import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { focusPageHeading } from "@/lib/focus-page-heading";
import { announce } from "@/lib/live-announcer";
import { shouldAnnounceNavigation } from "@/lib/route-announcement";

/**
 * クライアント遷移を利用者に伝える。新しいページの見出し (失敗の画面では失敗の見出し、ほかは h1) へ focus を移し、
 * `document.title` を読み上げる。
 * 遷移の後にモーダルのダイアログが開いていれば、focus はダイアログに任せ、読み上げだけを行う (`focusPageHeading`)。
 * `RouterInnerWrap` (router-inner-wrap.tsx) の中に置く。root route の error boundary の外にあるので、
 * root のエラー画面に置き換わっても購読は外れない (docs/guides/react/effects.md「router との間の副作用の置き場所」)。
 * `onRendered` の時点で title と見出しは新しいページの値になっているので、遅延を入れない。
 */
export function RouteAnnouncer() {
  const router = useRouter();
  useEffect(() => {
    // 遷移中に focus がどこかの要素へ移ったか。HTML Standard の navigation API が持つ
    // "focus changed during ongoing navigation" と同じく、移った先が遷移の前と同じ要素でも移ったとみなす
    let focusChanged = false;
    const recordFocusChange = () => {
      focusChanged = true;
    };
    const unsubscribeBefore = router.subscribe("onBeforeNavigate", () => {
      focusChanged = false;
      document.addEventListener("focusin", recordFocusChange);
    });
    const unsubscribeRendered = router.subscribe("onRendered", (event) => {
      // 伝えない遷移 (検索条件だけの変化) でも記録を止める
      document.removeEventListener("focusin", recordFocusChange);
      if (!shouldAnnounceNavigation(event)) {
        return;
      }
      focusPageHeading(focusChanged);
      announce(document.title);
    });
    return () => {
      document.removeEventListener("focusin", recordFocusChange);
      unsubscribeBefore();
      unsubscribeRendered();
    };
  }, [router]);
  return null;
}
