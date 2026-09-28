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
