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
