import { describe, expect, it } from "vite-plus/test";

import { parseLayerSpec } from "./contrast";
import { describeLayer, formatReport, parseContrastArgs } from "./contrast-cli";

describe("parseContrastArgs", () => {
  const BASE = ["--theme", "light", "--bg", "--background", "--fg", "--foreground"];

  it("theme と下地と前景を読む", () => {
    const args = parseContrastArgs(BASE);
    expect(args.theme).toBe("light");
    expect(args.backdrop).toEqual([{ token: "--background", alpha: 1, source: "--background" }]);
    expect(args.foreground).toEqual({
      token: "--foreground",
      alpha: 1,
      source: "--foreground",
    });
  });

  it("--bg は複数回を許し、渡した順に並べる", () => {
    const args = parseContrastArgs([
      "--theme",
      "dark",
      "--bg",
      "--popover",
      "--bg",
      "--input/30",
      "--fg",
      "--placeholder",
    ]);
    expect(args.backdrop.map((spec) => spec.token)).toEqual(["--popover", "--input"]);
  });

  it("--theme を 2 回書いたら throw する", () => {
    // 黙って後勝ちにすると、light を測ったつもりで dark の値を ADR へ写す
    expect(() =>
      parseContrastArgs(["--theme", "light", "--theme", "dark", ...BASE.slice(2)]),
    ).toThrow("--theme は 1 つだけ");
  });

  it("--fg を 2 回書いたら throw する", () => {
    expect(() => parseContrastArgs([...BASE, "--fg", "--background"])).toThrow("--fg は 1 つだけ");
  });

  it("余分な位置引数は「知らない引数」で throw する", () => {
    // 位置で数えると偶数位置に落ちたときだけ「値がない」と誤誘導する
    expect(() => parseContrastArgs([...BASE, "extra"])).toThrow("知らない引数");
  });

  it("末尾のフラグに値が無ければ throw する", () => {
    expect(() => parseContrastArgs([...BASE, "--bg"])).toThrow("--bg に値がない");
  });

  it("知らないフラグは throw する", () => {
    expect(() => parseContrastArgs(["--bogus", "x", ...BASE])).toThrow("知らない引数: --bogus");
  });

  it("知らないフラグが末尾に来ても「知らない引数」で throw する", () => {
    // 値欠落の判定を先に置くと、存在しないフラグへ値を足せと誘導する
    expect(() => parseContrastArgs([...BASE, "--bogus"])).toThrow("知らない引数: --bogus");
  });

  it("--theme が light でも dark でもなければ throw する", () => {
    expect(() => parseContrastArgs(["--theme", "purple", ...BASE.slice(2)])).toThrow(
      "light か dark",
    );
  });

  it("必須が欠けていたら throw する", () => {
    expect(() => parseContrastArgs(["--theme", "light", "--bg", "--background"])).toThrow("必須");
  });
});

describe("describeLayer", () => {
  it("受け取った綴りをそのまま返す", () => {
    for (const spec of [
      "--background",
      "--input/30",
      "--input/30.5",
      "--input/100",
      "--input/030",
    ]) {
      expect(describeLayer(parseLayerSpec(spec))).toBe(spec);
    }
  });

  it("逆算では戻せない綴りも往復する", () => {
    // `alpha * 100` の逆算だと `--input/1e-7` になり、`parseLayerSpec` が再パースを拒む
    const spec = "--input/0.0000001";
    const back = describeLayer(parseLayerSpec(spec));
    expect(back).toBe(spec);
    expect(() => parseLayerSpec(back)).not.toThrow();
  });
});

describe("formatReport", () => {
  it("背景と前景で矢印の意味が違うことを添える", () => {
    // `--border` のようにトークン自身が alpha を持つと、綴りに手がかりが残らない
    const report = formatReport(
      parseContrastArgs(["--theme", "light", "--bg", "--background", "--fg", "--foreground"]),
      { backdrop: [1, 1, 1], foreground: [0, 0, 0], ratio: 21 },
    );
    expect(report).toContain("#ffffff (畳んだ後)");
    expect(report).toContain("#000000 (画面に出る色)");
    expect(report).toContain("SC 1.4.3 (4.5:1)  満たす");
  });
});
