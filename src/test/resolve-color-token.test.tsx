import { describe, expect, it } from "vite-plus/test";

import { resolveColorToken } from "./resolve-color-token";

/** 本テストが所有するトークン。`styles.css` の値を pin すると、トークンを動かしたときに
 *  helper の不具合として落ちる */
const PROBE_TOKEN = "--resolve-color-token-probe";
const PROBE_LITERAL = "oklch(50% 0.1 200)";

function withProbeScope(run: (scope: HTMLElement) => void): void {
  const scope = document.createElement("div");
  scope.style.setProperty(PROBE_TOKEN, PROBE_LITERAL);
  document.body.append(scope);
  try {
    run(scope);
  } finally {
    scope.remove();
  }
}

/**
 * 実 CSS が要るので browser project に置く (`.test.tsx`)。
 * 固定するのは「字面でなく算出値が返る」「未定義を通さない」「probe を残さない」
 * 「scope でテーマが切り替わる」の 4 点。
 */
describe("resolveColorToken", () => {
  it("宣言の字面ではなくブラウザの算出値を返す", () => {
    withProbeScope((scope) => {
      const resolved = resolveColorToken(PROBE_TOKEN, scope);

      expect(resolved).toMatch(/^(rgb|oklch|color)\(/);
      // 百分率の字面は算出時に正規化される。字面のまま返っていたら比較が無意味になる
      expect(resolved).not.toBe(PROBE_LITERAL);
    });
  });

  it("未定義のトークンを継承色で埋めずに投げる", () => {
    expect(() => resolveColorToken("--resolve-color-token-absent")).toThrow(
      /--resolve-color-token-absent/,
    );
  });

  // 定義はあるが色でない値も、色と同じく継承色へ落ちる。空判定だけでは通り抜ける
  it("色でない値を持つトークンも投げる", () => {
    expect(() => resolveColorToken("--radius")).toThrow(/--radius/);
  });

  it("解決に使った probe を残さない", () => {
    const before = document.body.childElementCount;

    resolveColorToken("--destructive");
    expect(() => resolveColorToken("--resolve-color-token-absent")).toThrow(
      /--resolve-color-token-absent/,
    );

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
