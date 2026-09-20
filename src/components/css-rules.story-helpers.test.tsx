import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { collectRootCustomProperties } from "./css-rules.story-helpers";

function sheet(css: string): CSSStyleSheet {
  const created = new CSSStyleSheet();
  created.replaceSync(css);
  return created;
}

const root = document.documentElement;

// spy はファイル内の全 describe で張る。describe の中に置くと、その describe の
// テストにしか効かず、兄弟の describe が張った spy が後続へ残る
afterEach(() => vi.restoreAllMocks());

describe("collectRootCustomProperties", () => {
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

  // @import が参照する stylesheet は CSSGroupingRule ではないので、別に辿らないと落ちる
  it("@import が指す stylesheet の宣言も拾う", () => {
    const imported = sheet(":root { --imported: 1; }");
    const importing = {
      href: null,
      cssRules: [
        // CSSImportRule の href / styleSheet は getter のみなので defineProperty で作る
        Object.create(CSSImportRule.prototype, {
          href: { value: "imported.css" },
          styleSheet: { value: imported },
        }),
      ],
    };

    expect(collectRootCustomProperties([importing], "--", root)).toEqual(["--imported"]);
  });

  // 深い位置の失敗で、その stylesheet の残りの rule が落ちてはいけない
  it("読めない @import があっても同じ stylesheet の他の宣言は残る", () => {
    const unreadable = Object.create(CSSImportRule.prototype, {
      href: { value: "cross-origin.css" },
      styleSheet: {
        get(): CSSStyleSheet {
          throw new Error("SecurityError");
        },
      },
    });
    const importing = {
      href: null,
      cssRules: [unreadable, ...sheet(":root { --kept: 1; }").cssRules],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(collectRootCustomProperties([importing], "--", root)).toEqual(["--kept"]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("styleSheet が null の @import は warn して飛ばす", () => {
    const pending = Object.create(CSSImportRule.prototype, {
      href: { value: "not-loaded.css" },
      styleSheet: { value: null },
      supportsText: { value: null },
    });
    const importing = {
      href: null,
      cssRules: [pending, ...sheet(":root { --kept: 1; }").cssRules],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(collectRootCustomProperties([importing], "--", root)).toEqual(["--kept"]);
    expect(warn).toHaveBeenCalledOnce();
  });

  // supports() の条件が成立しないときは取得自体が起きず、null が正常な結果になる
  // (w3c/csswg-drafts#8608)。ここで warn すると、正常な設定が警告を出し続ける
  it("supports() が成立しない @import は warn しない", () => {
    const skipped = Object.create(CSSImportRule.prototype, {
      href: { value: "grid-only.css" },
      styleSheet: { value: null },
      supportsText: { value: "(display: definitely-not-a-value)" },
    });
    const importing = {
      href: null,
      cssRules: [skipped, ...sheet(":root { --kept: 1; }").cssRules],
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(collectRootCustomProperties([importing], "--", root)).toEqual(["--kept"]);
    expect(warn).not.toHaveBeenCalled();
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
      error: expect.any(Error),
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
