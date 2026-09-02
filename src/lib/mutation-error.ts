import { toast } from "@/components/ui/toast";

/** mutation 失敗時にユーザーへ出す固定文言。原因ではなく次に取れる行動だけを伝える。 */
export const MUTATION_ERROR_FALLBACK_MESSAGE =
  "操作に失敗しました。時間をおいて再試行してください。";

/**
 * mutation の onError で toast に出す文言を組み立てる。
 *
 * server function から返る Error は、どれも開発者向けの文言である
 * (`削除対象のノートが見つかりません: id=42` / `notes の読み出しがスキーマ検証に失敗しました ...`)。
 * ユーザーが取れる行動を含まないうえ、id や検証失敗の項目パスといった内部事情を画面へ運ぶため、
 * そのまま render せず固定文言へ丸める。infra / network 由来の raw error
 * ("Failed to fetch" 等の英語技術文言) も同じ扱いになる。
 *
 * raw error は observability のため console.warn に残す (fail-closed。
 * `query-cache-handlers.ts` の background refetch 用ハンドラと対になる意匠)。
 *
 * ユーザー向けの文言を持つエラーを導入するときは、その型の分岐をここへ足して
 * `error.message` を返す。分岐を足す場所をここ 1 箇所に閉じるために、
 * 呼び出し側は toast へ渡す文言をこの関数からのみ受け取る。
 */
export function curateMutationErrorMessage(error: unknown): string {
  console.warn("[mutation] failed", { error });
  return MUTATION_ERROR_FALLBACK_MESSAGE;
}

/**
 * mutation の `onError` へそのまま渡せるハンドラ。
 *
 * 「curate を通した文言だけを toast に出す」という配線を消費側ごとに書くと、
 * 1 箇所が `error.message` を直接渡す形へ戻っても他が正しいままで気付けない。
 * useMutation を足すときは onError にこれを渡す。
 *
 * 引数を `unknown` ではなく react-query の既定 TError (`Error`) で受けるのは、
 * onError へ渡したときに TError が `unknown` へ広がるのを防ぐため
 * (広がると UseMutationResult の型が消費側の契約と合わなくなる)。
 * 実行時に非 Error が来ても curateMutationErrorMessage が受け止める。
 */
export function toastMutationError(error: Error): void {
  toast.add({ type: "error", title: curateMutationErrorMessage(error) });
}
