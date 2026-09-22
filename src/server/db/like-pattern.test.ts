import { describe, expect, it } from "vite-plus/test";

import { escapeLikePattern, LIKE_ESCAPE_CHAR } from "./like-pattern";

describe("escapeLikePattern", () => {
  it("LIKE のワイルドカード % と _ をエスケープする", () => {
    expect(escapeLikePattern("100%_off")).toBe("100\\%\\_off");
  });

  it("エスケープ文字自身もエスケープする", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("特殊文字が無ければそのまま返す", () => {
    expect(escapeLikePattern("メモ abc")).toBe("メモ abc");
  });

  it("空文字は空文字", () => {
    expect(escapeLikePattern("")).toBe("");
  });

  it("ESCAPE 句に渡す文字は 1 文字のバックスラッシュ", () => {
    expect(LIKE_ESCAPE_CHAR).toBe("\\");
  });
});
