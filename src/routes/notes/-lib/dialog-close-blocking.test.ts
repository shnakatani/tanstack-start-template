import { describe, expect, it } from "vite-plus/test";

import { blocksUserClose } from "./dialog-close-blocking";

describe("blocksUserClose", () => {
  it.each(["escape-key", "outside-press", "close-press"] as const)(
    "保存の pending の間に利用者が閉じる (%s) と止める",
    (reason) => {
      expect(blocksUserClose(false, { reason }, true)).toBe(true);
    },
  );

  it("保存の pending の間でも、handle で閉じる (imperative-action) のは通す", () => {
    expect(blocksUserClose(false, { reason: "imperative-action" }, true)).toBe(false);
  });

  it("保存の pending でなければ、利用者が閉じても止めない", () => {
    expect(blocksUserClose(false, { reason: "escape-key" }, false)).toBe(false);
  });

  it("開く操作は保存の pending の間でも止めない", () => {
    expect(blocksUserClose(true, { reason: "trigger-press" }, true)).toBe(false);
  });
});
