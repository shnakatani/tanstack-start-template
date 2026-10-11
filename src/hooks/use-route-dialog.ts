import {
  useMatch,
  useNavigate,
  useRouter,
  type AnyRouter,
  type RegisteredRouter,
  type ValidateNavigateOptions,
} from "@tanstack/react-router";
import { useState, type ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";
import { moveFocusToPageHeading } from "@/lib/focus-page-heading";
import { focusAfterRouteDialogClosed } from "@/lib/route-dialog-focus";

/**
 * - returnTo: 閉じたときに離れる先 (開く元のページ)。`navigate` にそのまま渡すので、search を保つなら
 *   `search: (prev) => prev` を書く。`from` が無ければ、相対の `to` はダイアログの route から解く。
 *   閉じたときの focus を決めるときは、呼ばれた時点の router がここにいるかで、
 *   戻る・進むで離れたか別のダイアログに替わったかを分ける
 * - findReturnTarget: 開いた元の要素を探す。URL を直接開いたときは Base UI の既定の戻し先 (開く前に focus して
 *   いた要素) が無いので、要素を探して返す
 * - isPending: 保存の mutation の pending。保存しないダイアログは渡さない
 * - waitForCloseAnimation: false なら閉じる操作か `setOpen(false)` の時点で離れる。読み込み中のダイアログに渡す
 */
export interface RouteDialogOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
> {
  returnTo: ValidateNavigateOptions<TRouter, TOptions>;
  findReturnTarget: () => HTMLElement | null;
  isPending?: boolean;
  waitForCloseAnimation?: boolean;
}

/**
 * `open`、`onOpenChange`、`onOpenChangeComplete` は Dialog の Root へ、`finalFocus` は Popup
 * (`DialogContent`、`ActionDialogContent`) へ、`blocksClose` はキャンセルの `DialogClose` の `disabled` へ渡す。
 * `setOpen(false)` は保存の応答で閉じるときに呼ぶ。`onOpenChange` を通らないので、close の停止に止められない
 */
export interface RouteDialog {
  open: boolean;
  setOpen: (open: boolean) => void;
  blocksClose: boolean;
  onOpenChange: NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]>;
  onOpenChangeComplete: (open: boolean) => void;
  finalFocus: () => HTMLElement | false;
}

/**
 * route として開くダイアログの開閉と、閉じたあとの遷移と focus (ADR-0041)。開いた状態で mount し、閉じる操作では
 * open を false にし、閉じるアニメーションが終わってから `returnTo` へ新しい履歴で離れる。先に離れると route
 * ごと unmount して、閉じるアニメーションが出ない。
 * `returnTo` の型は TanStack Router の Type Utilities の `ValidateNavigateOptions` で検査する。公開の
 * signature を generic にし、実装の signature を generic にしない形は、Type Utilities のガイドの
 * `useConditionalNavigate` に倣う。`TRouter` の制約はガイドの例の `RegisteredRouter` ではなく、
 * `ValidateNavigateOptions` 自身と同じ `AnyRouter` にする。テストが自分で組んだ router の型を渡せる
 */
export function useRouteDialog<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown>(
  options: RouteDialogOptions<TRouter, TOptions>,
): RouteDialog;
export function useRouteDialog({
  returnTo,
  findReturnTarget,
  isPending = false,
  waitForCloseAnimation = true,
}: RouteDialogOptions): RouteDialog {
  // 相対の `to` (`..`) を、どの時点で組んでもこのダイアログの route から解く。`from` が無いと、組んだ時点の
  // location から解く (TanStack Router「RouterType」の `.buildLocation`)。戻るで離れたあとの `finalFocus` では
  // 戻った先から解いてしまい、戻り先と食い違う
  const dialogPath = useMatch({ strict: false }).fullPath;
  const navigate = useNavigate({ from: dialogPath });
  const router = useRouter();
  const [open, setOpenState] = useState(true);

  // 保存の mutation が pending の間は、利用者の close を止める。応答の前に閉じると route ごと
  // unmount し、保存に失敗したときに入力が残らない (完了点「サーバー応答」、ADR-0017)。止めるのは
  // このダイアログだけで、開く元のページの操作は止めない (ADR-0017「ブロック範囲」)
  const blocksClose = isPending;

  function leave() {
    void navigate(returnTo);
  }

  function setOpen(nextOpen: boolean) {
    setOpenState(nextOpen);
    if (!nextOpen && !waitForCloseAnimation) {
      leave();
    }
  }

  const onOpenChange: RouteDialog["onOpenChange"] = (nextOpen, details) => {
    // 止めたときは open を変えない。保存の onSuccess は setOpen(false) で閉じ、ここを通らない
    if (!nextOpen && blocksClose) {
      details.cancel();
      return;
    }
    setOpen(nextOpen);
  };

  function onOpenChangeComplete(nextOpen: boolean) {
    if (!nextOpen && waitForCloseAnimation) {
      leave();
    }
  }

  // `router.state` は常に最新の値を持ち (TanStack Router「useRouter hook」)、`buildLocation` は params と search の
  // 関数へ呼んだ時点の値を渡す (TanStack Router「RouterType」の `.buildLocation`)。描画の時点に読んだ値は、
  // unmount の時点の遷移先を映さない
  function isAtReturnTo() {
    const here = router.state.location.pathname;
    const returnPath = router.buildLocation({
      ...returnTo,
      from: returnTo.from ?? dialogPath,
    }).pathname;
    // router の既定は大文字小文字を区別しない (`caseSensitive: false`)。route ごとの `caseSensitive` は読まない
    return router.options.caseSensitive
      ? here === returnPath
      : here.toLowerCase() === returnPath.toLowerCase();
  }

  // Base UI は finalFocus を、閉じたときだけでなく、開いたまま unmount したときにも呼ぶ
  function finalFocus() {
    // 閉じる操作か保存の応答で閉じたら false になっている。開いたまま unmount したときは true のまま
    const closedBeforeUnmount = !open;
    const target = focusAfterRouteDialogClosed({
      closedBeforeUnmount,
      // 閉じたときは戻り先を組まない。判定に使わず、戻り先の search の関数などが throw すると巻き添えになる
      dialogShown: closedBeforeUnmount || !isAtReturnTo(),
      returnTarget: findReturnTarget(),
    });
    if (target === "page-heading") {
      moveFocusToPageHeading();
      return false;
    }
    return target;
  }

  return { open, setOpen, blocksClose, onOpenChange, onOpenChangeComplete, finalFocus };
}
