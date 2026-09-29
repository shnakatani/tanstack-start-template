import { describe, expect, it } from "vite-plus/test";

import { truncateCodePoints } from "./truncate-code-points";

describe("truncateCodePoints", () => {
  // 上限 cap = 5。cap-1 / cap は保ち、cap+1 は cap で切る
  it("上限を超える分だけ切る", () => {
    expect(truncateCodePoints("abcd", 5)).toBe("abcd");
    expect(truncateCodePoints("abcde", 5)).toBe("abcde");
    expect(truncateCodePoints("abcdef", 5)).toBe("abcde");
  });

  it("サロゲートペアの文字を 1 と数える", () => {
    // 𠮷 と 😀 は UTF-16 で 2 unit だが 1 code point。3 文字は上限 3 に収まる
    expect(truncateCodePoints("𠮷😀a", 3)).toBe("𠮷😀a");
    expect(truncateCodePoints("𠮷😀ab", 3)).toBe("𠮷😀a");
  });

  it("切った結果にサロゲートの片割れを残さない", () => {
    const cut = truncateCodePoints("a😀", 1);
    expect(cut).toBe("a");
    expect(new URLSearchParams({ q: cut }).toString()).toBe("q=a");
  });

  it("ZWJ で結んだ絵文字は code point の単位で途中から切れる", () => {
    // 👨‍👩‍👧 は 5 code point (👨 ZWJ 👩 ZWJ 👧)。見た目の 1 文字を保つ切り方はしない
    expect(truncateCodePoints("👨‍👩‍👧", 2)).toBe("👨‍");
  });

  it("空文字と上限 0 を扱える", () => {
    expect(truncateCodePoints("", 5)).toBe("");
    expect(truncateCodePoints("abc", 0)).toBe("");
  });
});
