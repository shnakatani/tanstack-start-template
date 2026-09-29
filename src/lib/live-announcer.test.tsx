import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  announce,
  DEFAULT_POLITENESS,
  findLiveRegion,
  LIVE_REGION_IDS,
  type Politeness,
} from "./live-announcer";

/**
 * region に残っている通知を読む。ほかのテストは announce の呼び出しの履歴を読むが
 * (`src/test/assert/live-announcer.ts`)、このファイルは region へ書くこと自体を確かめる。
 * region は browser-setup.tsx の beforeEach が描く。無いのは配線漏れなので throw する
 */
function readRegion(politeness: Politeness = DEFAULT_POLITENESS): string[] {
  const region = findLiveRegion(politeness);
  if (region === null) {
    throw new Error(`live region (${LIVE_REGION_IDS[politeness]}) が無い`);
  }
  // `announce()` は 1 件につき div を 1 つ足すので、子要素の単位が通知の単位になる
  return Array.from(region.children, (node) => node.textContent);
}

describe("announce", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polite の region にメッセージのノードを足し、7000ms 後に消す", () => {
    vi.useFakeTimers();
    const region = document.getElementById(LIVE_REGION_IDS.polite);
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("role")).toBe("log");
    expect(region?.getAttribute("aria-relevant")).toBe("additions");
    expect(readRegion()).toEqual([]);

    announce("『買い物リスト』を削除しました");

    expect(readRegion()).toEqual(["『買い物リスト』を削除しました"]);

    // 削除は 7000ms ちょうど (React Aria の LiveAnnouncer と同値)。6999 でまだ在ることを
    // 見ないと、寿命を短くする変更 (3000 等) がこのテストを通り抜ける
    vi.advanceTimersByTime(6999);
    expect(region?.childElementCount).toBe(1);
    vi.advanceTimersByTime(1);
    expect(region?.childElementCount).toBe(0);
  });

  it("assertive を指定すると assertive の region に入る", () => {
    announce("保存できません", "assertive");

    expect(readRegion("assertive")).toEqual(["保存できません"]);
    expect(readRegion()).toEqual([]);
  });

  it("同じ文言を続けて announce しても別ノードとして残る", () => {
    announce("削除しています");
    announce("削除しています");

    expect(readRegion()).toEqual(["削除しています", "削除しています"]);
  });

  it("region が無いときは warn して何もしない", () => {
    // client で region が見つからない異常 (配線が外れた状態) を作る。ノードは残して id だけ外す。
    // remove() すると React 管理下のノードが消え、次のテストの cleanup (root.unmount) が removeChild で落ちる
    document.getElementById(LIVE_REGION_IDS.polite)?.removeAttribute("id");

    announce("届かない");

    expect(warnSpy).toHaveBeenCalledWith("[announce] live region が無い", {
      id: LIVE_REGION_IDS.polite,
      message: "届かない",
    });
  });

  it("region 不在のテストの後でも次のテストで region が描き直される", () => {
    expect(document.getElementById(LIVE_REGION_IDS.polite)).not.toBeNull();
  });
});
