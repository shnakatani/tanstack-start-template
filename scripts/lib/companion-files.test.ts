import { describe, expect, it } from "vite-plus/test";

import {
  COMPANION_KINDS,
  companionFilePattern,
  companionGlobs,
  isCompanionFile,
  storyGlobs,
} from "./companion-files";

describe("COMPANION_KINDS", () => {
  it("directory-structure.md が定める 4 種別を持つ", () => {
    expect([...COMPANION_KINDS]).toEqual(["test", "test-helpers", "story-helpers", "stories"]);
  });
});

describe("companionGlobs", () => {
  it("種別ごとに ts と tsx の 2 本を、宣言順で並べる", () => {
    expect(companionGlobs("**/")).toEqual([
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test-helpers.ts",
      "**/*.test-helpers.tsx",
      "**/*.story-helpers.ts",
      "**/*.story-helpers.tsx",
      "**/*.stories.ts",
      "**/*.stories.tsx",
    ]);
  });

  it("prefix を差し替えられる (coverage は src 配下だけを見る)", () => {
    expect(companionGlobs("src/**/")).toContain("src/**/*.story-helpers.ts");
    expect(companionGlobs("src/**/")).toHaveLength(COMPANION_KINDS.length * 2);
  });
});

// 期待値は手書きにする。companionGlobs から導くと入力どうしの比較になり、種別を増減しても
// 常に通る (COMPANION_KINDS の doc)。STORY_KINDS が COMPANION_KINDS の部分集合であることは
// satisfies が型で見るので、ここでは実際に返る glob だけを固定する
describe("storyGlobs", () => {
  it("story 本体と story 専用 helper の ts / tsx に当たる", () => {
    expect(storyGlobs("**/")).toEqual([
      "**/*.stories.ts",
      "**/*.stories.tsx",
      "**/*.story-helpers.ts",
      "**/*.story-helpers.tsx",
    ]);
  });

  it("prefix をそのまま前に置く", () => {
    expect(storyGlobs("src/**/")).toEqual([
      "src/**/*.stories.ts",
      "src/**/*.stories.tsx",
      "src/**/*.story-helpers.ts",
      "src/**/*.story-helpers.tsx",
    ]);
  });
});

describe("companionFilePattern", () => {
  it("4 種別 × ts / tsx に当たり、アプリのコードには当たらない", () => {
    const pattern = new RegExp(companionFilePattern());

    for (const kind of COMPANION_KINDS) {
      expect(pattern.test(`button.${kind}.ts`), `button.${kind}.ts`).toBe(true);
      expect(pattern.test(`button.${kind}.tsx`), `button.${kind}.tsx`).toBe(true);
    }
    expect(pattern.test("button.tsx")).toBe(false);
    expect(pattern.test("handlers.server.ts")).toBe(false);
    expect(pattern.test("routeTree.gen.ts")).toBe(false);
  });
});

describe("isCompanionFile", () => {
  it("4 種別 × ts / tsx を付随ファイルと判定する", () => {
    for (const kind of COMPANION_KINDS) {
      expect(isCompanionFile(`button.${kind}.ts`), `button.${kind}.ts`).toBe(true);
      expect(isCompanionFile(`button.${kind}.tsx`), `button.${kind}.tsx`).toBe(true);
    }
  });

  it("アプリのコードは判定しない", () => {
    // basename に `.` を持つアプリのコード。字面が似ているので取り違えると本体が検査から漏れる
    expect(isCompanionFile("button.tsx")).toBe(false);
    expect(isCompanionFile("handlers.server.ts")).toBe(false);
    expect(isCompanionFile("routeTree.gen.ts")).toBe(false);
    expect(isCompanionFile("env.d.ts")).toBe(false);
  });

  it("拡張子の前に種別名が無いファイルは対象外", () => {
    expect(isCompanionFile("test.ts")).toBe(false);
    expect(isCompanionFile("stories.tsx")).toBe(false);
  });

  it("種別名の部分一致では判定しない", () => {
    expect(isCompanionFile("button.tests.ts")).toBe(false);
    expect(isCompanionFile("button.story.ts")).toBe(false);
  });

  it("ts / tsx 以外の拡張子は対象外", () => {
    expect(isCompanionFile("button.test.js")).toBe(false);
    expect(isCompanionFile("button.stories.mdx")).toBe(false);
  });
});
