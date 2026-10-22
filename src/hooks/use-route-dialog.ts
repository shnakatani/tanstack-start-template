import {
  useMatch,
  useNavigate,
  useRouter,
  trimPathRight,
  type AnyRouter,
  type RegisteredRouter,
  type ValidateNavigateOptions,
} from "@tanstack/react-router";
import { useEffect, useRef, type ComponentProps } from "react";

import type { Dialog } from "@/components/ui/dialog";
import { moveFocusToPageHeading } from "@/lib/focus-page-heading";

/**
 * - returnTo: 閉じたときに離れる先 (開く元のページ)。`navigate` にそのまま渡すので、search を保つなら
 *   `search: (prev) => prev` を書く。`from` が無ければ、相対の `to` はダイアログの route から解く。
 *   閉じたときの focus を決めるときは、呼ばれた時点の router がここにいるかで、
 *   戻り先へ離れたか別のダイアログに替わったかを分ける
 * - findReturnTarget: 開いた元の要素を探す。URL を直接開いたときは Base UI の既定の戻し先 (開く前に focus して
 *   いた要素) が無いので、要素を探して返す
 * - isPending: 保存の mutation の pending。保存しないダイアログは渡さない
 */
export interface RouteDialogOptions<
  TRouter extends AnyRouter = RegisteredRouter,
  TOptions = unknown,
> {
  returnTo: ValidateNavigateOptions<TRouter, TOptions>;
  findReturnTarget: () => HTMLElement | null;
  isPending?: boolean;
}

/**
 * Dialog の Root には `open` を固定で渡し、`onOpenChange` を渡す。`popupProps` は Popup へ spread し、
 * `blocksClose` はキャンセルの `DialogClose` の `disabled` へ渡す。
 * `close` は保存の応答で閉じるときに呼ぶ。`onOpenChange` を通らないので、close の停止に止められない。
 * ダイアログが unmount したあとに呼んでも何もしない
 */
export interface RouteDialog {
  close: () => void;
  blocksClose: boolean;
  onOpenChange: NonNullable<ComponentProps<typeof Dialog>["onOpenChange"]>;
  /**
   * Popup (`DialogContent`、`ActionDialogContent`) に spread する。
   * - finalFocus: 閉じたときの focus の移し先 (ADR-0041「閉じたときの focus」)
   * - data-route-dialog: 閉じる遷移で Popup に View Transition の名前を付ける印 (ADR-0041「閉じる遷移の見せ方」)。
   *   route の `staticData.routeDialog` が `true` のときだけ付く
   */
  popupProps: { finalFocus: () => HTMLElement | false; "data-route-dialog"?: "" };
}

