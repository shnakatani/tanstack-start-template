import type { DefaultError, Query, QueryCacheConfig } from "@tanstack/react-query";

type QueryCacheOnError = NonNullable<QueryCacheConfig["onError"]>;

/**
 * QueryCache の onError ハンドラを組み立てる。
 *
 * TanStack Query は invalidateQueries 由来の background refetch エラーを
 * promise.catch(noop) で握りつぶし、useSuspenseQuery も「cache に data がある状態」の
 * refetch 失敗を error boundary に throw しない (throwOnError は data === undefined のときのみ)。
 * 結果、mutation 成功でダイアログが閉じた後に一覧 refetch が失敗すると、古いデータが
 * 残ったまま何の表示も出ない silent failure になる。
 *
 * このハンドラは「部品が表示しているデータの refetch の失敗」だけを notify に流す。
 * 表示しているとは、query に data があり (query.state.data !== undefined)、購読している observer が
 * ある (query.getObserversCount() > 0) ことをいう。
 *
 * - 初回ロード失敗 (data === undefined) は error boundary (RouteErrorContent) が扱う
 * - observer の無い query の失敗 (閉じたダイアログの 1 件を loader が staleTime: 0 で取り直すなど) は、
 *   その取得を await した側 (route の errorComponent) が扱う
 *
 * どちらもここで通知すると二重表示になる。
 *
 * onError は query-core の fetch() catch 内で全 fetch 失敗時に発火する
 * (query-core: cache.config.onError?.(error, this))。data の有無は error reducer が
 * state.data を保持するため、発火時点の query.state.data で判別できる。observer の有無は
 * query.getObserversCount() (購読中の observer の数) で判別できる。
 *
 * ユーザーには固定の日本語文言を出す。raw error は "Failed to fetch" 等の英語・技術文言が
 * 多く、そのまま見せると非アクショナブルなため observability 用に console.warn に残す。
 *
 * @param notify 通知関数 (production では toast.add を使う関数を渡す)
 */
export const BACKGROUND_REFETCH_ERROR_MESSAGE =
  "最新データの取得に失敗しました。再読み込みしてください。";

export function createBackgroundRefetchErrorHandler(
  notify: (message: string) => void,
): QueryCacheOnError {
  return (error: DefaultError, query: Query<unknown, unknown, unknown>) => {
    // data === undefined は初回ロード失敗 = error boundary 行き。observer が無い query は表示していない
    // data の取り直し = 取得を await した側 (route の errorComponent) 行き。ここで通知すると二重表示になる
    if (query.state.data === undefined || query.getObserversCount() === 0) return;
    console.warn("[query-cache] background refetch failed", {
      queryHash: query.queryHash,
      error,
    });
    notify(BACKGROUND_REFETCH_ERROR_MESSAGE);
  };
}
