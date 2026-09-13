import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { parseDeletingIds } from "./deleting-ids";

/**
 * `useMutationState` の `select` が返す `variables` は `unknown`。行の突き合わせに使う前に
 * 削除対象 (`DeleteTarget`) へ絞って id を取り出す関数の境界テスト。除外は silent にせず
 * warn を残す。
 */
describe("parseDeletingIds", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("削除対象から id を取り出して並べて返す", () => {
    expect(
      parseDeletingIds([
        { id: 1, name: "買い物リスト" },
        { id: 2, name: "読書メモ" },
      ]),
    ).toEqual([1, 2]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("削除対象の形を満たさない値は warn を残して除外する", () => {
    // id の 0 / -1 / 1.5 は noteIdValueSchema の境界 (autoincrement rowid は 1 始まりの整数)。
    // name 欠落と素の number は、別の mutation の variables が mutationKey の前方一致で
    // 混ざる経路
    const invalid = [
      { id: 0, name: "境界" },
      { id: -1, name: "境界" },
      { id: 1.5, name: "境界" },
      { id: 1 },
      1,
      undefined,
    ];

    expect(parseDeletingIds([{ id: 1, name: "買い物リスト" }, ...invalid])).toEqual([1]);

    expect(warnSpy).toHaveBeenCalledTimes(invalid.length);
    expect(warnSpy).toHaveBeenCalledWith("[parseDeletingIds] variables が削除対象の形でない", {
      rawInput: 1,
    });
  });
});
