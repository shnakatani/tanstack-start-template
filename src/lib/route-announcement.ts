/**
 * クライアント遷移を利用者に伝えるか (見出しへの focus と title の読み上げ)。
 * 検索条件だけの変化は伝えない。focus を動かすと検索の入力欄から外れ、件数の通知 (ADR-0027) とも重なる。
 * 最初のページはブラウザが読むので伝えない。クライアントで描いた最初のページは `pathChanged` が
 * true で来るため、`fromLocation` の有無で除く。
 */
export function shouldAnnounceNavigation(event: {
  fromLocation?: unknown;
  pathChanged: boolean;
}): boolean {
  return event.fromLocation !== undefined && event.pathChanged;
}

/** 遷移の前後の match のうち、ダイアログの行き来の判定に使う項目 */
export interface DialogToggleMatch {
  routeId: string;
  pathname: string;
  staticData: { dialogRoute?: boolean };
}

/**
 * ページとその上に重ねたダイアログの route の間の遷移か。ダイアログでない一番深い match が前後で同じで、
 * 前後のどちらかにダイアログの route があるときに当たる。この遷移では focus をダイアログ (Base UI) に任せる。
 * 見出しへ移すと、閉じたあと Base UI が開いたリンクへ戻した focus を奪う
 */
export function isDialogToggle(
  from: readonly DialogToggleMatch[],
  to: readonly DialogToggleMatch[],
): boolean {
  const fromPages = from.filter((match) => match.staticData.dialogRoute !== true);
  const toPages = to.filter((match) => match.staticData.dialogRoute !== true);
  const hasDialog = fromPages.length !== from.length || toPages.length !== to.length;
  const fromPage = fromPages.at(-1);
  const toPage = toPages.at(-1);
  return (
    hasDialog &&
    fromPage !== undefined &&
    toPage !== undefined &&
    fromPage.routeId === toPage.routeId &&
    fromPage.pathname === toPage.pathname
  );
}
