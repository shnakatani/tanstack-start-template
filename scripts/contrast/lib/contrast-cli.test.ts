import { describe, expect, it } from "vite-plus/test";

import { formatReport, parseContrastArgs } from "./contrast-cli";

describe("parseContrastArgs", () => {
  const BASE = ["--theme", "light", "--bg", "--background", "--fg", "--foreground"];

  it("theme と下地と前景を読む", () => {
    const args = parseContrastArgs(BASE);
    expect(args.theme).toBe("light");
    expect(args.backdrop).toEqual([
      { spec: { token: "--background", alpha: 1 }, source: "--background" },
    ]);
    expect(args.foreground).toEqual({
      spec: { token: "--foreground", alpha: 1 },
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
    expect(args.backdrop.map((layer) => layer.spec.token)).toEqual(["--popover", "--input"]);
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

  it("末尾のフラグに値が無ければ throw する", () => {
    expect(() => parseContrastArgs([...BASE, "--bg"])).toThrow("--bg に値がない");
  });

  it("知らないフラグは throw する", () => {
    expect(() => parseContrastArgs(["--bogus", "x", ...BASE])).toThrow("知らない引数: --bogus");
  });

  it("末尾の未知トークンは「値がない」ではなく「知らない引数」で throw する", () => {
    // 値欠落の判定を先に置くと、存在しないフラグへ値を足せと誘導する。位置引数と未知フラグ
    // (`--` で始まるか) で経路は分かれない。どちらも同じ allowlist で落ちる
    for (const extra of ["extra", "--bogus"]) {
      expect(() => parseContrastArgs([...BASE, extra])).toThrow("知らない引数");
    }
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

  it("打った綴りをそのまま印字する", () => {
    // `alpha` から逆算すると `--input/030` は `--input/3`、`/0.0000001` は `/1e-7` になる。
    // どちらも打った人が自分の入力として読み直せない
    const report = formatReport(
      parseContrastArgs([
        "--theme",
        "light",
        "--bg",
        "--input/030",
        "--fg",
        "--foreground/0.0000001",
      ]),
      { backdrop: [1, 1, 1], foreground: [0, 0, 0], ratio: 21 },
    );
    expect(report).toContain("背景    --input/030");
    expect(report).toContain("前景    --foreground/0.0000001");
  });
});
