import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

/**
 * テスト用の QueryClient。retry を切るのは、失敗ケースの検証が既定のリトライ回数だけ
 * 待たされてタイムアウトするため。`defaultOptions` は上書きさせず、queryCache のような
 * 差し込みだけを config で受ける (テストごとに retry の既定が変わると失敗の原因が読めない)。
 */
export function createTestQueryClient(config?: Omit<QueryClientConfig, "defaultOptions">) {
  return new QueryClient({
    ...config,
    defaultOptions: { queries: { retry: false } },
  });
}
