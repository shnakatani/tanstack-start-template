import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { parseCreatingRows } from "./creating-rows";

/**
 * `useMutationState` の `select` が返す `variables` は `unknown`。楽観行として描く前に
 * NoteInput へ絞る関数の境界テスト。除外は silent にせず warn を残す。
 */
describe("parseCreatingRows", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("NoteInput の形の variables を submittedAt 付きで返す", () => {
    expect(parseCreatingRows([{ variables: { title: "a", body: "b" }, submittedAt: 10 }])).toEqual([
      { variables: { title: "a", body: "b" }, submittedAt: 10 },
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("NoteInput でない variables は warn を残して除外する", () => {
    // { nope: 1 } は別の mutation の variables が混ざる経路。title が空文字は
    // noteInputSchema の minLength(1) の境界
    const invalid = [{ nope: 1 }, { title: "", body: "b" }, undefined];

    expect(
      parseCreatingRows([
        { variables: { title: "a", body: "b" }, submittedAt: 10 },
        ...invalid.map((variables, index) => ({ variables, submittedAt: 20 + index })),
      ]),
    ).toEqual([{ variables: { title: "a", body: "b" }, submittedAt: 10 }]);

    expect(warnSpy).toHaveBeenCalledTimes(invalid.length);
    expect(warnSpy).toHaveBeenCalledWith("[parseCreatingRows] variables が NoteInput でない", {
      rawInput: { variables: { nope: 1 }, submittedAt: 20 },
    });
  });
});
