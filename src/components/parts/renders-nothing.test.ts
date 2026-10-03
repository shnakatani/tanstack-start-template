import { createElement } from "react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";

import { rendersNothing } from "./renders-nothing";

describe("rendersNothing", () => {
  // `cond && <Badge />` の偽 (false) や、空の一覧の map (`[]`) で届く値
  it.each<[string, ReactNode]>([
    ["undefined", undefined],
    ["null", null],
    ["true", true],
    ["false", false],
    ["空文字", ""],
    ["空の配列", []],
    ["描かない値だけの配列", [null, false, ""]],
    ["描かない値だけの入れ子の配列", [[], [undefined]]],
  ])("%s は描かない", (_name, node) => {
    expect(rendersNothing(node)).toBe(true);
  });

  it.each<[string, ReactNode]>([
    ["文字", "a"],
    ["空白", " "],
    // `cond && x` の左辺に数を置いたときに描かれる "0" (react.dev の Conditional Rendering の Pitfall)
    ["0", 0],
    ["NaN", Number.NaN],
    ["bigint", 10n],
    ["要素", createElement("span")],
    ["描く値を持つ配列", [null, "a"]],
    ["描く値を持つ入れ子の配列", [[], [createElement("span")]]],
    // 中身を見ずに、描くかもしれない側に倒す
    ["配列でない iterable", new Set([null])],
    ["Promise", Promise.resolve(null)],
  ])("%s は描くものとして扱う", (_name, node) => {
    expect(rendersNothing(node)).toBe(false);
  });
});
