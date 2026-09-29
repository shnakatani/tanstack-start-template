import { describe, expect, it } from "vite-plus/test";

import { announce, LIVE_REGION_IDS } from "@/lib/live-announcer";

import {
  expectAnnouncementHistory,
  expectAnnouncements,
  readAnnouncementHistory,
  readAnnouncements,
} from "./live-announcer";

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

describe("expectAnnouncements", () => {
  it("後から届く通知を待って通る", async () => {
    // 操作の完了で通知が届く形をなぞる。呼んだ時点ではまだ region に無い
    setTimeout(() => announce("『買い物リスト』を保存しました"), 100);

    await expectAnnouncements(["『買い物リスト』を保存しました"]);
  });

  it("通知が期待と違えば落ちる", async () => {
    announce("保存しています");

    await expect(expectAnnouncements(["『買い物リスト』を保存しました"])).rejects.toThrow(
      /to deeply equal/,
    );
  });

  it("assertive の通知は politeness を渡して待つ", async () => {
    announce("保存できません", "assertive");

    await expectAnnouncements(["保存できません"], "assertive");
  });
});

describe("readAnnouncementHistory", () => {
  it("テストの始めは空で、前のテストの通知を持ち越さない", () => {
    // 直前の describe のテストが通知している。browser-setup.tsx の beforeEach が履歴を消す
    expect(readAnnouncementHistory()).toEqual([]);
  });

  it("region から消えた通知も、politeness ごとに追記順で返す", () => {
    announce("削除しています");
    announce("保存できません", "assertive");
    announce("『買い物リスト』を削除しました");
    // region の通知は寿命で消える。履歴は消えない
    document.getElementById(LIVE_REGION_IDS.polite)?.replaceChildren();

    expect(readAnnouncements()).toEqual([]);
    expect(readAnnouncementHistory()).toEqual(["削除しています", "『買い物リスト』を削除しました"]);
    expect(readAnnouncementHistory("assertive")).toEqual(["保存できません"]);
  });
});

describe("expectAnnouncementHistory", () => {
  it("後から届く通知を待って通る", async () => {
    setTimeout(() => announce("『買い物リスト』を保存しました"), 100);

    await expectAnnouncementHistory(["『買い物リスト』を保存しました"]);
  });

  it("期待に無い通知が挟まれば落ちる", async () => {
    announce("保存しています");
    announce("『買い物リスト』を保存しました");

    await expect(expectAnnouncementHistory(["『買い物リスト』を保存しました"])).rejects.toThrow(
      /to deeply equal/,
    );
  });
});
