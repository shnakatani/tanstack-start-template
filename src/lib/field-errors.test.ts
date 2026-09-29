import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { normalizeFieldErrors, UNRENDERABLE_FIELD_ERROR_MESSAGE } from "./field-errors";

const fallback = { message: UNRENDERABLE_FIELD_ERROR_MESSAGE };

describe("normalizeFieldErrors", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("エラーが無ければ空を返す", () => {
    expect(normalizeFieldErrors([])).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("文字列と、文字列の message を持つ値は、その文言を返す", () => {
    expect(normalizeFieldErrors(["必須です", { message: "100 文字以内です" }])).toEqual([
      { message: "必須です" },
      { message: "100 文字以内です" },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // disableErrorFlat の field では、validator が返した issue の配列が 1 要素として入る
  it("配列のエラーは 1 段平らにしてから揃える", () => {
    expect(normalizeFieldErrors([[{ message: "必須です" }, "形式が違います"], "x"])).toEqual([
      { message: "必須です" },
      { message: "形式が違います" },
      { message: "x" },
    ]);
  });

  it("平らにして空になるエラーは、元の errors を 1 件として代替文言へ丸める", () => {
    expect(normalizeFieldErrors([[]])).toEqual([fallback]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました",
      { error: [[]] },
    );
  });

  it("平らにして残るエラーがあれば、空の配列は落とす", () => {
    expect(normalizeFieldErrors([[], "必須です"])).toEqual([{ message: "必須です" }]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("空の文言と、文言を取り出せない値は代替文言へ丸めて warn する", () => {
    expect(normalizeFieldErrors(["", { message: "" }, { message: 1 }, 42, null])).toEqual([
      fallback,
      fallback,
      fallback,
      fallback,
      fallback,
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(5);
    expect(warnSpy).toHaveBeenCalledWith(
      "[form-fields] 描画できない形式の検証エラーを代替文言へ丸めました",
      { error: 42 },
    );
  });

  // 平らにするのは 1 段だけ (TanStack Form の flat(1) と同じ深さ)
  it("2 段以上入れ子の配列は代替文言へ丸める", () => {
    expect(normalizeFieldErrors([[[{ message: "必須です" }]]])).toEqual([fallback]);
  });
});
