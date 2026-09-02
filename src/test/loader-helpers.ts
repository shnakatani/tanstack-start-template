/**
 * route loader の単体テスト用ヘルパー。
 *
 * loader 本体が `queryClient.query` を「期待するクエリキー全て」で呼ぶことを検証するため、
 * `vi.spyOn(queryClient, "query").mock.calls` を渡すと、各呼び出しの queryKey を
 * JSON 文字列化した配列を返す。テスト側は `expect(keys).toContain(JSON.stringify([...]))` で
 * キー網羅を assert する。
 *
 * loader が誤った queryOptions を ensure した場合 (キー欠落・誤キー) を捕捉するのが目的のため、
 * queryKey を持たない引数で呼ばれたら silent に無視せず throw する (= テスト前提の破綻を顕在化)。
 */
export function collectLoaderQueryKeys(calls: unknown[][]): string[] {
  return calls.map((call) => {
    const options = call[0];
    if (typeof options !== "object" || options === null || !("queryKey" in options)) {
      throw new Error(`query was called without a queryKey option: ${JSON.stringify(options)}`);
    }
    return JSON.stringify(options.queryKey);
  });
}
