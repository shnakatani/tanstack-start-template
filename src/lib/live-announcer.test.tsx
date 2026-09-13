import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { LiveRegions } from "@/components/live-regions";

import { announce, LIVE_REGION_IDS } from "./live-announcer";

describe("announce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polite の region にメッセージのノードを足し、7000ms 後に消す", async () => {
    vi.useFakeTimers();
    await render(<LiveRegions />);
    const region = document.getElementById(LIVE_REGION_IDS.polite);
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("role")).toBe("log");
    expect(region?.getAttribute("aria-relevant")).toBe("additions");
    expect(region?.childElementCount).toBe(0);

    announce("『買い物リスト』を削除しています");

    expect(region?.textContent).toBe("『買い物リスト』を削除しています");
    vi.advanceTimersByTime(7000);
    expect(region?.childElementCount).toBe(0);
  });

  it("assertive を指定すると assertive の region に入る", async () => {
    await render(<LiveRegions />);
    announce("保存できません", "assertive");
    expect(document.getElementById(LIVE_REGION_IDS.assertive)?.textContent).toBe("保存できません");
    expect(document.getElementById(LIVE_REGION_IDS.polite)?.textContent).toBe("");
  });

  it("同じ文言を続けて announce しても別ノードとして残る", async () => {
    await render(<LiveRegions />);
    announce("削除しました");
    announce("削除しました");
    expect(document.getElementById(LIVE_REGION_IDS.polite)?.childElementCount).toBe(2);
  });

  it("region が無いときは warn して何もしない", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    announce("届かない");
    expect(warnSpy).toHaveBeenCalledWith("[announce] live region が無い", {
      id: LIVE_REGION_IDS.polite,
      message: "届かない",
    });
    warnSpy.mockRestore();
  });
});
