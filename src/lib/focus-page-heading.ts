/**
 * クライアント遷移の後、新しいページの h1 へ focus を移す。スクリーンリーダーは見出しを読み、
 * キーボードの次の Tab は新しいページの先頭から始まる。
 * 移し先は文書順で最初の h1。レイアウトに h1 を置くと、遷移のたびにそちらへ移る。
 *
 * 遷移中にアプリが別の要素へ focus を移していたら奪わない (Navigation API の focusReset の既定と同じ条件)。
 * 移すのは、focus が body にある (focus していた要素が消えた) ときと、遷移前の要素に残っているときだけ。
 * 見出しが支援技術から隠れているときと、`role` と `aria-modal="true"` を持つダイアログが開いているときも移さない。
 * モーダルのダイアログは開くと focus を自分の中へ移すので、その背後の見出しを経由させない (ADR-0035)。
 * スクロール位置は router の scrollRestoration が決めるので、focus ではスクロールさせない。
 */
export function focusPageHeading(focusedBeforeNavigation: Element | null): void {
  const active = document.activeElement;
  // null (focus を持つ要素が無い) と body は、focus していた要素が消えた状態なので移してよい
  const focusLost = active === null || active === document.body;
  if (!focusLost && active !== focusedBeforeNavigation) {
    return;
  }
  const heading = document.querySelector("h1");
  if ((heading !== null && isHiddenFromAssistiveTechnology(heading)) || hasOpenModalDialog()) {
    return;
  }
  focusHeadingOrBody(heading);
}

/**
 * 祖先か自身が `aria-hidden="true"` か `inert` なら、支援技術から隠れている。そこへ focus を移すと、
 * 読み上げの順序から外れたまま focus だけが乗る (axe の aria-hidden-focus)。
 * Base UI のモーダルのダイアログは、開いている間その外側を `aria-hidden="true"` で隠す
 */
function isHiddenFromAssistiveTechnology(element: Element): boolean {
  return element.closest('[aria-hidden="true"], [inert]') !== null;
}

/**
 * 外側を隠さず `aria-modal="true"` だけでモーダルを表すダイアログが、表示されているか。`role` 属性を
 * 明示したダイアログ (Base UI の Dialog の形) だけを見る。`showModal()` で開いた `<dialog>` は当たらない
 */
function hasOpenModalDialog(): boolean {
  const dialogs = document.querySelectorAll(
    '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]',
  );
  return [...dialogs].some((dialog) => dialog.checkVisibility());
}

/**
 * ページの h1 へ、枠を出さずに focus を移す。h1 が無ければ body へ。focus を奪ってよいかの判定は
 * 呼び出し側が持つ
 */
export function moveFocusToPageHeading(): void {
  focusHeadingOrBody(document.querySelector("h1"));
}

function focusHeadingOrBody(heading: HTMLHeadingElement | null): void {
  if (heading === null) {
    // どのページも PageHeader で h1 を持つ。無いのはページの組み方の漏れなので残す
    console.warn("[focusPageHeading] h1 が無い", { pathname: window.location.pathname });
    focusBody();
    return;
  }
  if (!heading.hasAttribute("tabindex")) {
    heading.setAttribute("tabindex", "-1");
  }
  // 遷移はキーボード操作の後にも起こるが、ブラウザ既定の判定では直前の入力がキーボードだと
  // 移した先にも :focus-visible の枠が出る。アプリ標準の focus 表現と食い違うため明示的に外す
  heading.focus({ preventScroll: true, focusVisible: false });
}

/** body は tabindex が無いと focus() を受けない。focus の起点だけを置き、属性は外す */
function focusBody(): void {
  document.body.setAttribute("tabindex", "-1");
  document.body.focus({ preventScroll: true, focusVisible: false });
  document.body.removeAttribute("tabindex");
}
