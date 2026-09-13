import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { readAnnouncements } from "@/test/live-announcer";

import { announce, LIVE_REGION_IDS } from "./live-announcer";

// region は browser-setup.tsx の beforeEach が描く (`readAnnouncements` の JSDoc)
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
    expect(readAnnouncements()).toEqual([]);

    announce("『買い物リスト』を削除しています");

    expect(readAnnouncements()).toEqual(["『買い物リスト』を削除しています"]);

    // 削除は 7000ms ちょうど (React Aria の LiveAnnouncer と同値)。6999 でまだ在ることを
    // 見ないと、寿命を短くする変更 (3000 等) がこのテストを通り抜ける
    vi.advanceTimersByTime(6999);
    expect(region?.childElementCount).toBe(1);
    vi.advanceTimersByTime(1);
    expect(region?.childElementCount).toBe(0);
  });

  it("assertive を指定すると assertive の region に入る", () => {
    announce("保存できません", "assertive");

    expect(readAnnouncements("assertive")).toEqual(["保存できません"]);
    expect(readAnnouncements()).toEqual([]);
  });

  it("同じ文言を続けて announce しても別ノードとして残る", () => {
    announce("削除しました");
    announce("削除しました");

    expect(readAnnouncements()).toEqual(["削除しました", "削除しました"]);
  });

  it("region が無いときは warn して何もしない", () => {
    // client で region が見つからない異常 (配線が外れた状態) を作る
    // ノードは残して id だけ外す。remove() すると React 管理下のノードが消え、次のテストの
    // cleanup (root.unmount) が removeChild で落ちる (順序依存になる)
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
