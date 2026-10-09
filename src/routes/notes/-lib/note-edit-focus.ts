import type { Note } from "@/features/notes/schema";
import { moveFocusToPageHeading } from "@/lib/focus-page-heading";

/** 行の編集リンクに付ける属性。編集ダイアログを閉じたときに、その行のリンクを探す */
const NOTE_EDIT_LINK_ATTRIBUTE = "data-note-edit-link";

export function noteEditLinkProps(noteId: Note["id"]): { "data-note-edit-link": string } {
  return { [NOTE_EDIT_LINK_ATTRIBUTE]: String(noteId) };
}

/**
 * 編集ダイアログの focus の戻し先 (Base UI の `finalFocus`)。Base UI は閉じたときだけでなく、開いたまま
 * unmount したとき (戻る・進むで route を離れた、別の編集のダイアログに替わった) にも呼ぶ。
 *
 * - closedByUser: 利用者が閉じたか。開いたまま unmount したときは false
 * - isEditRouteActive: 編集の route が表示されているか。描画の時点の値ではなく、呼んだ時点の router の
 *   状態を読む関数を渡す。描画の時点の値は、unmount の時点の遷移先を映さない
 *
 * 開いたまま unmount し、編集の route が表示されたままなら、別の編集のダイアログに替わる (読み込み中の
 * ダイアログが本物に替わった、開いたまま別のメモの URL へ移った)。このときは focus を動かさない。替わりの
 * ダイアログは次の frame で自分の入力欄へ focus を移すので、行のリンクを返すと、その間だけリンクが focus を
 * 受ける。消える側の戻し先へ、替わる側の初期 focus より先に focus が移る仕組みは
 * floating-ui/floating-ui#3509 と同じ。
 *
 * それ以外は、開いた行の編集リンクがあれば、そこへ戻す。URL を直接開いたときは、Base UI の既定 (開く前に
 * focus していた要素) が無いので、行のリンクを探して返す。返さないと focus はダイアログと一緒に外れ、
 * 遷移の読み上げが見出しへ移すので、開いた行の位置を失う。
 * 行が一覧に無い (絞り込みで外れた、削除された) とき:
 * - 利用者が閉じたなら、ページの見出しへ枠を出さずに移す (ADR-0035)。Base UI に要素を返すと枠の扱いを
 *   渡せないので、自分で移して Base UI には何もさせない
 * - 開いたまま unmount したなら、focus に触れない。route を離れる遷移は route の announcer が見出しへ移す
 */
export function focusAfterNoteEditClosed(
  noteId: Note["id"],
  { closedByUser, isEditRouteActive }: { closedByUser: boolean; isEditRouteActive: () => boolean },
): HTMLElement | false {
  // 利用者が閉じた時点でも編集の route は表示されたままなので、closedByUser を先に見る
  if (!closedByUser && isEditRouteActive()) {
    return false;
  }
  const link = document.querySelector<HTMLElement>(`[${NOTE_EDIT_LINK_ATTRIBUTE}="${noteId}"]`);
  if (link !== null) {
    return link;
  }
  if (closedByUser) {
    moveFocusToPageHeading();
  }
  return false;
}
