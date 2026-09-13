import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";

/**
 * `useMutation` の options。`onError` を必須にする。
 *
 * `runAction` は `mutateAsync` の reject を吸収するので、通知は `onError` だけが担う。
 * 省略できる型のままだと、忘れた mutation の失敗が toast も出ずに消える (ADR-0014)。
 */
export type ActionMutationOptions<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TOnMutateResult = unknown,
> = UseMutationOptions<TData, TError, TVariables, TOnMutateResult> & {
  onError: NonNullable<UseMutationOptions<TData, TError, TVariables, TOnMutateResult>["onError"]>;
};

export type ActionMutationResult<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TOnMutateResult = unknown,
> = UseMutationResult<TData, TError, TVariables, TOnMutateResult> & {
  /**
   * Action (`startTransition` に渡す非同期関数) から呼ぶ入口。
   * `mutateAsync` を await するので、`onSuccess` が返した Promise (再取得など) の決着まで
   * Transition が続く。reject は吸収する (通知は `onError` 済み)。
   */
  runAction: (variables: TVariables) => Promise<void>;
};

/**
 * Action 層から呼ぶ mutation。`useMutation` の薄い wrapper (ADR-0014「mutation の書き方」)。
 *
 * `mutate` ではなく `mutateAsync` を使う理由: `mutate` は Promise を返さず reject も
 * `.catch(noop)` で握るため、Transition が完了も失敗も観測できない。
 */
export function useActionMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: ActionMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): ActionMutationResult<TData, TError, TVariables, TOnMutateResult> {
  const mutation = useMutation(options);

  async function runAction(variables: TVariables): Promise<void> {
    try {
      await mutation.mutateAsync(variables);
    } catch {
      // 失敗の通知は options.onError (型で必須) が済ませている。ここで再 throw すると
      // Action の reject として最寄りの Error Boundary へ届き、画面ごと差し替わる
    }
  }

  return { ...mutation, runAction };
}
