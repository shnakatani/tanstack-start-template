import {
  createContext,
  use,
  useTransition,
  type ComponentProps,
  type ReactNode,
  type SubmitEvent,
} from "react";

import { ActionButtonShell, type ActionButtonShellProps } from "@/components/action/button";

// 値は boolean そのもの。オブジェクトにすると毎レンダー新しい参照になり
// `react/jsx-no-constructed-context-values` に当たる
const ActionFormContext = createContext<boolean | null>(null);

type ActionFormProps = Omit<ComponentProps<"form">, "onSubmit" | "children"> & {
  /** submit で実行する Action。`startTransition` に渡し、決着まで pending になる (ADR-0022) */
  submitAction: () => Promise<void> | void;
  children: ReactNode;
};

/**
 * submit を Transition にする `<form>` (ADR-0022「Action 層」)。`ui/` に対応部品が無い唯一の例外で、
 * 素の `<form>` を包む。pending は子孫の `ActionFormSubmit` が context から読む
 * (React の `<form action>` + `useFormStatus` と同じ形。使わない理由は ADR-0022「Action 層」)。
 */
function ActionForm({ submitAction, children, ...props }: ActionFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // ActionFormSubmit 以外の submit 経路 (素の submit ボタン、Enter) でも決着前の再 submit を塞ぐ
    if (isPending) {
      return;
    }
    startTransition(submitAction);
  }

  return (
    <form {...props} onSubmit={handleSubmit}>
      <ActionFormContext value={isPending}>{children}</ActionFormContext>
    </form>
  );
}

// submit ボタンの onClick は native の submit と共存するので通す (ActionButton と違い握らない)
type ActionFormSubmitProps = Omit<ActionButtonShellProps, "isPending" | "type">;

/** `ActionForm` の submit ボタン。pending は `ActionForm` の Transition から context 経由で読む。 */
function ActionFormSubmit(props: ActionFormSubmitProps) {
  const isPending = use(ActionFormContext);
  if (isPending === null) {
    throw new Error("[ActionFormSubmit] ActionForm の中で使う");
  }

  return <ActionButtonShell {...props} type="submit" isPending={isPending} />;
}

export { ActionForm, ActionFormSubmit, type ActionFormProps, type ActionFormSubmitProps };