/**
 * route として開くダイアログの閉じ方と、閉じたあとの focus (ADR-0041)。閉じる操作と `close` の時点で、
 * `returnTo` へ新しい履歴で離れる。開閉の state は持たず、ダイアログは route から離れて unmount するまで開いて
 * いる (TanStack Router の example `location-masking` と同じ形)。呼ぶ route には
 * `staticData: { pageName: <ダイアログの名前>, routeDialog: true }` を書く (ADR-0035、ADR-0041「閉じる遷移の見せ方」)。
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
}: RouteDialogOptions): RouteDialog {
  // 相対の `to` (`..`) を、どの時点で組んでもこのダイアログの route から解く。`from` が無いと、組んだ時点の
  // location から解く (TanStack Router「RouterType」の `.buildLocation`)。戻るで離れたあとの `finalFocus` では
  // 戻った先から解いてしまい、戻り先と食い違う
  const match = useMatch({ strict: false });
  const dialogPath = match.fullPath;
  const navigate = useNavigate({ from: dialogPath });
  const router = useRouter();

  // 印が無いと、Popup に data-route-dialog を付けず、ダイアログは退場を見せずにクロスフェードで消える。見え方が
  // 変わるだけなので throw しない。throw すると同じ route の errorComponent も throw し、ページごと壊れる。
  // data-route-dialog を印に合わせるのは、閉じる遷移の type の関数が数える Popup と、名前を付ける Popup を
  // そろえるため。印の無い Popup にも付けると、片方だけに印があるダイアログの route が入れ子で開いた画面で、
  // 閉じる遷移が 2 つの Popup に同じ名前を付け、遷移が飛ばされる (ADR-0041「閉じる遷移の見せ方」)
  const { routeId } = match;
  const markedAsRouteDialog = match.staticData.routeDialog === true;
  useEffect(() => {
    if (!markedAsRouteDialog) {
      console.warn("[useRouteDialog] route の staticData に routeDialog: true が無い", { routeId });
    }
  }, [markedAsRouteDialog, routeId]);

  // 名前が無いと、`head: pageHead` の title がアプリ名だけになり、遷移の読み上げで開く元のページと区別できない
  // (ADR-0035)。title と読み上げが変わるだけなので、上の印と同じ理由で throw しない
  const named = match.staticData.pageName !== undefined;
  useEffect(() => {
    if (!named) {
      console.warn("[useRouteDialog] route の staticData に pageName が無い", { routeId });
    }
  }, [named, routeId]);

  // 保存の onSuccess は useMutation に渡す callback で、ダイアログが unmount したあとも走る。保存の途中に戻るで
  // 離れ、同じダイアログを開き直していると、先行する応答の close が開き直したダイアログごと離れてしまう。
  // match の id は routeId と path から作るので、開き直したダイアログと同じ id になり、見分けに使えない
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // 保存の mutation が pending の間は、利用者の close を止める。応答の前に閉じると route ごと
  // unmount し、保存に失敗したときに入力が残らない (完了点「サーバー応答」、ADR-0017)。止めるのは
  // このダイアログだけで、開く元のページの操作は止めない (ADR-0017「ブロック範囲」)
  const blocksClose = isPending;

  function close() {
    if (mounted.current) {
      void navigate(returnTo);
    }
  }

  const onOpenChange: RouteDialog["onOpenChange"] = (nextOpen, details) => {
    if (nextOpen) {
      return;
    }
    if (blocksClose) {
      details.cancel();
      return;
    }
    close();
  };

  // `router.state` は常に最新の値を持ち (TanStack Router「useRouter hook」)、`buildLocation` は params と search の
  // 関数へ呼んだ時点の値を渡す (TanStack Router「RouterType」の `.buildLocation`)。描画の時点に読んだ値は、
  // unmount の時点の遷移先を映さない
  function isAtReturnTo() {
    // 戻り先は `buildLocation` が router の `trailingSlash` に合わせて組み、履歴の pathname は開いた URL のまま
    // なので、末尾の `/` を外して比べる
    const here = trimPathRight(router.state.location.pathname);
    const returnPath = trimPathRight(
      router.buildLocation({
        ...returnTo,
        from: returnTo.from ?? dialogPath,
      }).pathname,
    );
    // router の既定は大文字小文字を区別しない (`caseSensitive: false`)。route ごとの `caseSensitive` は読まない
    return router.options.caseSensitive
      ? here === returnPath
      : here.toLowerCase() === returnPath.toLowerCase();
  }

  // Base UI は finalFocus を、開いたまま unmount したときにも呼ぶ。閉じる操作も戻る・進むも、route を離れて
  // unmount したときに呼ばれる
  function finalFocus() {
    // 別のダイアログに替わったときに戻し先を返すと、替わる側のダイアログが次の frame で自分の入力欄へ focus を
    // 移すまでの間だけ、戻し先が focus を受ける (floating-ui/floating-ui#3509 と同じ仕組み)。戻り先でない
    // ページへ離れたときも触れない
    if (!isAtReturnTo()) {
      return false;
    }
    const returnTarget = findReturnTarget();
    if (returnTarget !== null) {
      return returnTarget;
    }
    // 戻し先が無ければ見出しへ移す。route の announcer (ADR-0035) には任せない。読み込み中のダイアログから
    // 離れると、router の確定した location は開く元のページのままなので、announcer はページが変わったと見ない。
    // Base UI に要素を返すと枠を出さない指定を渡せないので、自分で移して false を返す
    moveFocusToPageHeading();
    return false;
  }

  return {
    close,
    blocksClose,
    onOpenChange,
    popupProps: markedAsRouteDialog ? { finalFocus, "data-route-dialog": "" } : { finalFocus },
  };
}
