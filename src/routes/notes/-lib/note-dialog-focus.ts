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
