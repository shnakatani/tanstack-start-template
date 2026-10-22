import { CatchBoundary, type ErrorComponentProps, isNotFound } from "@tanstack/react-router";
import { createContext, type ReactNode, type RefObject, use, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useResetQueryErrorsOnShow } from "@/hooks/use-reset-query-errors-on-show";
import { announce } from "@/lib/live-announcer";

/**
 * 失敗を伝える読み上げの文。区画に出す見出し (`message`) と同じ文字列にしない。テストの `getByText` が
 * live region と見出しの 2 要素に解決する
 */
export function sectionErrorAnnouncement(message: string): string {
  return `${message}「再試行」で取り直せます`;
}

// CatchBoundary は errorComponent を createElement で描くので、その場の関数で文言を渡すと親の描画のたびに
// 別の部品として作り直される。文言と外枠は context で渡す。描画ごとに作る object を値にしないよう、
// 文字列と ref の 2 つに分ける
const SectionErrorMessageContext = createContext<string | null>(null);
const SectionErrorContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
 * ページの中の区画 (条件を変えて読み直す結果、副次的な query を読む部分) の失敗を、その区画だけで受ける境界
 * (ADR-0033)。route の errorComponent へ届かせると、区画の外 (検索欄など) ごとエラー表示に置き換わる。
 * `<Suspense>` は含めない。読み込み中の表示は区画ごとに違うので、使う側が子に並べる。
 * `resetKey` が変わると境界は戻る。再試行は `docs/guides/data-loading.md`「読み込みに失敗した画面から再試行する」。
 * `notFound()` は受けずに外へ投げ直す。route の not found の境界が受けるもので、取得の失敗として出さない
 * (Router の route の境界も同じく投げ直す)。`onCatch` は notFound 以外の失敗を捕まえて読み上げた後に呼ぶ
 */
export function SectionErrorBoundary({
  resetKey,
  message,
  onCatch,
  children,
}: {
  resetKey: string;
  message: string;
  onCatch?: (error: unknown) => void;
  children: ReactNode;
}) {
  // 再試行でボタンが消えると focus が body へ落ちるので、区画の外枠で受ける
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} data-slot="section-error-boundary">
      <SectionErrorMessageContext value={message}>
        <SectionErrorContainerContext value={containerRef}>
          <CatchBoundary
            getResetKey={() => resetKey}
            errorComponent={SectionError}
            // 読み上げは捕まえた時点で 1 回だけ出す。表示の effect に置くと、開発時の二重実行で 2 回読む
            onCatch={(error) => {
              if (!isNotFound(error)) {
                announce(sectionErrorAnnouncement(message));
                onCatch?.(error);
              }
            }}
          >
            {children}
          </CatchBoundary>
        </SectionErrorContainerContext>
      </SectionErrorMessageContext>
    </div>
  );
}

/**
 * 要素へ focus を移す。focus できない要素には `tabindex="-1"` を付けて移し、focus を失ったら外す
 * (GOV.UK Frontend の `setFocus` と同じ形)。付けたままにすると、中身の click で focus が外枠へ移る
 */
function moveFocusTo(element: HTMLElement | null) {
  if (element === null) {
    return;
  }
  if (!element.hasAttribute("tabindex")) {
    element.setAttribute("tabindex", "-1");
    element.addEventListener(
      "blur",
      () => {
        element.removeAttribute("tabindex");
      },
      { once: true },
    );
  }
  element.focus({ preventScroll: true, focusVisible: false });
}

function SectionError({ error, reset }: ErrorComponentProps) {
  const message = use(SectionErrorMessageContext);
  const containerRef = use(SectionErrorContainerContext);
  // 表示した時点で Query の失敗を戻し、再試行の時点でもう一度戻す。route の errorComponent の再試行
  // (`useRouteRetry`) と同じ表示時の reset を共有する
  const resetQueryErrors = useResetQueryErrorsOnShow();

  // hook の呼び出しより後ろで投げる。前に置くと、hook が条件付きで呼ばれる形になる
  if (message === null || containerRef === null) {
    throw new Error("SectionError は SectionErrorBoundary の中でだけ描く");
  }
  if (isNotFound(error)) {
    throw error;
  }

  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{message}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          onClick={() => {
            moveFocusTo(containerRef.current);
            resetQueryErrors();
            reset();
          }}
        >
          再試行
        </Button>
      </EmptyContent>
    </Empty>
  );
}
