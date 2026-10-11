import { useNavigate, useRouter } from "@tanstack/react-router";

import { moveFocusToPageHeading } from "@/lib/focus-page-heading";

import { focusAfterRouteDialogClosed, hasNotesChildMatch } from "../-lib/note-dialog-focus";

/**
 * 一覧の上に重ねるダイアログが、route から受けるハンドラ (ADR-0010)。
 *
 * - onClosed: 一覧へ戻る。一覧の絞り込み (search) を保ち、新しい履歴を積むので、戻るで開き直せる
 * - finalFocus: 閉じたときの focus の移し先 (Base UI の `finalFocus`)。`closedByUser` は利用者が閉じたか。
 *   開いたまま unmount したときは false
 */
export interface NoteDialogNavigation {
  onClosed: () => void;
  finalFocus: (closedByUser: boolean) => HTMLElement | false;
}

/**
 * ダイアログの route が、ダイアログへ渡すハンドラを作る。`findReturnTarget` は開いた元の要素 (行の編集リンク、
 * 追加のリンク) を探す。URL を直接開いたときは Base UI の既定の戻し先 (開く前に focus していた要素) が無いので、
 * 要素を探して返す
 */
export function useNoteDialogNavigation(
  findReturnTarget: () => HTMLElement | null,
): NoteDialogNavigation {
  const navigate = useNavigate({ from: "/notes" });
  const router = useRouter();
  function onClosed() {
    void navigate({ to: "/notes", search: (prev) => prev });
  }
  function finalFocus(closedByUser: boolean) {
    const target = focusAfterRouteDialogClosed({
      closedByUser,
      // `router.state` は描画の値ではなく読んだ時点の状態を返す (Router docs「useRouter hook」)。hook で読んだ
      // 値は最後の描画のもので、unmount の時点の遷移先を映さない
      dialogRouteShown: hasNotesChildMatch(router.state.matches),
      returnTarget: findReturnTarget(),
    });
    if (target === "page-heading") {
      moveFocusToPageHeading();
      return false;
    }
    return target;
  }
  return { onClosed, finalFocus };
}
