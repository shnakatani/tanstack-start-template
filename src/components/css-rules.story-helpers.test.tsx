import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { collectRootCustomProperties } from "./css-rules.story-helpers";

function sheet(css: string): CSSStyleSheet {
  const created = new CSSStyleSheet();
  created.replaceSync(css);
  return created;
}

const root = document.documentElement;

describe("collectRootCustomProperties", () => {
  afterEach(() => vi.restoreAllMocks());

  it(":root の宣言を prefix で絞って名前順に返す", () => {
    const css = ":root { --b: 2; --a: 1; --other: 3; }";

    expect(collectRootCustomProperties([sheet(css)], "--a", root)).toEqual(["--a"]);
    expect(collectRootCustomProperties([sheet(css)], "--", root)).toEqual([
      "--a",
      "--b",
      "--other",
    ]);
  });

  // Tailwind は @theme の中身を @layer theme へ出す。辿らないと 1 件も取れない
  it("@layer の中の宣言も拾う", () => {
    const css = "@layer theme { :root, :host { --inside: 1; } }";

    expect(collectRootCustomProperties([sheet(css)], "--", root)).toEqual(["--inside"]);
  });

  it("入れ子のグループ規則も辿る", () => {
    const css = "@layer a { @media screen { :root { --deep: 1; } } }";

    expect(collectRootCustomProperties([sheet(css)], "--", root)).toEqual(["--deep"]);
  });

  // selectorText を "," で分けて ":root" と比べる形だと取りこぼす
  it(", を内側に持つ selector も取りこぼさない", () => {
    const css = ":is(:root, .theme-x) { --inside-is: 1; }";

    expect(collectRootCustomProperties([sheet(css)], "--", root)).toEqual(["--inside-is"]);
  });

  it("root に当たらない rule は拾わない", () => {
    const css = ".card { --not-root: 1; }";

    expect(collectRootCustomProperties([sheet(css)], "--", root)).toEqual([]);
  });

  it("複数の stylesheet をまたいで重複を潰す", () => {
    const sheets = [sheet(":root { --dup: 1; }"), sheet(":root { --dup: 2; --extra: 3; }")];

    expect(collectRootCustomProperties(sheets, "--", root)).toEqual(["--dup", "--extra"]);
  });

  it("cssRules を読めない stylesheet は warn して飛ばす", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const blocked = {
      href: "https://example.test/x.css",
      get cssRules(): CSSRuleList {
        throw new Error("SecurityError");
      },
    };

    expect(collectRootCustomProperties([blocked, sheet(":root { --ok: 1; }")], "--", root)).toEqual(
      ["--ok"],
    );
    expect(warn).toHaveBeenCalledWith("[css-rules] cssRules を読めない stylesheet", {
      href: "https://example.test/x.css",
    });
  });
});

describe("root 固有でない rule", () => {
  // Tailwind の preflight は root にも当たり、内部用の変数を持ち込む
  it("任意の要素にも当たる rule は拾わない", () => {
    const css = "*, ::before, ::after { --tw-internal: 1; } :root { --token: 2; }";

    expect(collectRootCustomProperties([sheet(css)], "--", root)).toEqual(["--token"]);
  });

  it("html セレクタは root 固有として拾う", () => {
    expect(collectRootCustomProperties([sheet("html { --on-html: 1; }")], "--", root)).toEqual([
      "--on-html",
    ]);
  });
});

describe("解釈できない selector", () => {
  // CSSOM に入りうる selector をすべて matches() が解釈できるとは限らない。
  // 走査ごと止めずに、その rule だけ飛ばして残りを返す
  it("matches() が投げる rule は warn して飛ばす", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwingRoot = {
      matches: () => {
        throw new Error("SyntaxError");
      },
      ownerDocument: document,
    };

    expect(collectRootCustomProperties([sheet(":root { --x: 1; }")], "--", throwingRoot)).toEqual(
      [],
    );
    expect(warn).toHaveBeenCalledWith("[css-rules] 解釈できない selector", {
      selectorText: ":root",
    });
  });
});
