import { expect, vi } from "vite-plus/test";
import type { Locator } from "vite-plus/test/browser/context";

import { columnWidthDrifts, type ColumnWidthFrame } from "./column-width-drift";

/** 列見出しの幅が「動いた」と見なす下限。これ未満は sub-pixel の丸めとして扱う */
const COLUMN_WIDTH_TOLERANCE_PX = 0.5;

interface ColumnWidthRecording {
  /** 今の DOM の状態が 1 frame 記録されるのを待つ。pending の状態を肯定で待ったあと、決着させる前に呼ぶ */
  frame: () => Promise<void>;
}

/**
 * `whileRunning` の間、列見出し (`columnheader`) の幅を `requestAnimationFrame` ごとに記録して返す。
 * 操作の途中で一瞬だけ列が動く回帰 (操作中の表示で中身の幅が変わる) を、操作の前後の 2 点では
 * 捕まえられないので frame ごとに測る。
 *
 * - 要素は呼んだ時点で `elements()` により 1 回だけ解決し、以降はその DOM の参照を測る。毎 frame locator を
 *   解決しないのは、ダイアログが開くと一覧が `aria-hidden` の下に入り、`getByRole("columnheader")` が
 *   要素を返さなくなるため
 * - 呼ぶ前に `expect.element` で列見出しの mount を待つ。解決した要素が 0 件なら誤用として throw する
 * - 矩形の読みを `expect.poll` の外で行う例外。判定は記録を閉じたあとに `expectStableColumnWidths` が 1 回だけ行う
 *   (`docs/guides/testing/waiting-and-assertions.md`「レイアウトを実測で確かめる」)
 * - 記録の中では、pending の状態を肯定で待ち (`getBySlot("spinner")` が在る、「更新中」が在る)、`frame()` で
 *   その状態が 1 frame 記録されるのを待ってから決着させる。待たずに決着させると、locator の poll が最初の 1 回で
 *   通ったとき、操作中の状態が frame に 1 つも入らずに通ることがある。決着後の状態も `frame()` で記録に入れる
 */
export async function recordColumnWidths(
  headers: Locator,
  whileRunning: (recording: ColumnWidthRecording) => Promise<void>,
): Promise<readonly ColumnWidthFrame[]> {
  const elements = headers.elements();
  if (elements.length === 0) {
    throw new Error(
      "[recordColumnWidths] 列見出しが見つからない。先に expect.element で mount を待ってから呼ぶ",
    );
  }
  const frames: ColumnWidthFrame[] = [];
  let waiters: Array<() => void> = [];
  let handle: number;
  const measure = () => {
    frames.push(elements.map((element) => element.getBoundingClientRect().width));
    const settled = waiters;
    waiters = [];
    for (const resolve of settled) resolve();
    handle = requestAnimationFrame(measure);
  };
  handle = requestAnimationFrame(measure);
  try {
    await whileRunning({
      frame: () =>
        new Promise<void>((resolve) => {
          waiters.push(resolve);
        }),
    });
  } finally {
    cancelAnimationFrame(handle);
  }
  return frames;
}

/**
 * 記録の間、どの列見出しの幅も `COLUMN_WIDTH_TOLERANCE_PX` 以上動かなかったこと。
 * 失敗文には動いた列と px と frame が残る (`columnWidthDrifts`)。
 */
export const expectStableColumnWidths = vi.defineHelper(
  (frames: readonly ColumnWidthFrame[]): void => {
    expect(columnWidthDrifts(frames, COLUMN_WIDTH_TOLERANCE_PX)).toEqual([]);
  },
);
