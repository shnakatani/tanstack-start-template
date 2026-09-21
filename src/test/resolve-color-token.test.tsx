import { describe, expect, it } from "vite-plus/test";

import { resolveColorToken } from "./resolve-color-token";

/**
 * 実 CSS が要るので browser project に置く (`.test.tsx`)。
 * 値そのものは `styles.css` が動けば変わるため固定しない。固定するのは「字面でなく算出値が
 * 返る」「probe を残さない」「scope でテーマが切り替わる」の 3 点。
 */
describe("resolveColorToken", () => {
  it("宣言の字面ではなくブラウザの算出値を返す", () => {
    const resolved = resolveColorToken("--destructive");

    // `styles.css` は palette の段を百分率で写す。算出値はその字面と一致しない
    expect(resolved).toMatch(/^(rgb|oklch|color)\(/);
    expect(resolved).not.toBe(
      getComputedStyle(document.documentElement).getPropertyValue("--destructive").trim(),
    );
  });

  it("解決に使った probe を残さない", () => {
    const before = document.body.childElementCount;

    resolveColorToken("--destructive");

    expect(document.body.childElementCount).toBe(before);
  });

  it("scope の祖先にある .dark を見て値を切り替える", () => {
    const dark = document.createElement("div");
    dark.className = "dark";
    document.body.append(dark);

    try {
      expect(resolveColorToken("--destructive", dark)).not.toBe(resolveColorToken("--destructive"));
    } finally {
      dark.remove();
    }
  });
});
