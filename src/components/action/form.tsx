import {
  createContext,
  use,
  useId,
  type ComponentProps,
  type ReactNode,
  type SubmitEvent,
} from "react";

import { ActionButtonContent } from "@/components/action/button";
import { Button } from "@/components/ui/button";
import { useActionTransition } from "@/hooks/use-action-transition";

// 値は boolean そのもの。オブジェクトにすると毎レンダー新しい参照になり
// `react/jsx-no-constructed-context-values` に当たる
const ActionFormContext = createContext<boolean | null>(null);

type ActionFormProps = Omit<ComponentProps<"form">, "onSubmit" | "children"> & {
  /** submit で実行する Action。`startTransition` の中で await する (ADR-0014) */
  submitAction: () => Promise<void> | void;
  children: ReactNode;
};

/**
 * submit を Transition にする `<form>` (ADR-0014「Action 層」)。`ui/` に対応部品が無い唯一の例外で、
 * 素の `<form>` を包む。pending は子孫の `ActionFormSubmit` が context から読む。
 */
function ActionForm({ submitAction, children, ...props }: ActionFormProps) {
  const { isPending, run } = useActionTransition();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    run(submitAction);
  }

  return (
    <form {...props} onSubmit={handleSubmit}>
      <ActionFormContext value={isPending}>{children}</ActionFormContext>
    </form>
  );
}

type ActionFormSubmitProps = Omit<
  ComponentProps<typeof Button>,
  "type" | "disabled" | "focusableWhenDisabled" | "children" | "aria-labelledby"
> & {
  children: ReactNode;
  /** pending 中の status の accessible name */
  pendingLabel?: string;
};

/**
 * `ActionForm` の submit ボタン。pending 中は `aria-disabled` でフォーカスを保ち、名前は children に固定する。
 *
 * 名前の与え方は children か `aria-label` に限る。`aria-labelledby` は内部で使うため prop から
 * 外してある (受け付けたまま `{...props}` の後で上書きすると、渡した側から見て黙って消える)。
 */
function ActionFormSubmit({
  children,
  pendingLabel = "処理中",
  "aria-label": ariaLabel,
  ...props
}: ActionFormSubmitProps) {
  const isPending = use(ActionFormContext);
  const labelId = useId();
  if (isPending === null) {
    throw new Error("[ActionFormSubmit] ActionForm の中で使う");
  }

  return (
    <Button
      {...props}
      type="submit"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel === undefined ? labelId : undefined}
      disabled={isPending}
      focusableWhenDisabled
    >
      <ActionButtonContent isPending={isPending} pendingLabel={pendingLabel} labelId={labelId}>
        {children}
      </ActionButtonContent>
    </Button>
  );
}

export { ActionForm, ActionFormSubmit, type ActionFormProps, type ActionFormSubmitProps };
