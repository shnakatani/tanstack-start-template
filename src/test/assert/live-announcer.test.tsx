import { describe, expect, it } from "vite-plus/test";

import { announce, LIVE_REGION_IDS } from "@/lib/live-announcer";

import { expectAnnouncements, readAnnouncements } from "./live-announcer";

// 履歴は browser-setup.tsx の beforeEach が毎テストの前に消す (`readAnnouncements` の JSDoc)
describe("readAnnouncements", () => {
  it("通知が無いときは空配列を返す", () => {
    expect(readAnnouncements()).toEqual([]);
  });

  it("polite の通知を 1 件 1 要素で呼ばれた順に返す", () => {
    announce("削除しています");
    announce("『買い物リスト』を削除しました");

    expect(readAnnouncements()).toEqual(["削除しています", "『買い物リスト』を削除しました"]);
  });

  it("件ごとに分かれるので部分一致で他の通知を拾わない", () => {
    // 1 本の文字列で返すと、toContain が部分一致になり通知の一部に一致する
    announce("『買い物リスト』を削除しました");

    expect(readAnnouncements()).not.toContain("『買い物リスト』を削除");
  });

  it("前のテストの通知を持ち越さない", () => {
    // 直前のテストが通知している。browser-setup.tsx の beforeEach が履歴を消す
    expect(readAnnouncements()).toEqual([]);
  });

  it("region から消えた通知も、politeness ごとに返す", () => {
    announce("削除しています");
    announce("保存できません", "assertive");
    announce("『買い物リスト』を削除しました");
    // region のノードは寿命で消える。履歴は消えない
    document.getElementById(LIVE_REGION_IDS.polite)?.replaceChildren();

    expect(readAnnouncements()).toEqual(["削除しています", "『買い物リスト』を削除しました"]);
    expect(readAnnouncements("assertive")).toEqual(["保存できません"]);
  });
});

describe("expectAnnouncements", () => {
  it("後から届く通知を待って通る", async () => {
    // 操作の完了で通知が届く形をなぞる。呼んだ時点ではまだ履歴に無い
    setTimeout(() => announce("『買い物リスト』を保存しました"), 100);

    await expectAnnouncements(["『買い物リスト』を保存しました"]);
  });

  it("期待に無い通知が挟まれば落ちる", async () => {
    announce("保存しています");
    announce("『買い物リスト』を保存しました");

    await expect(expectAnnouncements(["『買い物リスト』を保存しました"])).rejects.toThrow(
      /to deeply equal/,
    );
  });

  it("assertive の通知は politeness を渡して待つ", async () => {
    announce("保存できません", "assertive");

    await expectAnnouncements(["保存できません"], "assertive");
  });
});
