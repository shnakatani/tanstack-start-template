import { cn } from "cn";
import { useId, useTransition, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * `focusableWhenDisabled` の Button は native `disabled` を付けないため、registry の
 * `disabled:` variant (`src/components/ui/button.tsx`) が当たらない。Base UI が付ける
 * `data-disabled` で同じ見た目にする (Base UI Button docs の Loading states と同じ形)。
 * Action 層の部品は常に当て、Action 層の外で `focusableWhenDisabled` を使う箇所もこれを当てる。
 */
const actionDisabledAppearance = "data-disabled:pointer-events-none data-disabled:opacity-50";

type ActionButtonShellProps = Omit<
  ComponentProps<typeof Button>,
  "disabled" | "focusableWhenDisabled" | "children" | "aria-labelledby"
> & {
  isPending: boolean;
  children: ReactNode;
  /** pending 中の status の accessible name */
  pendingLabel?: string;
};

/**
 * pending を prop で受ける Button の共通部 (ADR-0014「Action 層」)。`ActionButton` と
 * `ActionFormSubmit` (`form.tsx`) が使う。
 *
 * - pending 中は `disabled` + `focusableWhenDisabled` で `aria-disabled` にし、フォーカスを保ったまま
 *   Base UI が click を止める。決着前の二重発火はこの `isPending` だけで塞ぐ (react.dev の
 *   useTransition / useFormStatus が示す `disabled={pending}` の形)。React はユーザーイベントごとに
 *   次のイベントより前へ DOM 更新を終える (reactwg/react-18 #21) ので、ref や閉包のフラグは持たない
 *   (ADR-0014「二重発火は state だけで塞ぐ」、検証方法は ADR-0015)
 * - accessible name は `aria-labelledby` で children に固定する。status の文言を子に置くと
 *   name from content で「処理中保存」のように名前が変わり、AT の読み上げとテストの
 *   `exact: true` が揺れる。`aria-label` を渡した部品はそちらが名前になる
 * - 名前の与え方は children か `aria-label` に限る。`aria-labelledby` は内部で使うため prop から
 *   外してある (受け付けたまま `{...props}` の後で上書きすると、渡した側から見て黙って消える)
 * - 状態は registry の `Spinner` が持つ `role="status"` に `aria-label` を与えて伝える
 *   (`.claude/rules/implementation.md`「accessible name の与え方」の状態表示の行の svg の例外)
 */
function ActionButtonShell({
  isPending,
  children,
  pendingLabel = "処理中",
  "aria-label": ariaLabel,
  className,
  ...props
}: ActionButtonShellProps) {
  const labelId = useId();

  return (
    <Button
      {...props}
      className={cn(actionDisabledAppearance, className)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel === undefined ? labelId : undefined}
      disabled={isPending}
      focusableWhenDisabled
    >
      {isPending && <Spinner aria-label={pendingLabel} />}
      <span id={labelId}>{children}</span>
    </Button>
  );
}

type ActionButtonProps = Omit<ActionButtonShellProps, "isPending" | "onClick"> & {
  /** クリックで実行する Action。`startTransition` に渡し、決着まで pending になる (ADR-0014) */
  action: () => Promise<void> | void;
};

/**
 * `action` prop を受ける Button (ADR-0014「Action 層」)。pending は `useTransition` の `isPending` から取る。
 * Action の reject はここでは握らない。呼び出し側が Action の中で処理し切る
 * (mutation は `useActionMutation` の `runAction` が吸収する)。
 */
function ActionButton({ action, ...props }: ActionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    // TransitionFunction は同期 / 非同期どちらも受け、非同期なら決着まで Transition が続く。
    // react.dev の例のように async 閉包で包み直す必要はない
    startTransition(action);
  }

  return (
    // form の中に置いても submit にならないよう type を button に固定する。上書きは props で可
    <ActionButtonShell type="button" {...props} onClick={handleClick} isPending={isPending} />
  );
}

export {
  ActionButton,
  ActionButtonShell,
  actionDisabledAppearance,
  type ActionButtonProps,
  type ActionButtonShellProps,
};
