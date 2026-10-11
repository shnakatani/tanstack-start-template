import { useNavigate, useRouter } from "@tanstack/react-router";

import { isNoteDialogRouteShown } from "../-lib/note-dialog-focus";

/**
 * 一覧の上に重ねるダイアログの route が、ダイアログへ渡す値とハンドラ (ADR-0010)。
 *
 * - onClosed: 一覧へ戻る。一覧の絞り込み (search) を保ち、新しい履歴を積むので、戻るで開き直せる
 * - isDialogRouteShown: focus の戻し先を決めるときに呼ぶ (`focusAfterRouteDialogClosed`)
 */
export function useNoteDialogRoute(): {
  onClosed: () => void;
  isDialogRouteShown: () => boolean;
} {
  const navigate = useNavigate({ from: "/notes" });
  const router = useRouter();
  function onClosed() {
    void navigate({ to: "/notes", search: (prev) => prev });
  }
  // `router.state` は描画の値ではなく読んだ時点の状態を返す (Router docs「useRouter hook」)。hook で読んだ値は
  // 最後の描画のもので、unmount の時点の遷移先を映さない
  function isDialogRouteShown() {
    return isNoteDialogRouteShown(router.state.matches);
  }
  return { onClosed, isDialogRouteShown };
}
