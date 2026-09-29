import { describe, expect, it } from "vite-plus/test";

import { normalizeFieldErrors, UNRENDERABLE_FIELD_ERROR_MESSAGE } from "./field-errors";

const fallback = { message: UNRENDERABLE_FIELD_ERROR_MESSAGE };

describe("normalizeFieldErrors", () => {
  it("エラーが無ければ空を返す", () => {
    expect(normalizeFieldErrors([])).toEqual({ errors: [], unrenderable: [] });
  });

  it("文字列と、文字列の message を持つ値は、その文言を返す", () => {
    expect(normalizeFieldErrors(["必須です", { message: "100 文字以内です" }])).toEqual({
      errors: [{ message: "必須です" }, { message: "100 文字以内です" }],
      unrenderable: [],
    });
  });

  // disableErrorFlat の field では、validator が返した issue の配列が 1 要素として入る
  it("配列のエラーは 1 段平らにしてから揃える", () => {
    expect(normalizeFieldErrors([[{ message: "必須です" }, "形式が違います"], "x"])).toEqual({
      errors: [{ message: "必須です" }, { message: "形式が違います" }, { message: "x" }],
      unrenderable: [],
    });
  });

  it("平らにして空になるエラーは、元の errors を 1 件として代替文言へ丸める", () => {
    expect(normalizeFieldErrors([[]])).toEqual({ errors: [fallback], unrenderable: [[[]]] });
  });

  it("平らにして残るエラーがあれば、空の配列は落とす", () => {
    expect(normalizeFieldErrors([[], "必須です"])).toEqual({
      errors: [{ message: "必須です" }],
      unrenderable: [],
    });
  });

  it("空の文言と、文言を取り出せない値は代替文言へ丸め、元の値を返す", () => {
    const unrenderable = ["", { message: "" }, { message: 1 }, 42, null];

    expect(normalizeFieldErrors(unrenderable)).toEqual({
      errors: [fallback, fallback, fallback, fallback, fallback],
      unrenderable,
    });
  });

  it("描ける文言と描けない値が混ざっていたら、描けない値だけを返す", () => {
    expect(normalizeFieldErrors(["必須です", 42])).toEqual({
      errors: [{ message: "必須です" }, fallback],
      unrenderable: [42],
    });
  });

  // 平らにするのは 1 段だけ (TanStack Form の flat(1) と同じ深さ)
  it("2 段以上入れ子の配列は代替文言へ丸める", () => {
    expect(normalizeFieldErrors([[[{ message: "必須です" }]]])).toEqual({
      errors: [fallback],
      unrenderable: [[{ message: "必須です" }]],
    });
  });
});
