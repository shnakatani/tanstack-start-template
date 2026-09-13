import { describe, expect, it } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { LiveRegions } from "@/components/live-regions";
import { announce, LIVE_REGION_IDS } from "@/lib/live-announcer";

import { readAnnouncements } from "./live-announcer";

describe("readAnnouncements", () => {
  it("region はあるが通知が無いときは空文字を返す", async () => {
    await render(<LiveRegions />);

    expect(readAnnouncements()).toBe("");
  });

  it("polite の通知を追記順に連ねて返す", async () => {
    await render(<LiveRegions />);

    announce("『買い物リスト』を削除しています");
    announce("削除しました");

    expect(readAnnouncements()).toBe("『買い物リスト』を削除しています削除しました");
  });

  it("politeness を渡すとその region を読む", async () => {
    await render(<LiveRegions />);

    announce("保存できません", "assertive");

    expect(readAnnouncements("assertive")).toBe("保存できません");
    expect(readAnnouncements()).toBe("");
  });

  it("region が無いときは throw する (描画に LiveRegions を置き忘れた場合)", () => {
    // 空文字を返すと「通知が無い」と同じ値になり、region ごと壊れた検証が通ってしまう
    expect(() => readAnnouncements()).toThrow(`live region (${LIVE_REGION_IDS.polite}) が無い`);
  });
});
