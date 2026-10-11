import { useNavigate, useRouter } from "@tanstack/react-router";

import {
  createRouteDialogFinalFocus,
  type RouteDialogFinalFocus,
} from "@/lib/route-dialog-final-focus";

import { hasNotesChildMatch } from "../-lib/note-dialog-focus";

/**
 * 一覧の上に重ねるダイアログが、route から受けるハンドラ (ADR-0010)。
 *
 * - onClosed: 一覧へ戻る。一覧の絞り込み (search) を保ち、新しい履歴を積むので、戻るで開き直せる
 * - finalFocus: 閉じたときの focus の移し先 (Base UI の `finalFocus`)
 */
export interface NoteDialogNavigation {
  onClosed: () => void;
  finalFocus: RouteDialogFinalFocus;
}

/**
 * 一覧の上に重ねるダイアログの route が、ダイアログへ渡すハンドラを作る。一覧のページの route tree の形 (戻り先、
 * 一覧の `<Outlet />` にダイアログが表示されているか) はここだけが知り、汎用の部品へ渡す。
 * `findReturnTarget` は開いた元の要素 (行の編集リンク、追加のリンク) を探す
 */
export function useNoteDialogNavigation(
  findReturnTarget: () => HTMLElement | null,
): NoteDialogNavigation {
  const navigate = useNavigate({ from: "/notes" });
  const router = useRouter();
  function onClosed() {
    void navigate({ to: "/notes", search: (prev) => prev });
  }
  const finalFocus = createRouteDialogFinalFocus({
    // `router.state` は描画の値ではなく読んだ時点の状態を返す (Router docs「useRouter hook」)。hook で読んだ
    // 値は最後の描画のもので、unmount の時点の遷移先を映さない
    isDialogShown: () => hasNotesChildMatch(router.state.matches),
    findReturnTarget,
  });
  return { onClosed, finalFocus };
}
