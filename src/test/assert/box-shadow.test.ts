import { describe, expect, it } from "vite-plus/test";

import { maxShadowSpread } from "./box-shadow";

describe("maxShadowSpread", () => {
  it("none は 0 を返す", () => {
    expect(maxShadowSpread("none")).toBe(0);
  });

  it("spread を持つ単一 shadow から spread を取り出す", () => {
    // ring-3 の computed 値の形: color offset-x offset-y blur spread
    expect(maxShadowSpread("rgba(59, 130, 246, 0.5) 0px 0px 0px 3px")).toBe(3);
  });

  it("inset つきの shadow でも spread を取り出す", () => {
    // computed 値では inset は末尾に直列化される (2026-08-09 に Chromium で実測)
    expect(maxShadowSpread("rgba(59, 130, 246, 0.5) 0px 0px 0px 3px inset")).toBe(3);
  });

  it("色関数内のカンマに惑わされず複数 shadow の最大 spread を返す", () => {
    expect(
      maxShadowSpread(
        "rgba(0, 0, 0, 0.05) 0px 1px 2px 0px, rgba(59, 130, 246, 0.5) 0px 0px 0px 3px",
      ),
    ).toBe(3);
  });

  it("spread を省略した shadow (長さ 3 個以下) は 0 として扱う", () => {
    expect(maxShadowSpread("rgba(0, 0, 0, 0.05) 0px 1px 2px")).toBe(0);
  });

  it("負の spread は 0 に丸める", () => {
    expect(maxShadowSpread("rgba(0, 0, 0, 0.5) 0px 2px 4px -2px")).toBe(0);
  });
});
