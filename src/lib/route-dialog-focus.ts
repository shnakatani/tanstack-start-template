/**
 * ページの上に重ねるダイアログの route を閉じたときの focus の移し先。Base UI は `finalFocus` を、閉じたときだけで
 * なく、開いたまま unmount したときにも呼ぶ。分岐は ADR-0041「閉じたときの focus」の表の行と列に対応する。
 *
 * - closedBeforeUnmount: unmount の前に閉じ始めていたか。表の「閉じた」(閉じる操作、保存の応答)。開いたまま unmount
 *   したときは false
 * - atReturnTo: 開いたまま unmount したとき、router が戻り先 (閉じたときに離れる先) にいるか。true なら表の
 *   「戻る・進むで離れた」、false なら「別のダイアログに替わった」(読み込み中のダイアログが本物や失敗・見つからない
 *   のダイアログに替わった、別のダイアログの URL へ移った) と同じに扱う。戻り先でないページへ離れたときも false に
 *   なる。closedBeforeUnmount が true のときは見ない
 * - returnTarget: 開いた元の要素。表の列「開いた元のリンクがある / 無い」
 *
 * 返り値の `"page-heading"` は、呼び出し側がページの見出しへ枠を出さずに移し、Base UI へは `false` を返すこと
 * を表す。Base UI に要素を返すと、枠を出さない指定を渡せない (ADR-0035)。
 * 戻し先の要素は読まずにそのまま返すので、型を要素に限らない
 */
export function focusAfterRouteDialogClosed<Target>({
  closedBeforeUnmount,
  atReturnTo,
  returnTarget,
}: {
  closedBeforeUnmount: boolean;
  atReturnTo: boolean;
  returnTarget: Target | null;
}): Target | "page-heading" | false {
  // 閉じた時点でもダイアログの route は表示されたままなので、closedBeforeUnmount を先に見る
  if (closedBeforeUnmount) {
    return returnTarget ?? "page-heading";
  }
  // 替わったときに戻し先を返すと、替わる側のダイアログが次の frame で自分の入力欄へ focus を移すまでの間だけ、
  // 戻し先が focus を受ける (floating-ui/floating-ui#3509 と同じ仕組み)
  if (!atReturnTo) {
    return false;
  }
  // 戻し先が無ければ focus に触れず、route の announcer が見出しへ移す (ADR-0035)
  return returnTarget ?? false;
}
