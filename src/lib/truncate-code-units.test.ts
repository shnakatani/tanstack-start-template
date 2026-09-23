import { describe, expect, it } from "vite-plus/test";

import { truncateCodeUnits } from "./truncate-code-units";

describe("truncateCodeUnits", () => {
  // 上限 cap = 5。cap-1 / cap は保ち、cap+1 は cap で切る
  it("上限を超える分だけ切る", () => {
    expect(truncateCodeUnits("abcd", 5)).toBe("abcd");
    expect(truncateCodeUnits("abcde", 5)).toBe("abcde");
    expect(truncateCodeUnits("abcdef", 5)).toBe("abcde");
  });

  it("数えるのは code unit で、絵文字は 2 つ分", () => {
    // "😀" は 😀 の 2 unit。"a😀" は 3 unit
    expect("a😀".length).toBe(3);
    expect(truncateCodeUnits("a😀", 3)).toBe("a😀");
  });

  it("切った位置がサロゲートペアの途中なら、割れた前半を落とす", () => {
    // "a😀" を 2 unit で切ると "a\uD83D" になり、前半を落として "a"
    const cut = truncateCodeUnits("a😀", 2);
    expect(cut).toBe("a");
    expect(new URLSearchParams({ q: cut }).toString()).toBe("q=a");
  });

  it("完全なペアで終わる位置ならそのまま保つ", () => {
    expect(truncateCodeUnits("a😀b", 3)).toBe("a😀");
  });

  it("空文字と上限 0 を扱える", () => {
    expect(truncateCodeUnits("", 5)).toBe("");
    expect(truncateCodeUnits("abc", 0)).toBe("");
  });
});
