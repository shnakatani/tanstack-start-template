import type { Note } from "@/features/notes/schema";
import { moveFocusToPageHeading } from "@/lib/focus-page-heading";

/** 行の編集リンクに付ける属性。編集ダイアログを閉じたときに、その行のリンクを探す */
const NOTE_EDIT_LINK_ATTRIBUTE = "data-note-edit-link";

export function noteEditLinkProps(noteId: Note["id"]): { "data-note-edit-link": string } {
  return { [NOTE_EDIT_LINK_ATTRIBUTE]: String(noteId) };
}

/**
 * 編集ダイアログを閉じたときの focus の移し先 (Base UI の `finalFocus`)。開いた行の編集リンクへ戻す。
 * URL を直接開いたときは、Base UI の既定 (開く前に focus していた要素) が無く body に落ちる。
 * 行が一覧に無ければ (絞り込みで外れた、削除された) ページの見出しへ移す。見出しには枠を出さない (ADR-0035)。
 * Base UI に要素を返すと枠の扱いを渡せないので、自分で移して Base UI には何もさせない
 */
export function focusAfterNoteEditClosed(noteId: Note["id"]): HTMLElement | false {
  const link = document.querySelector<HTMLElement>(`[${NOTE_EDIT_LINK_ATTRIBUTE}="${noteId}"]`);
  if (link !== null) {
    return link;
  }
  moveFocusToPageHeading();
  return false;
}
