import { findLiveRegion, LIVE_REGION_IDS, type Politeness } from "@/lib/live-announcer";

/**
 * `announce()` (ADR-0017) が live region に書き込んだ通知を読む。ノードは 7000ms 残るので、
 * 戻り値はその時点までの通知を追記順に並べた配列になる。1 件 1 要素にするのは、連結した
 * 1 本の文字列だと `toContain` が件をまたいだ部分一致で通るため。
 *
 * region は `src/test/browser-setup.tsx` の `beforeEach` が `<LiveRegions />` を描いて用意する。
 * 本番は `RootDocument` が持つが、部品やページ単体の描画はそこを通らない。
 *
 * region が無いのはテスト基盤の配線漏れなので throw する。空配列を返すと「通知が無い」と
 * 区別できず、`toEqual([])` の検証が region ごと消えても通ってしまう。
 * assertion ではなく値を得るヘルパーなので `expect*` 命名にしない
 * (`.claude/rules/testing.md`「assertion helper と型ナローイング」)。
 */
export function readAnnouncements(politeness: Politeness = "polite"): string[] {
  const region = findLiveRegion(politeness);
  if (region === null) {
    throw new Error(
      `live region (${LIVE_REGION_IDS[politeness]}) が無い: browser-setup.tsx が <LiveRegions /> を描いていない`,
    );
  }
  // `announce()` は 1 件につき div を 1 つ足すので、子要素の単位が通知の単位になる
  return Array.from(region.children, (node) => node.textContent);
}
