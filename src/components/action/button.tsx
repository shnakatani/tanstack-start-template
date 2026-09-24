import { useId, useTransition, type ComponentProps, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type ActionButtonShellProps = Omit<
  ComponentProps<typeof Button>,
  "disabled" | "focusableWhenDisabled" | "children" | "aria-labelledby"
> & {
  isPending: boolean;
  children: ReactNode;
};

/**
 * pending を prop で受ける Button の共通部 (ADR-0016「Action 層」)。`ActionButton` と
 * `ActionFormSubmit` (`form.tsx`) が使う。
 *
 * - pending 中は `disabled` + `focusableWhenDisabled` で `aria-disabled` にし、フォーカスを保ったまま
 *   Base UI が click を止める。決着前の二重発火はこの `isPending` だけで塞ぐ (react.dev の
 *   useTransition / useFormStatus が示す `disabled={pending}` の形)。React はユーザーイベントごとに
 *   次のイベントより前へ DOM 更新を終える (reactwg/react-18 #21) ので、ref や閉包のフラグは持たない
 *   (ADR-0016「二重発火は state だけで塞ぐ」、検証方法は docs/guides/testing/user-interactions.md「クリックを発火する」)
 * - accessible name は `aria-labelledby` で children に固定する。pending の文言を子に置くと
 *   name from content で「処理中保存」のように名前が変わり、AT の読み上げとテストの
 *   `exact: true` が揺れる。`aria-label` を渡した部品はそちらが名前になる
 * - 名前の与え方は children か `aria-label` に限る。`aria-labelledby` は内部で使うため prop から
 *   外してある (受け付けたまま `{...props}` の後で上書きすると、渡した側から見て黙って消える)
 * - 状態は要素自身の `aria-busy` + `aria-disabled` で持つ。`Spinner` は視覚専用 (`aria-hidden`)。
 *   WAI-ARIA 1.2 §5.2.9 により button の子孫はユーザーエージェントが accessibility API に
 *   露出すべきでないので、子の `role="status"` に頼らない。通知は feature 側が `announce()`
 *   (ADR-0026) で出す
 */
function ActionButtonShell({
  isPending,
  children,
  "aria-label": ariaLabel,
  ...props
}: ActionButtonShellProps) {
  const labelId = useId();

  return (
    <Button
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel === undefined ? labelId : undefined}
      // button の子孫はユーザーエージェントが accessibility API に露出すべきでない
      // (WAI-ARIA 1.2 §5.2.9 Children Presentational)。状態は要素自身に付ける
      aria-busy={isPending}
      disabled={isPending}
      focusableWhenDisabled
    >
      {isPending && <Spinner aria-hidden />}
      <span id={labelId}>{children}</span>
    </Button>
  );
}

type ActionButtonProps = Omit<ActionButtonShellProps, "isPending" | "onClick"> & {
  /** クリックで実行する Action。`startTransition` に渡し、決着まで pending になる (ADR-0016) */
  action: () => Promise<void> | void;
};

/**
 * `action` prop を受ける Button (ADR-0016「Action 層」)。pending は `useTransition` の `isPending` から取る。
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

export { ActionButton, ActionButtonShell, type ActionButtonProps, type ActionButtonShellProps };
