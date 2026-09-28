/**
 * クライアント遷移の後、新しいページの h1 へ focus を移す。スクリーンリーダーは見出しを読み、
 * キーボードの次の Tab は新しいページの先頭から始まる。
 *
 * 遷移中にアプリが別の要素へ focus を移していたら奪わない (Navigation API の focusReset の既定と同じ条件)。
 * 移すのは、focus が body にある (focus していた要素が消えた) ときと、遷移前の要素に残っているときだけ。
 * スクロール位置は router の scrollRestoration が決めるので、focus ではスクロールさせない。
 */
export function focusPageHeading(focusedBeforeNavigation: Element | null): void {
  const active = document.activeElement;
  if (active !== null && active !== document.body && active !== focusedBeforeNavigation) {
    return;
  }
  const heading = document.querySelector("h1");
  if (heading === null) {
    // どのページも PageHeader で h1 を持つ。無いのはページの組み方の漏れなので残す
    console.warn("[focusPageHeading] h1 が無い", { pathname: window.location.pathname });
    focusBody();
    return;
  }
  if (!heading.hasAttribute("tabindex")) {
    heading.setAttribute("tabindex", "-1");
  }
  heading.focus({ preventScroll: true });
}

/** body は tabindex が無いと focus() を受けない。focus の起点だけを置き、属性は外す */
function focusBody(): void {
  document.body.setAttribute("tabindex", "-1");
  document.body.focus({ preventScroll: true });
  document.body.removeAttribute("tabindex");
}
