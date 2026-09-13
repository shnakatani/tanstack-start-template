import { describe, expect, it } from "vite-plus/test";

import { announce, LIVE_REGION_IDS } from "@/lib/live-announcer";

import { readAnnouncements } from "./live-announcer";

// region は browser-setup.tsx の beforeEach が描く (`readAnnouncements` の JSDoc)
describe("readAnnouncements", () => {
  it("region はあるが通知が無いときは空配列を返す", () => {
    expect(readAnnouncements()).toEqual([]);
  });

  it("polite の通知を 1 件 1 要素で追記順に返す", () => {
    announce("『買い物リスト』を削除しています");
    announce("削除しました");

    expect(readAnnouncements()).toEqual(["『買い物リスト』を削除しています", "削除しました"]);
  });

  it("件ごとに分かれるので部分一致で他の通知を拾わない", () => {
    // 連結した 1 本の文字列だと「削除しました」が「削除しています」の途中に一致しうる
    announce("『買い物リスト』を削除しています");

    expect(readAnnouncements()).not.toContain("『買い物リスト』を削除");
  });

  it("politeness を渡すとその region を読む", () => {
    announce("保存できません", "assertive");

    expect(readAnnouncements("assertive")).toEqual(["保存できません"]);
    expect(readAnnouncements()).toEqual([]);
  });

  it("region が無いときは throw する (テスト基盤の配線が外れた場合)", () => {
    // 空配列を返すと「通知が無い」と同じ値になり、region ごと壊れた検証が通ってしまう
    document.getElementById(LIVE_REGION_IDS.polite)?.remove();

    expect(() => readAnnouncements()).toThrow(`live region (${LIVE_REGION_IDS.polite}) が無い`);
  });
});
