import { LIVE_REGION_IDS, type Politeness } from "@/lib/live-announcer";

/**
 * `announce()` (ADR-0017) が live region に書き込んだ通知を読む。ノードは 7000ms 残るので、
 * 戻り値はその時点までの通知が追記順に連なった文字列になる (`toContain` で 1 件ずつ見る)。
 *
 * region はテスト側が描画に `<LiveRegions />` (`@/components/live-regions`) を足して用意する。
 * 本番は `RootDocument` が持つが、部品やページ単体の描画はそこを通らない。
 *
 * region が無いのはテストの配線漏れ (`<LiveRegions />` の置き忘れ) なので throw する。空文字を
 * 返すと「通知が無い」と区別できず、`toBe("")` の検証が region ごと消えても通ってしまう。
 * assertion ではなく値を得るヘルパーなので `expect*` 命名にしない
 * (`.claude/rules/testing.md`「assertion helper と型ナローイング」)。
 */
export function readAnnouncements(politeness: Politeness = "polite"): string {
  const id = LIVE_REGION_IDS[politeness];
  const region = document.getElementById(id);
  if (region === null) {
    throw new Error(`live region (${id}) が無い: テストの描画に <LiveRegions /> を足す`);
  }
  // HTMLElement の textContent は非 null (null になるのは document / doctype ノード)
  return region.textContent;
}
