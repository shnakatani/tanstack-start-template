import { useId, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActionTransition } from "@/hooks/use-action-transition";

type ActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "disabled" | "focusableWhenDisabled" | "children"
> & {
  /** クリックで実行する Action。`startTransition` の中で await する (ADR-0014) */
  action: () => Promise<void> | void;
  children: ReactNode;
  /** pending 中の status の accessible name */
  pendingLabel?: string;
};

/**
 * `action` prop を受ける Button (ADR-0014「Action 層」)。
 *
 * - pending は `useTransition` の `isPending` から取る。`disabled` + `focusableWhenDisabled` で
 *   `aria-disabled` にし、フォーカスを保ったまま Base UI が click を止める
 * - accessible name は `aria-labelledby` で children に固定する。status の文言を子に置くと
 *   name from content で「処理中保存」のように名前が変わり、AT の読み上げとテストの
 *   `exact: true` が揺れる。`aria-label` を渡した部品はそちらが名前になる
 * - Action の reject はここでは握らない。呼び出し側が Action の中で処理し切る
 *   (mutation は `useActionMutation` の `runAction` が吸収する)
 */
function ActionButton({
  action,
  children,
  pendingLabel = "処理中",
  "aria-label": ariaLabel,
  ...props
}: ActionButtonProps) {
  const { isPending, run } = useActionTransition();
  const labelId = useId();

  function handleClick() {
    run(action);
  }

  return (
    // form の中に置いても submit にならないよう type を button に固定する。上書きは props で可
    <Button
      type="button"
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel === undefined ? labelId : undefined}
      onClick={handleClick}
      disabled={isPending}
      focusableWhenDisabled
    >
      <ActionButtonContent isPending={isPending} pendingLabel={pendingLabel} labelId={labelId}>
        {children}
      </ActionButtonContent>
    </Button>
  );
}

/**
 * Button の中身。`ActionFormSubmit` (`form.tsx`) と共有する。
 * Spinner は視覚専用 (`aria-hidden`)。状態は `<output>` (暗黙ロール status) + `aria-label` の sr-only 要素で伝える
 * (`.claude/rules/implementation.md`「accessible name の与え方」の状態表示の行)。
 */
function ActionButtonContent({
  isPending,
  pendingLabel,
  labelId,
  children,
}: {
  isPending: boolean;
  pendingLabel: string;
  labelId: string;
  children: ReactNode;
}) {
  return (
    <>
      {isPending && <Spinner aria-hidden />}
      <span id={labelId}>{children}</span>
      {isPending && (
        <output aria-label={pendingLabel} className="sr-only">
          {pendingLabel}
        </output>
      )}
    </>
  );
}

export { ActionButton, ActionButtonContent, type ActionButtonProps };
