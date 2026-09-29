import * as v from "valibot";
import { describe, expect, it } from "vite-plus/test";

import { truncateCodePoints } from "./truncate-code-points";

describe("truncateCodePoints", () => {
  // 上限 cap = 5。cap-1 / cap は保ち、cap+1 は cap で切る
  it("上限を超える分だけ切る", () => {
    expect(truncateCodePoints("abcd", 5)).toBe("abcd");
    expect(truncateCodePoints("abcde", 5)).toBe("abcde");
    expect(truncateCodePoints("abcdef", 5)).toBe("abcde");
  });

  // 𠮷 は 2 code unit・1 code point。上限 cap = 3 で、cap - 1 / cap 文字は保ち、cap + 1 文字は cap 文字にする
  it("サロゲートペアの文字を 1 と数える", () => {
    expect(truncateCodePoints("𠮷𠮷", 3)).toBe("𠮷𠮷");
    expect(truncateCodePoints("𠮷𠮷𠮷", 3)).toBe("𠮷𠮷𠮷");
    expect(truncateCodePoints("𠮷𠮷𠮷𠮷", 3)).toBe("𠮷𠮷𠮷");
  });

  // スキーマは切った値を valibot の maxCodePoints で検証し直さない (v.fallback の値は検証されない)。
  // 切った結果が同じ上限の判定を必ず通ることを、ここで保証する
  it.each([
    ["abcdef", 3],
    ["𠮷😀ab", 3],
    ["👨‍👩‍👧x", 2],
    ["a\uD83Db", 2],
    ["\uDE00\uD83Dxy", 3],
  ])("切った %j は maxCodePoints(%i) を通る", (text, cap) => {
    expect(v.is(v.pipe(v.string(), v.maxCodePoints(cap)), truncateCodePoints(text, cap))).toBe(
      true,
    );
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
