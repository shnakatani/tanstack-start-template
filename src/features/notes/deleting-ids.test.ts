import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { parseDeletingIds } from "./deleting-ids";

/**
 * `useMutationState` の `select` が返す `variables` は `unknown`。行の突き合わせに使う前に
 * Note の id へ絞る関数の境界テスト。除外は silent にせず warn を残す。
 */
describe("parseDeletingIds", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("Note の id をそのまま並べて返す", () => {
    expect(parseDeletingIds([1, 2])).toEqual([1, 2]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("id の制約を満たさない値は warn を残して除外する", () => {
    // 0 / -1 / 1.5 は noteIdValueSchema の境界 (autoincrement rowid は 1 始まりの整数)。
    // "1" と undefined は別の mutation の variables が mutationKey の前方一致で混ざる経路
    const invalid = [0, -1, 1.5, "1", undefined];

    expect(parseDeletingIds([1, ...invalid])).toEqual([1]);

    expect(warnSpy).toHaveBeenCalledTimes(invalid.length);
    expect(warnSpy).toHaveBeenCalledWith("[parseDeletingIds] variables が Note の id でない", {
      rawInput: "1",
    });
  });
});
