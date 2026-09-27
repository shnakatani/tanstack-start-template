import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { NOTE, OTHER_NOTE, UPDATED_NOTE } from "./schema.test-helpers";
import { parseUpdatingNotes } from "./updating-rows";

/**
 * `useMutationState` の `select` が返す `variables` は `unknown`。行の突き合わせに使う前に
 * 更新の形 (`NoteUpdate`) へ絞る関数の境界テスト。除外は silent にせず warn を残す。
 */
describe("parseUpdatingNotes", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("更新の形の値を並べて返す", () => {
    const updates = [
      { id: NOTE.id, title: UPDATED_NOTE.title, body: NOTE.body, dueDate: NOTE.dueDate },
      { id: OTHER_NOTE.id, title: OTHER_NOTE.title, body: "", dueDate: null },
    ];

    expect(parseUpdatingNotes(updates)).toEqual(updates);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("更新の形を満たさない値は warn を残して除外する", () => {
    const valid = { id: NOTE.id, title: NOTE.title, body: NOTE.body, dueDate: NOTE.dueDate };
    // id の 0 は noteIdSchema の境界 (autoincrement rowid は 1 始まりの整数)。id 欠落は作成の
    // variables (NoteInput) の形、title 欠落は入力項目の欠け。素の number と undefined は、
    // `variables` が `unknown` で届く経路
    const invalid = [
      { ...valid, id: 0 },
      { title: NOTE.title, body: NOTE.body, dueDate: NOTE.dueDate },
      { id: NOTE.id, body: NOTE.body, dueDate: NOTE.dueDate },
      1,
      undefined,
    ];

    expect(parseUpdatingNotes([valid, ...invalid])).toEqual([valid]);

    expect(warnSpy).toHaveBeenCalledTimes(invalid.length);
    expect(warnSpy).toHaveBeenCalledWith("[parseUpdatingNotes] variables が更新の形でない", {
      rawInput: 1,
    });
  });
});
