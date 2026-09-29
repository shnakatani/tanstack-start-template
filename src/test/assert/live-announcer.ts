import { expect, vi } from "vite-plus/test";

import { announce, DEFAULT_POLITENESS, type Politeness } from "@/lib/live-announcer";

/**
 * そのテストで `announce()` (ADR-0026) が呼ばれた通知を、politeness ごとに呼ばれた順で返す。
 * region のノードは 7000ms で消えるが、呼び出しの履歴は消えないので、操作をまたぐ並びと出なかったことを
 * 取り違えずに比べられる (docs/guides/testing/waiting-and-assertions.md「状態と通知を検証する」)。
 * 1 件 1 要素にするのは、連結した 1 本の文字列だと `toContain` が件をまたいだ部分一致で通るため。
 *
 * 履歴は `src/test/browser/browser-setup.tsx` が取る。spy になっていなければテスト基盤の配線漏れなので
 * throw する。空配列を返すと「通知が無い」と区別できず、`toEqual([])` の検証が配線ごと外れても通る。
 * assertion ではなく値を得るヘルパーなので `expect*` 命名にしない
 * (`vitest/expect-expect` は `expect*` の呼び出しを assertion と数える)。
 */
export function readAnnouncements(politeness: Politeness = DEFAULT_POLITENESS): string[] {
  if (!vi.isMockFunction(announce)) {
    throw new Error("announce が spy になっていない: browser-setup.tsx の vi.mock が外れている");
  }
  return vi
    .mocked(announce)
    .mock.calls.filter(([, called = DEFAULT_POLITENESS]) => called === politeness)
    .map(([message]) => message);
}

/**
 * 通知の履歴が `expected` になるまで待つ。通知は操作の完了 (mutation の callback など) で後から届くので、
 * 1 回読んで比べると届く前に落ちる。待つのは `expect.poll` で、assert の予算 (`expect.poll.timeout`) を
 * 読む。`vi.waitFor` は予算を読まず 1000ms で打ち切る (docs/guides/testing/waiting-and-assertions.md「待つ口を選ぶ」)。
 */
export const expectAnnouncements = vi.defineHelper(
  async (expected: string[], politeness: Politeness = DEFAULT_POLITENESS): Promise<void> => {
    await expect.poll(() => readAnnouncements(politeness)).toEqual(expected);
  },
);
