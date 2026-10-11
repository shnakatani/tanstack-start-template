import type { RegisteredRouter, RouteIds } from "@tanstack/react-router";

import type { Note } from "@/features/notes/schema";
import { moveFocusToPageHeading } from "@/lib/focus-page-heading";

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
 * ダイアログの route が閉じた状況。Base UI は `finalFocus` を、閉じたときだけでなく、開いたまま unmount
 * したときにも呼ぶ
 *
 * - closed-by-user: 利用者が閉じた (保存の応答で閉じたときも含む)
 * - left: 開いたまま unmount し、ダイアログの route を離れた (戻る・進む)
 * - replaced: 開いたまま unmount し、別のダイアログの route が表示されている (読み込み中のダイアログが
 *   本物や失敗・見つからないのダイアログに替わった、開いたまま別のダイアログの URL へ移った)
 */
type RouteDialogCloseKind = "closed-by-user" | "left" | "replaced";

function closeKindOf(
  closedByUser: boolean,
  isDialogRouteShown: () => boolean,
): RouteDialogCloseKind {
  // 利用者が閉じた時点でもダイアログの route は表示されたままなので、closedByUser を先に見る
  if (closedByUser) {
    return "closed-by-user";
  }
  return isDialogRouteShown() ? "replaced" : "left";
}

/**
 * 一覧の上に重ねるダイアログの focus の戻し先 (Base UI の `finalFocus`)。閉じ方と戻し先の有無の組み合わせは
 * ADR-0041「閉じたときの focus」の表に従う。
 *
 * - closedByUser: 利用者が閉じたか。開いたまま unmount したときは false
 * - isDialogRouteShown: ダイアログの route が表示されているか。呼んだ時点の router の状態を読む関数を渡す
 * - findReturnTarget: 開いた元の要素 (行の編集リンク、追加のリンク) を探す。URL を直接開いたときは Base UI の
 *   既定の戻し先 (開く前に focus していた要素) が無いので、要素を探して返す
 *
 * replaced で戻し先を返すと、替わる側のダイアログが次の frame で自分の入力欄へ focus を移すまでの間だけ、
 * 戻し先が focus を受ける (floating-ui/floating-ui#3509 と同じ仕組み)。
 * 戻し先が無い (行が絞り込みで外れた、削除された) まま利用者が閉じたら、見出しへ自分で移す。Base UI に要素を
 * 返すと枠を出さない指定を渡せない (ADR-0035)
 */
export function focusAfterRouteDialogClosed({
  closedByUser,
  isDialogRouteShown,
  findReturnTarget,
}: {
  closedByUser: boolean;
  isDialogRouteShown: () => boolean;
  findReturnTarget: () => HTMLElement | null;
}): HTMLElement | false {
  const kind = closeKindOf(closedByUser, isDialogRouteShown);
  switch (kind) {
    case "replaced": {
      return false;
    }
    case "left": {
      return findReturnTarget() ?? false;
    }
    case "closed-by-user": {
      const target = findReturnTarget();
      if (target !== null) {
        return target;
      }
      moveFocusToPageHeading();
      return false;
    }
    default: {
      const unhandled: never = kind;
      throw new Error(`unhandled close kind: ${String(unhandled)}`);
    }
  }
}
