import type { Note } from "@/features/notes/schema";
import { moveFocusToPageHeading } from "@/lib/focus-page-heading";

/** 行の編集リンクに付ける属性。編集ダイアログを閉じたときに、その行のリンクを探す */
const NOTE_EDIT_LINK_ATTRIBUTE = "data-note-edit-link";

export function noteEditLinkProps(noteId: Note["id"]): { "data-note-edit-link": string } {
  return { [NOTE_EDIT_LINK_ATTRIBUTE]: String(noteId) };
}

/**
 * 編集ダイアログの focus の戻し先 (Base UI の `finalFocus`)。Base UI は閉じたときだけでなく、開いたまま
 * unmount したとき (戻る・進むで route を離れた、読み込み中のダイアログが本物に替わった) にも呼ぶ。
 *
 * 開いた行の編集リンクがあれば、そこへ戻す。URL を直接開いたときは、Base UI の既定 (開く前に focus して
 * いた要素) が無く body に落ちるので、行のリンクを探して返す。
 * 行が一覧に無い (絞り込みで外れた、削除された) とき:
 * - 利用者が閉じた (`closedByUser`) なら、ページの見出しへ枠を出さずに移す (ADR-0035)。Base UI に要素を
 *   返すと枠の扱いを渡せないので、自分で移して Base UI には何もさせない
 * - 開いたまま unmount したなら、focus に触れない。route を離れる遷移は route の announcer が見出しへ移す
 */
export function focusAfterNoteEditClosed(
  noteId: Note["id"],
  { closedByUser }: { closedByUser: boolean },
): HTMLElement | false {
  const link = document.querySelector<HTMLElement>(`[${NOTE_EDIT_LINK_ATTRIBUTE}="${noteId}"]`);
  if (link !== null) {
    return link;
  }
  if (closedByUser) {
    moveFocusToPageHeading();
  }
  return false;
}
