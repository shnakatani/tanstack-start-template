import { CatchBoundary } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

/** `renderInCatchBoundary` の fallback が出す文言。テストはこの接頭辞で境界到達を検証する。 */
export const CAUGHT_PREFIX = "境界で受けた: ";

/**
 * Error Boundary (`CatchBoundary`) の中に描画する。Action の reject が部品に握られず
 * 境界へ届くことを検証する用途 (ADR-0014「Action 層」の失敗行)。
 * React は境界へ渡す前に `console.error` を出すので、出力を汚さないよう黙らせる
 * (テスト側の `afterEach(() => vi.restoreAllMocks())` で戻す)。
 */
export function renderInCatchBoundary(node: ReactNode) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  return render(
    <CatchBoundary
      getResetKey={() => "test"}
      errorComponent={({ error }) => (
        <p>
          {CAUGHT_PREFIX}
          {error.message}
        </p>
      )}
    >
      {node}
    </CatchBoundary>,
  );
}
