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
    // 遷移中に focus がどこかの要素へ移ったか。focus している要素と違う要素が focus を受けたら移ったとみなし、
    // 移った先が遷移の前と同じ要素へ戻っても移ったとみなす。focus の位置が変わらないまま来る focusin は数えない
    // (HTML Standard の navigation API の "focus changed during ongoing navigation" と同じ)。
    // capture で受けるのは、下の要素の listener が stopPropagation しても記録を漏らさないため
    let focusChanged = false;
    let focused: EventTarget | null = null;
    const recordFocusChange = (event: FocusEvent) => {
      if (event.target !== focused) {
        focusChanged = true;
      }
      focused = event.target;
    };
    const unsubscribeBefore = router.subscribe("onBeforeNavigate", () => {
      focusChanged = false;
      focused = document.activeElement;
      document.addEventListener("focusin", recordFocusChange, { capture: true });
    });
    const unsubscribeRendered = router.subscribe("onRendered", (event) => {
      // 伝えない遷移 (検索条件だけの変化) でも記録を止める
      document.removeEventListener("focusin", recordFocusChange, { capture: true });
      if (!shouldAnnounceNavigation(event)) {
        return;
      }
      focusPageHeading(focusChanged);
      announce(document.title);
    });
    return () => {
      document.removeEventListener("focusin", recordFocusChange, { capture: true });
      unsubscribeBefore();
      unsubscribeRendered();
    };
  }, [router]);
  return null;
}
