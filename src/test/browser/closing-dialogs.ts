import { onTestFinished } from "vite-plus/test";

import { enableAnimations } from "./animations";

/** 閉じかけのダイアログの本体。閉じるアニメーションを遅らせる style と、それが効いたかを見る observer が共有する */
const CLOSING_DIALOG_SELECTOR = "[data-slot=dialog-content][data-closed]";

/**
 * このテストの間、ダイアログの閉じるアニメーションを 60 秒に延ばす。閉じるアニメーションの間に起きること
 * (アニメーションを待ってから route を離れるか、待たずに離れるか) を、窓が閉じる前に観測できる。
 * 返す関数は、閉じる途中の要素に style が効いていたか。掴めなくなるとアニメーションが即座に終わり、窓を
 * 観測しないまま通る
 */
export function slowDownClosingDialogs(): () => boolean {
  enableAnimations();
  const slowClose = document.createElement("style");
  slowClose.textContent = `${CLOSING_DIALOG_SELECTOR} { animation-duration: 60s !important; }`;
  document.head.append(slowClose);
  onTestFinished(() => slowClose.remove());
  let slowedWhileClosing = false;
  const watchClosing = new MutationObserver(() => {
    // locator は使えない: 閉じる操作の時点で route を離れると、閉じかけの要素は直ちに外れ、retry の間隔では
    // 捉えられない
    const closing = document.querySelector(CLOSING_DIALOG_SELECTOR);
    if (closing && getComputedStyle(closing).animationDuration === "60s") {
      slowedWhileClosing = true;
      watchClosing.disconnect();
    }
  });
  watchClosing.observe(document.body, { attributes: true, subtree: true });
  onTestFinished(() => watchClosing.disconnect());
  return () => slowedWhileClosing;
}
