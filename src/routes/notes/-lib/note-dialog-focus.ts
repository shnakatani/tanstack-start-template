import type { RegisteredRouter, RouteIds } from "@tanstack/react-router";

import type { Note } from "@/features/notes/schema";

/** 行の編集リンクに付ける属性。編集ダイアログを閉じたときに、その行のリンクを探す */
const NOTE_EDIT_LINK_ATTRIBUTE = "data-note-edit-link";

/** 追加のリンクに付ける属性。追加ダイアログを閉じたときに、そのリンクを探す */
const NOTE_CREATE_LINK_ATTRIBUTE = "data-note-create-link";

export function noteEditLinkProps(noteId: Note["id"]): { "data-note-edit-link": string } {
  return { [NOTE_EDIT_LINK_ATTRIBUTE]: String(noteId) };
}

export function noteCreateLinkProps(): { "data-note-create-link": string } {
  return { [NOTE_CREATE_LINK_ATTRIBUTE]: "" };
}

export function findNoteEditLink(noteId: Note["id"]): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${NOTE_EDIT_LINK_ATTRIBUTE}="${noteId}"]`);
}

export function findNoteCreateLink(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${NOTE_CREATE_LINK_ATTRIBUTE}]`);
}

/** 一覧の route。一覧の上に重ねるダイアログの route は、この子 route として一覧の `<Outlet />` に描く (ADR-0041) */
const NOTES_ROUTE_ID = "/notes" satisfies RouteIds<RegisteredRouter["routeTree"]>;

/**
 * 一覧の上に重ねるダイアログの route が表示されているか。`matches` の中で、一覧の route の match より後ろ (子) に
 * match があるかで見る。一覧の `<Outlet />` がダイアログの子 route だけを描く前提で、ダイアログでない子 route を
 * 足すと、それが表示されているときも true を返す。
 * `matches` は root から leaf の順に並ぶ (Router docs「useChildMatches hook」は、子の match を
 * "from the closest match down to the leaf-most match" で返す)。
 * 描画の時点の値ではなく、呼んだ時点の `router.state.matches` を渡す。描画の時点の値は、unmount の時点の遷移先を
 * 映さない
 */
export function hasNotesChildMatch(matches: readonly { routeId: string }[]): boolean {
  const notesIndex = matches.findIndex((match) => match.routeId === NOTES_ROUTE_ID);
  return notesIndex !== -1 && notesIndex < matches.length - 1;
}

/**
 * 一覧の上に重ねるダイアログを閉じたときの focus の移し先。Base UI は `finalFocus` を、閉じたときだけでなく、
 * 開いたまま unmount したときにも呼ぶ。分岐は ADR-0041「閉じたときの focus」の表の行と列に対応する。
 *
 * - closedBeforeUnmount: unmount の前に閉じ始めていたか。表の「閉じた」(閉じる操作、保存の応答)。開いたまま unmount
 *   したときは false
 * - dialogRouteShown: 開いたまま unmount したとき、true なら表の「別のダイアログに替わった」(読み込み中の
 *   ダイアログが本物や失敗・見つからないのダイアログに替わった、別のダイアログの URL へ移った)、false なら
 *   「戻る・進むで離れた」
 * - returnTarget: 開いた元の要素 (行の編集リンク、追加のリンク)。表の列「開いた元のリンクがある / 無い」
 *
 * 返り値の `"page-heading"` は、呼び出し側がページの見出しへ枠を出さずに移し、Base UI へは `false` を返すこと
 * を表す。Base UI に要素を返すと、枠を出さない指定を渡せない (ADR-0035)。
 * 戻し先の要素は読まずにそのまま返すので、型を要素に限らない
 */
export function focusAfterRouteDialogClosed<Target>({
  closedBeforeUnmount,
  dialogRouteShown,
  returnTarget,
}: {
  closedBeforeUnmount: boolean;
  dialogRouteShown: boolean;
  returnTarget: Target | null;
}): Target | "page-heading" | false {
  // 閉じた時点でもダイアログの route は表示されたままなので、closedBeforeUnmount を先に見る
  if (closedBeforeUnmount) {
    return returnTarget ?? "page-heading";
  }
  // 替わったときに戻し先を返すと、替わる側のダイアログが次の frame で自分の入力欄へ focus を移すまでの間だけ、
  // 戻し先が focus を受ける (floating-ui/floating-ui#3509 と同じ仕組み)
  if (dialogRouteShown) {
    return false;
  }
  // 戻し先が無ければ focus に触れず、route の announcer が見出しへ移す (ADR-0035)
  return returnTarget ?? false;
}
