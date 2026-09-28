import { describe, expect, it } from "vite-plus/test";

import { announce, LIVE_REGION_IDS } from "@/lib/live-announcer";

import { readAnnouncements } from "./live-announcer";

// region は browser-setup.tsx の beforeEach が描く (`readAnnouncements` の JSDoc)
describe("readAnnouncements", () => {
  it("region はあるが通知が無いときは空配列を返す", () => {
    expect(readAnnouncements()).toEqual([]);
  });

  it("polite の通知を 1 件 1 要素で追記順に返す", () => {
    announce("削除しています");
    announce("『買い物リスト』を削除しました");

    expect(readAnnouncements()).toEqual(["削除しています", "『買い物リスト』を削除しました"]);
  });

  it("件ごとに分かれるので部分一致で他の通知を拾わない", () => {
    // 1 本の文字列で返すと、toContain が部分一致になり通知の一部に一致する
    announce("『買い物リスト』を削除しました");

    expect(readAnnouncements()).not.toContain("『買い物リスト』を削除");
  });

  it("region が無いときは throw する (テスト基盤の配線が外れた場合)", () => {
    // 空配列を返すと「通知が無い」と同じ値になり、region ごと壊れた検証が通ってしまう
    // ノードは残して id だけ外す。remove() すると React 管理下のノードが消え、次のテストの
    // cleanup (root.unmount) が removeChild で落ちる (順序依存になる)
    document.getElementById(LIVE_REGION_IDS.polite)?.removeAttribute("id");

    expect(() => readAnnouncements()).toThrow(`live region (${LIVE_REGION_IDS.polite}) が無い`);
  });

  it("region 不在のテストの後でも次のテストで region が描き直される", () => {
    expect(document.getElementById(LIVE_REGION_IDS.polite)).not.toBeNull();
  });
});
