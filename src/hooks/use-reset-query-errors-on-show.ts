import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useEffect } from "react";

/**
 * 失敗の表示 (route の errorComponent、区画の失敗の表示) が出た時点で Query の失敗を戻し、再試行の時点で
 * もう一度戻す関数を返す。理由と使い分けは `docs/guides/data-loading.md`「読み込みに失敗した画面から再試行する」
 */
export function useResetQueryErrorsOnShow(): () => void {
  const { reset } = useQueryErrorResetBoundary();

  useEffect(() => {
    reset();
  }, [reset]);

  return reset;
}
