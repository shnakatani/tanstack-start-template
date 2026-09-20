import { CatchBoundary } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { spyOn } from "storybook/test";

/**
 * `CaughtHere` の fallback が出す接頭辞。story はこの文言で境界到達を検証するので、
 * 描く側と検証する側で同じ定数を使う。
 */
export const CAUGHT_PREFIX = "境界で受けた: ";

/**
 * Error Boundary の中に描く。Action の reject が部品に握られず境界へ届くことを見る用途
 * (ADR-0014「Action 層」の失敗行)。
 */
export function CaughtHere({ children }: { children: ReactNode }) {
  return (
    <CatchBoundary
      getResetKey={() => "story"}
      errorComponent={({ error }) => (
        <p>
          {CAUGHT_PREFIX}
          {error.message}
        </p>
      )}
    >
      {children}
    </CatchBoundary>
  );
}

/**
 * React が境界へ渡す前に出す `console.error` を黙らせる (出力を汚さないため)。
 * story ごとに Storybook が `restoreAllMocks` を走らせるので後始末は要らない。
 */
export function silenceConsoleError(): void {
  spyOn(console, "error").mockImplementation(() => {});
}
